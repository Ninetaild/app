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
const REQUIRED_SHEET_TITLES = ['급여일', '수입', '저축', '소비', '목표 저축액'] as const;
const MAX_ROWS = 10000;
const MAX_MEMO_LENGTH = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const HEADERS = {
  payday: ['항목', '값'], income: ['거래ID', '날짜', '수입액(원)', '메모', '등록일시'],
  saving: ['거래ID', '날짜', '저축액(원)', '메모', '등록일시'], expense: ['거래ID', '날짜', '소비액(원)', '메모', '등록일시'], goal: ['년월', '목표 저축액(원)'],
} as const;

function getSpreadsheetIdFromUrl(url: string): string {
  let parsed: URL;
  try { parsed = new URL(url.trim()); } catch { throw new Error('Google Sheets 주소 형식을 확인해 주세요.'); }
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
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} 값이 올바르지 않습니다.`);
    return value;
  }
  const raw = String(value ?? '').trim();
  // Google Sheets may return a formatted currency such as "2,700,000원".
  if (!/^[0-9]{1,3}(?:,[0-9]{3})*(?:원)?$|^[0-9]+(?:원)?$/.test(raw)) throw new Error(`${label} 값이 올바르지 않습니다.`);
  const normalized = raw.replace(/,/g, '').replace(/원$/, '');
  const n = Number(normalized);
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

function createdAt(value: unknown, label: string): number {
  const result = text(value, 100);
  if (!ISO_RE.test(result)) throw new Error(`${label} 등록일시가 올바르지 않습니다.`);
  const timestamp = Date.parse(result);
  if (Number.isNaN(timestamp)) throw new Error(`${label} 등록일시가 올바르지 않습니다.`);
  return timestamp;
}

function headerMatches(rows: unknown[][], expected: readonly string[], label: string): void {
  if (!rows.length || rows[0].length !== expected.length || expected.some((header, index) => String(rows[0]?.[index] ?? '').trim() !== header)) throw new Error(`${label} 시트의 백업 양식이 올바르지 않습니다.`);
}

function validateRowWidth(row: unknown[], expectedLength: number, label: string): void {
  if (row.length > expectedLength && row.slice(expectedLength).some((cell) => String(cell ?? '').trim() !== '')) throw new Error(`${label} 행에 예상하지 못한 데이터가 있습니다.`);
}

function rowsWithLimit(rows: unknown[][], label: string): unknown[][] {
  if (rows.length > MAX_ROWS + 1) throw new Error(`${label} 시트의 데이터가 너무 많습니다. 최대 ${MAX_ROWS.toLocaleString()}건까지 복구할 수 있습니다.`);
  return rows;
}

function nonEmptyDataRows(rows: unknown[][]): unknown[][] {
  return rows.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
}

function parseTransactionRows(rows: unknown[][], label: '수입' | '소비') {
  return nonEmptyDataRows(rows).map((row, index) => {
    validateRowWidth(row, 5, `${label} ${index + 1}행`);
    const txId = id(row[0], `${label} ${index + 1}행`);
    const txDate = date(row[1], `${label} ${index + 1}행`);
    const amount = integer(row[2], `${label} ${index + 1}행`);
    const memo = text(row[3]) || label;
    const timestamp = createdAt(row[4], `${label} ${index + 1}행`);
    return { id: txId, date: txDate, amount: label === '소비' ? -amount : amount, memo, type: label === '소비' ? 'expense' as const : 'income' as const, createdAt: timestamp };
  });
}

export async function restoreFromGoogleSheets(url: string): Promise<void> {
  const spreadsheetId = getSpreadsheetIdFromUrl(url);
  const metadata = await googleApi<{ spreadsheetId?: string; sheets?: Array<{ properties?: { title?: string } }> }>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}?includeGridData=false`);
  if (metadata.spreadsheetId !== spreadsheetId) throw new Error('Google Sheets를 확인할 수 없습니다.');
  const sheetTitles = new Set((metadata.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean));
  for (const title of REQUIRED_SHEET_TITLES) if (!sheetTitles.has(title)) throw new Error(`백업 시트에 '${title}' 탭이 없습니다.`);

  const fetchRange = async (range: string) => (await googleApi<{ values?: unknown[][] }>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`)).values || [];
  const [paydayRows, incomeRows, savingRows, expenseRows, goalRows] = await Promise.all([fetchRange(SHEETS.PAYDAY), fetchRange(SHEETS.INCOME), fetchRange(SHEETS.SAVING), fetchRange(SHEETS.EXPENSE), fetchRange(SHEETS.GOAL)]);
  rowsWithLimit(paydayRows, '급여일'); rowsWithLimit(incomeRows, '수입'); rowsWithLimit(savingRows, '저축'); rowsWithLimit(expenseRows, '소비'); rowsWithLimit(goalRows, '목표 저축액');
  headerMatches(paydayRows, HEADERS.payday, '급여일'); headerMatches(incomeRows, HEADERS.income, '수입'); headerMatches(savingRows, HEADERS.saving, '저축'); headerMatches(expenseRows, HEADERS.expense, '소비'); headerMatches(goalRows, HEADERS.goal, '목표 저축액');

  if (nonEmptyDataRows(paydayRows).length !== 1) throw new Error('급여일 시트에는 급여일 데이터가 정확히 1건 있어야 합니다.');
  const paydayRow = nonEmptyDataRows(paydayRows)[0];
  validateRowWidth(paydayRow, 2, '급여일 2행');
  if (text(paydayRow[0], 20) !== '급여일') throw new Error('급여일 시트의 항목이 올바르지 않습니다.');
  const payday = integer(paydayRow[1], '급여일');
  if (payday < 1 || payday > 31) throw new Error('급여일은 1~31 사이여야 합니다.');

  const savingRowsData = nonEmptyDataRows(savingRows);
  const records = savingRowsData.map((row, index) => {
    validateRowWidth(row, 5, `저축 ${index + 1}행`);
    const recordId = id(row[0], `저축 ${index + 1}행`);
    const recordDate = date(row[1], `저축 ${index + 1}행`);
    const amount = integer(row[2], `저축 ${index + 1}행`);
    const memo = text(row[3]) || '저축';
    const timestamp = createdAt(row[4], `저축 ${index + 1}행`);
    return { id: recordId, date: recordDate, amount, memo, createdAt: timestamp };
  });

  const savingIds = new Set<string>();
  records.forEach((record) => { if (savingIds.has(record.id)) throw new Error('저축 시트에 중복된 거래ID가 있습니다.'); savingIds.add(record.id); });

  const transactions = [...parseTransactionRows(incomeRows, '수입'), ...parseTransactionRows(expenseRows, '소비')];
  const transactionIds = new Set<string>();
  transactions.forEach((tx) => { if (transactionIds.has(tx.id)) throw new Error('수입/소비 시트에 중복된 거래ID가 있습니다.'); transactionIds.add(tx.id); });
  for (const record of records) if (transactionIds.has(record.id)) throw new Error('저축과 수입/소비 시트 사이에 중복된 거래ID가 있습니다.');

  const goals: Record<string, number> = {};
  nonEmptyDataRows(goalRows).forEach((row, index) => {
    validateRowWidth(row, 2, `목표 저축액 ${index + 1}행`);
    const monthKey = text(row[0], 7);
    if (!MONTH_RE.test(monthKey)) throw new Error(`목표 저축액 ${index + 1}행의 년월 형식이 올바르지 않습니다.`);
    if (goals[monthKey] !== undefined) throw new Error('목표 저축액 시트에 중복된 년월이 있습니다.');
    goals[monthKey] = integer(row[1], `목표 저축액 ${index + 1}행`);
  });

  // Validate the complete backup before changing local data, then roll back if storage fails halfway through.
  const currentRecords = localStorage.getItem(LOCAL_KEYS.RECORDS);
  const currentTransactions = localStorage.getItem(LOCAL_KEYS.CYCLE_TRANSACTIONS);
  const currentGoals = localStorage.getItem(LOCAL_KEYS.GOALS);
  const currentSettings = localStorage.getItem(LOCAL_KEYS.SETTINGS);
  let settings: Record<string, unknown> = {};
  try { settings = currentSettings ? JSON.parse(currentSettings) : {}; } catch { settings = {}; }
  settings.payday = payday;
  const nextRecords = JSON.stringify(records);
  const nextTransactions = JSON.stringify(transactions.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt));
  const nextGoals = JSON.stringify(goals);
  const nextSettings = JSON.stringify(settings);

  try {
    localStorage.setItem(LOCAL_KEYS.RECORDS, nextRecords);
    localStorage.setItem(LOCAL_KEYS.CYCLE_TRANSACTIONS, nextTransactions);
    localStorage.setItem(LOCAL_KEYS.GOALS, nextGoals);
    localStorage.setItem(LOCAL_KEYS.SETTINGS, nextSettings);
    saveSheetsConnection(spreadsheetId, `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  } catch (error) {
    try {
      if (currentRecords === null) localStorage.removeItem(LOCAL_KEYS.RECORDS); else localStorage.setItem(LOCAL_KEYS.RECORDS, currentRecords);
      if (currentTransactions === null) localStorage.removeItem(LOCAL_KEYS.CYCLE_TRANSACTIONS); else localStorage.setItem(LOCAL_KEYS.CYCLE_TRANSACTIONS, currentTransactions);
      if (currentGoals === null) localStorage.removeItem(LOCAL_KEYS.GOALS); else localStorage.setItem(LOCAL_KEYS.GOALS, currentGoals);
      if (currentSettings === null) localStorage.removeItem(LOCAL_KEYS.SETTINGS); else localStorage.setItem(LOCAL_KEYS.SETTINGS, currentSettings);
    } catch { /* Best-effort rollback; validation has already completed. */ }
    throw new Error('복구한 데이터를 기기에 저장하지 못했습니다. 기존 데이터는 가능한 범위에서 유지되었습니다.');
  }
}
