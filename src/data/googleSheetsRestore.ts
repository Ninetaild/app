import { googleApi } from './googleAuth';
import { saveSheetsConnection } from './googleSheets';

const LOCAL_KEYS = {
  RECORDS: 'saving_game_records_v2',
  GOALS: 'saving_game_goals_v2',
  SETTINGS: 'saving_game_settings_v2',
  CYCLE_TRANSACTIONS: 'saving_game_cycle_transactions_v1',
} as const;

const SHEETS = {
  PAYDAY: '급여일!A:B', INCOME: '수입!A:E', SAVING: '저축!A:E', EXPENSE: '소비!A:E', GOAL: '목표 저축액!A:B',
} as const;
const MAX_ROWS = 10000;
const MAX_MEMO_LENGTH = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const HEADERS = {
  payday: ['항목', '값'], income: ['거래ID', '날짜', '수입액(원)', '메모', '등록일시'],
  saving: ['거래ID', '날짜', '저축액(원)', '메모', '등록일시'], expense: ['거래ID', '날짜', '소비액(원)', '메모', '등록일시'], goal: ['년월', '목표 저축액(원)'],
} as const;

function getSpreadsheetIdFromUrl(url: string): string {
  const parsed = new URL(url.trim());
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'docs.google.com') throw new Error('Google Sheets 주소 형식을 확인해 주세요.');
  const match = parsed.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  if (!match?.[1]) throw new Error('Google Sheets 주소 형식을 확인해 주세요.');
  return match[1];
}
function text(value: unknown, max = MAX_MEMO_LENGTH): string {
  const result = String(value ?? '').trim();
  if (result.length > max) throw new Error('Sheets 백업 데이터의 텍스트 길이가 너무 깁니다.');
  return result;
}
function integer(value: unknown, label: string): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${label} 값이 올바르지 않습니다.`);
  return n;
}
function date(value: unknown, label: string): string {
  const result = text(value, 10);
  if (!DATE_RE.test(result)) throw new Error(`${label} 날짜 형식이 올바르지 않습니다.`);
  const parsed = new Date(`${result}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(result.slice(0, 4)) || parsed.getMonth() + 1 !== Number(result.slice(5, 7)) || parsed.getDate() !== Number(result.slice(8, 10))) throw new Error(`${label} 날짜가 존재하지 않습니다.`);
  return result;
}
function id(value: unknown, label: string): string {
  const result = text(value, 100);
  if (!ID_RE.test(result)) throw new Error(`${label} ID 형식이 올바르지 않습니다.`);
  return result;
}
function headerMatches(rows: unknown[][], expected: readonly string[], label: string): void {
  if (!rows.length || expected.some((header, index) => String(rows[0]?.[index] ?? '').trim() !== header)) throw new Error(`${label} 시트의 백업 양식이 올바르지 않습니다.`);
}
function rowsWithLimit(rows: unknown[][], label: string): unknown[][] {
  if (rows.length > MAX_ROWS + 1) throw new Error(`${label} 시트의 데이터가 너무 많습니다. 최대 ${MAX_ROWS.toLocaleString()}건까지 복구할 수 있습니다.`);
  return rows;
}

export async function restoreFromGoogleSheets(url: string): Promise<void> {
  const spreadsheetId = getSpreadsheetIdFromUrl(url);
  const metadata = await googleApi<{ spreadsheetId?: string; sheets?: Array<{ properties?: { title?: string } }> }>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}?includeGridData=false`);
  if (metadata.spreadsheetId !== spreadsheetId) throw new Error('Google Sheets를 확인할 수 없습니다.');
  const sheetTitles = new Set((metadata.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean));
  for (const title of ['급여일', '수입', '저축', '소비', '목표 저축액']) if (!sheetTitles.has(title)) throw new Error(`백업 시트에 '${title}' 탭이 없습니다.`);

  const fetchRange = async (range: string) => (await googleApi<{ values?: unknown[][] }>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`)).values || [];
  const [paydayRows, incomeRows, savingRows, expenseRows, goalRows] = await Promise.all([fetchRange(SHEETS.PAYDAY), fetchRange(SHEETS.INCOME), fetchRange(SHEETS.SAVING), fetchRange(SHEETS.EXPENSE), fetchRange(SHEETS.GOAL)]);
  rowsWithLimit(paydayRows, '급여일'); rowsWithLimit(incomeRows, '수입'); rowsWithLimit(savingRows, '저축'); rowsWithLimit(expenseRows, '소비'); rowsWithLimit(goalRows, '목표 저축액');
  headerMatches(paydayRows, HEADERS.payday, '급여일'); headerMatches(incomeRows, HEADERS.income, '수입'); headerMatches(savingRows, HEADERS.saving, '저축'); headerMatches(expenseRows, HEADERS.expense, '소비'); headerMatches(goalRows, HEADERS.goal, '목표 저축액');

  const payday = integer(paydayRows[1]?.[1], '급여일');
  if (payday < 1 || payday > 31) throw new Error('급여일은 1~31 사이여야 합니다.');

  const records = savingRows.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim() !== '')).map((row, index) => {
    const recordId = id(row[0], `저축 ${index + 1}행`); const recordDate = date(row[1], `저축 ${index + 1}행`); const amount = integer(row[2], `저축 ${index + 1}행`); const memo = text(row[3]) || '저축';
    const createdAt = Date.parse(text(row[4], 100));
    if (Number.isNaN(createdAt)) throw new Error(`저축 ${index + 1}행 등록일시가 올바르지 않습니다.`);
    return { id: recordId, date: recordDate, amount, memo, createdAt };
  });

  const savingIds = new Set<string>();
  records.forEach((record) => { if (savingIds.has(record.id)) throw new Error('저축 시트에 중복된 거래ID가 있습니다.'); savingIds.add(record.id); });

  const transactions = [
    ...incomeRows.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim() !== '')).map((row, index) => {
      const txId = id(row[0], `수입 ${index + 1}행`); const txDate = date(row[1], `수입 ${index + 1}행`); const amount = integer(row[2], `수입 ${index + 1}행`); const memo = text(row[3]) || '수입'; const createdAt = Date.parse(text(row[4], 100));
      if (Number.isNaN(createdAt)) throw new Error(`수입 ${index + 1}행 등록일시가 올바르지 않습니다.`);
      return { id: txId, date: txDate, amount, memo, type: 'income' as const, createdAt };
    }),
    ...expenseRows.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim() !== '')).map((row, index) => {
      const txId = id(row[0], `소비 ${index + 1}행`); const txDate = date(row[1], `소비 ${index + 1}행`); const amount = integer(row[2], `소비 ${index + 1}행`); const memo = text(row[3]) || '소비'; const createdAt = Date.parse(text(row[4], 100));
      if (Number.isNaN(createdAt)) throw new Error(`소비 ${index + 1}행 등록일시가 올바르지 않습니다.`);
      return { id: txId, date: txDate, amount: -amount, memo, type: 'expense' as const, createdAt };
    }),
  ];
  const transactionIds = new Set<string>();
  transactions.forEach((tx) => { if (transactionIds.has(tx.id)) throw new Error('수입/소비 시트에 중복된 거래ID가 있습니다.'); transactionIds.add(tx.id); });

  const goals: Record<string, number> = {};
  goalRows.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim() !== '')).forEach((row, index) => {
    const monthKey = text(row[0], 7); if (!MONTH_RE.test(monthKey)) throw new Error(`목표 저축액 ${index + 1}행의 년월 형식이 올바르지 않습니다.`);
    if (goals[monthKey] !== undefined) throw new Error('목표 저축액 시트에 중복된 년월이 있습니다.');
    goals[monthKey] = integer(row[1], `목표 저축액 ${index + 1}행`);
  });

  const currentSettings = (() => { try { const raw = localStorage.getItem(LOCAL_KEYS.SETTINGS); return raw ? JSON.parse(raw) : {}; } catch { return {}; } })();
  currentSettings.payday = payday;
  localStorage.setItem(LOCAL_KEYS.RECORDS, JSON.stringify(records));
  localStorage.setItem(LOCAL_KEYS.CYCLE_TRANSACTIONS, JSON.stringify(transactions.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)));
  localStorage.setItem(LOCAL_KEYS.GOALS, JSON.stringify(goals));
  localStorage.setItem(LOCAL_KEYS.SETTINGS, JSON.stringify(currentSettings));
  saveSheetsConnection(spreadsheetId, `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}
