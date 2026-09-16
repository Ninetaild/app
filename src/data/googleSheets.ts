import { SavingRecord, AppSettings } from '../types';
import { googleApi, getGoogleClientId } from './googleAuth';
import { CycleStorage } from './cycleStorage';

const STORAGE_KEYS = { SPREADSHEET_ID: 'saving_game_google_spreadsheet_id', SPREADSHEET_URL: 'saving_game_google_spreadsheet_url', LAST_SYNC_TIME: 'saving_game_sheets_last_sync_time', LAST_SYNC_STATUS: 'saving_game_sheets_last_sync_status' };
export const REQUIRED_SHEETS = ['급여일', '수입', '저축', '소비', '목표 저축액'] as const;
type SheetInfo = { properties?: { sheetId?: number; title?: string } };
interface SpreadsheetInfo { spreadsheetId?: string; spreadsheetUrl?: string; sheets?: SheetInfo[]; }
function getStored(key: string): string { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
function setStored(key: string, value: string): void { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch {} }
export function getSavedSpreadsheetId(): string { return getStored(STORAGE_KEYS.SPREADSHEET_ID); }
export function getSavedSheetsUrl(): string { return getStored(STORAGE_KEYS.SPREADSHEET_URL); }
export function saveSheetsUrl(url: string): void { const match = url.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/); if (match?.[1]) saveSheetsConnection(match[1], url.trim()); else if (!url.trim()) clearSheetsConnection(); }
export function getAnonymousUserId(): string { const key = 'saving_game_local_user_id'; const existing = getStored(key); if (existing) return existing; const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `local_${Date.now()}_${Math.random().toString(36).slice(2)}`; setStored(key, id); return id; }
export function saveSheetsConnection(spreadsheetId: string, spreadsheetUrl?: string): void { setStored(STORAGE_KEYS.SPREADSHEET_ID, spreadsheetId); setStored(STORAGE_KEYS.SPREADSHEET_URL, spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`); }
export function clearSheetsConnection(): void { setStored(STORAGE_KEYS.SPREADSHEET_ID, ''); setStored(STORAGE_KEYS.SPREADSHEET_URL, ''); setStored(STORAGE_KEYS.LAST_SYNC_TIME, ''); setStored(STORAGE_KEYS.LAST_SYNC_STATUS, ''); }
export function getLastSyncInfo(): { time: string | null; status: string | null } { return { time: getStored(STORAGE_KEYS.LAST_SYNC_TIME) || null, status: getStored(STORAGE_KEYS.LAST_SYNC_STATUS) || null }; }
function updateSyncStatus(status: 'success' | 'error' | 'syncing'): void { setStored(STORAGE_KEYS.LAST_SYNC_STATUS, status); if (status === 'success') setStored(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toLocaleString('ko-KR')); }
function spreadsheetUrl(id: string): string { return `https://docs.google.com/spreadsheets/d/${id}/edit`; }

async function createSpreadsheet(): Promise<SpreadsheetInfo> {
  const created = await googleApi<SpreadsheetInfo>('/spreadsheets', { method: 'POST', body: JSON.stringify({ properties: { title: `저축 게임 백업 ${new Date().toLocaleString('ko-KR').replace(/[:.]/g, '-')}` }, sheets: REQUIRED_SHEETS.map((title) => ({ properties: { title } })) }) });
  if (!created.spreadsheetId) throw new Error('Google Sheets 생성에 실패했습니다.');
  return created;
}
async function ensureRequiredSheets(spreadsheet: SpreadsheetInfo): Promise<void> {
  const existing = new Set((spreadsheet.sheets || []).map((sheet) => sheet.properties?.title).filter((title): title is string => Boolean(title)));
  const requests = REQUIRED_SHEETS.filter((title) => !existing.has(title)).map((title) => ({ addSheet: { properties: { title } } }));
  if (requests.length && spreadsheet.spreadsheetId) await googleApi(`/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetId)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
}
function rowsForBackup(records: SavingRecord[], goals: Record<string, number>, settings: AppSettings) {
  const transactions = CycleStorage.getAllTransactions(); const incomes = transactions.filter((item) => item.type === 'income'); const expenses = transactions.filter((item) => item.type === 'expense');
  return {
    payday: [['항목', '값'], ['급여일', Number(settings.payday) || 25]],
    income: [['거래ID', '날짜', '수입액(원)', '메모', '등록일시'], ...incomes.map((item) => [item.id, item.date, Math.abs(Number(item.amount) || 0), item.memo || '수입', new Date(item.createdAt || Date.now()).toISOString()])],
    saving: [['거래ID', '날짜', '저축액(원)', '메모', '등록일시'], ...records.map((record) => [record.id || '', record.date || '', Number(record.amount) || 0, record.memo || '저축', new Date(record.createdAt || Date.now()).toISOString()])],
    expense: [['거래ID', '날짜', '소비액(원)', '메모', '등록일시'], ...expenses.map((item) => [item.id, item.date, Math.abs(Number(item.amount) || 0), item.memo || '소비', new Date(item.createdAt || Date.now()).toISOString()])],
    goal: [['년월', '목표 저축액(원)'], ...Object.keys(goals).sort().map((monthKey) => [monthKey, Number(goals[monthKey]) || 0])],
  };
}
async function writeRange(spreadsheetId: string, range: string, values: unknown[][]): Promise<void> { await googleApi(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ range, majorDimension: 'ROWS', values }) }); }
async function clearRange(spreadsheetId: string, range: string): Promise<void> { await googleApi(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`, { method: 'POST', body: JSON.stringify({}) }); }
async function formatSheets(spreadsheetId: string, spreadsheet: SpreadsheetInfo): Promise<void> {
  const sheetIds = new Map((spreadsheet.sheets || []).map((sheet) => [sheet.properties?.title, sheet.properties?.sheetId] as const).filter((entry): entry is readonly [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number')); const requests: unknown[] = [];
  REQUIRED_SHEETS.forEach((title) => { const sheetId = sheetIds.get(title); if (sheetId === undefined) return; requests.push({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, horizontalAlignment: 'CENTER' } }, fields: 'userEnteredFormat.textFormat.bold,userEnteredFormat.horizontalAlignment' } }, { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } }, { autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: title === '급여일' || title === '목표 저축액' ? 2 : 5 } } }); });
  const currency = (title: typeof REQUIRED_SHEETS[number], columnIndex: number) => { const sheetId = sheetIds.get(title); if (sheetId === undefined) return; requests.push({ repeatCell: { range: { sheetId, startRowIndex: 1, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 }, cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0"원"' } } }, fields: 'userEnteredFormat.numberFormat' } }); };
  currency('수입', 2); currency('저축', 2); currency('소비', 2); currency('목표 저축액', 1); if (requests.length) await googleApi(`/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
}

export async function backupToGoogleSheets(records: SavingRecord[], goals: Record<string, number>, settings: AppSettings): Promise<boolean> {
  if (!getGoogleClientId()) throw new Error('Google OAuth Client ID가 설정되지 않았습니다.'); updateSyncStatus('syncing');
  try {
    // Every explicit backup creates a fresh snapshot instead of silently updating an old cloud copy.
    const spreadsheet = await createSpreadsheet(); const id = spreadsheet.spreadsheetId!; const rows = rowsForBackup(records, goals, settings);
    await Promise.all(REQUIRED_SHEETS.map((title) => clearRange(id, `${title}!A:Z`)));
    await Promise.all([writeRange(id, '급여일!A1', rows.payday), writeRange(id, '수입!A1', rows.income), writeRange(id, '저축!A1', rows.saving), writeRange(id, '소비!A1', rows.expense), writeRange(id, '목표 저축액!A1', rows.goal)]);
    const latest = await googleApi<SpreadsheetInfo>(`/spreadsheets/${encodeURIComponent(id)}?includeGridData=false`); await ensureRequiredSheets(latest); await formatSheets(id, latest);
    saveSheetsConnection(id, latest.spreadsheetUrl || spreadsheet.spreadsheetUrl || spreadsheetUrl(id)); updateSyncStatus('success'); return true;
  } catch (error) { console.warn('Google Sheets backup failed; local data remains available:', error); updateSyncStatus('error'); return false; }
}

// Local changes never write to Google Sheets. Only the explicit backup action writes a cloud snapshot.
export function syncRecordToGoogleSheets(_record: SavingRecord): Promise<boolean> { return Promise.resolve(false); }
export function deleteRecordFromGoogleSheets(_recordId: string): Promise<boolean> { return Promise.resolve(false); }
export function syncGoalToGoogleSheets(_monthKey: string, _targetAmount: number): Promise<boolean> { return Promise.resolve(false); }
export function syncAllToGoogleSheets(_records: SavingRecord[], _goals: Record<string, number>, _settings: AppSettings): Promise<boolean> { return Promise.resolve(false); }
export function syncNowFromStorage(): Promise<boolean> { return Promise.resolve(false); }
export async function getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetInfo> { return googleApi<SpreadsheetInfo>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}?includeGridData=false`); }
