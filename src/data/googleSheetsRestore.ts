import { googleApi } from './googleAuth';
import { saveSheetsConnection } from './googleSheets';

const LOCAL_KEYS = {
  RECORDS: 'saving_game_records_v2',
  GOALS: 'saving_game_goals_v2',
  SETTINGS: 'saving_game_settings_v2',
  CYCLE_TRANSACTIONS: 'saving_game_cycle_transactions_v1',
};

const SHEETS = {
  PAYDAY: '급여일!A:B',
  INCOME: '수입!A:E',
  SAVING: '저축!A:E',
  EXPENSE: '소비!A:E',
  GOAL: '목표 저축액!A:B',
} as const;

function getSpreadsheetIdFromUrl(url: string): string {
  const match = url.trim().match(/\/spreadsheets\/d\/([^/]+)/i);
  if (!match?.[1]) throw new Error('Google Sheets 주소 형식을 확인해 주세요.');
  return match[1];
}

function asString(value: unknown): string { return String(value ?? '').trim(); }
function asNumber(value: unknown): number { return Math.round(Number(value) || 0); }

export async function restoreFromGoogleSheets(url: string): Promise<void> {
  const spreadsheetId = getSpreadsheetIdFromUrl(url);
  const [paydayRows, incomeRows, savingRows, expenseRows, goalRows] = await Promise.all([
    googleApi<{ values?: unknown[][] }>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(SHEETS.PAYDAY)}`),
    googleApi<{ values?: unknown[][] }>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(SHEETS.INCOME)}`),
    googleApi<{ values?: unknown[][] }>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(SHEETS.SAVING)}`),
    googleApi<{ values?: unknown[][] }>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(SHEETS.EXPENSE)}`),
    googleApi<{ values?: unknown[][] }>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(SHEETS.GOAL)}`),
  ]);

  const paydayValues = paydayRows.values || [];
  const incomeValues = incomeRows.values || [];
  const savingValues = savingRows.values || [];
  const expenseValues = expenseRows.values || [];
  const goalValues = goalRows.values || [];

  const hasExpectedData = paydayValues.length > 1 || incomeValues.length > 1 || savingValues.length > 1 || expenseValues.length > 1 || goalValues.length > 1;
  if (!hasExpectedData) throw new Error('복구할 데이터가 없습니다. 지정한 Sheets의 백업 내용을 확인해 주세요.');

  const records = savingValues.slice(1)
    .filter((row) => asString(row[0]) && asString(row[1]))
    .map((row, index) => ({
      id: asString(row[0]),
      date: asString(row[1]),
      amount: Math.abs(asNumber(row[2])),
      memo: asString(row[3]) || '저축',
      createdAt: Date.parse(asString(row[4])) || Date.now() - index,
    }));

  const transactions = [
    ...incomeValues.slice(1)
      .filter((row) => asString(row[0]) && asString(row[1]))
      .map((row, index) => ({
        id: asString(row[0]),
        date: asString(row[1]),
        amount: Math.abs(asNumber(row[2])),
        memo: asString(row[3]) || '수입',
        type: 'income' as const,
        createdAt: Date.parse(asString(row[4])) || Date.now() - index,
      })),
    ...expenseValues.slice(1)
      .filter((row) => asString(row[0]) && asString(row[1]))
      .map((row, index) => ({
        id: asString(row[0]),
        date: asString(row[1]),
        amount: -Math.abs(asNumber(row[2])),
        memo: asString(row[3]) || '소비',
        type: 'expense' as const,
        createdAt: Date.parse(asString(row[4])) || Date.now() - index,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  const goals: Record<string, number> = {};
  goalValues.slice(1).forEach((row) => {
    const monthKey = asString(row[0]);
    if (monthKey) goals[monthKey] = Math.max(0, asNumber(row[1]));
  });

  const currentSettings = (() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEYS.SETTINGS);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  })();
  const payday = asNumber(paydayValues[1]?.[1]);
  if (payday >= 1 && payday <= 31) currentSettings.payday = payday;

  localStorage.setItem(LOCAL_KEYS.RECORDS, JSON.stringify(records));
  localStorage.setItem(LOCAL_KEYS.CYCLE_TRANSACTIONS, JSON.stringify(transactions));
  localStorage.setItem(LOCAL_KEYS.GOALS, JSON.stringify(goals));
  localStorage.setItem(LOCAL_KEYS.SETTINGS, JSON.stringify(currentSettings));
  saveSheetsConnection(spreadsheetId, url.trim());
}
