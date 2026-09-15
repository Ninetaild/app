import { SavingRecord, AppSettings } from '../types';
import { googleApi, getGoogleClientId } from './googleAuth';

const STORAGE_KEYS = {
  SPREADSHEET_ID: 'saving_game_google_spreadsheet_id',
  SPREADSHEET_URL: 'saving_game_google_spreadsheet_url',
  LAST_SYNC_TIME: 'saving_game_sheets_last_sync_time',
  LAST_SYNC_STATUS: 'saving_game_sheets_last_sync_status',
};

const REQUIRED_SHEETS = ['저축내역', '월별목표', '설정'] as const;

type SheetInfo = { properties?: { sheetId?: number; title?: string } };
interface SpreadsheetInfo { spreadsheetId?: string; spreadsheetUrl?: string; sheets?: SheetInfo[]; }

function getStored(key: string): string { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
function setStored(key: string, value: string): void { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch {} }
export function getSavedSpreadsheetId(): string { return getStored(STORAGE_KEYS.SPREADSHEET_ID); }
export function getSavedSheetsUrl(): string { return getStored(STORAGE_KEYS.SPREADSHEET_URL); }
export function saveSheetsUrl(url: string): void { const match = url.match(/\/spreadsheets\/d\/([^/]+)/); if (match?.[1]) saveSheetsConnection(match[1], url); else if (!url) clearSheetsConnection(); }

export function getAnonymousUserId(): string {
  const key = 'saving_game_local_user_id';
  const existing = getStored(key);
  if (existing) return existing;
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  setStored(key, id);
  return id;
}

export function saveSheetsConnection(spreadsheetId: string, spreadsheetUrl?: string): void {
  setStored(STORAGE_KEYS.SPREADSHEET_ID, spreadsheetId);
  setStored(STORAGE_KEYS.SPREADSHEET_URL, spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}
export function clearSheetsConnection(): void { setStored(STORAGE_KEYS.SPREADSHEET_ID, ''); setStored(STORAGE_KEYS.SPREADSHEET_URL, ''); setStored(STORAGE_KEYS.LAST_SYNC_TIME, ''); setStored(STORAGE_KEYS.LAST_SYNC_STATUS, ''); }
export function getLastSyncInfo(): { time: string | null; status: string | null } { return { time: getStored(STORAGE_KEYS.LAST_SYNC_TIME) || null, status: getStored(STORAGE_KEYS.LAST_SYNC_STATUS) || null }; }
function updateSyncStatus(status: 'success' | 'error' | 'syncing'): void { setStored(STORAGE_KEYS.LAST_SYNC_STATUS, status); if (status === 'success') setStored(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toLocaleString('ko-KR')); }
function spreadsheetUrl(id: string): string { return `https://docs.google.com/spreadsheets/d/${id}/edit`; }

async function ensureSpreadsheet(): Promise<SpreadsheetInfo> {
  const existingId = getSavedSpreadsheetId();
  if (existingId) {
    try { return await googleApi<SpreadsheetInfo>(`/spreadsheets/${encodeURIComponent(existingId)}?includeGridData=false`); }
    catch (error) { console.warn('Saved Google Sheet is unavailable; creating a new one.', error); clearSheetsConnection(); }
  }
  const created = await googleApi<SpreadsheetInfo>('/spreadsheets', { method: 'POST', body: JSON.stringify({ properties: { title: '저축 게임 데이터' }, sheets: REQUIRED_SHEETS.map((title) => ({ properties: { title } })) }) });
  if (!created.spreadsheetId) throw new Error('Google Sheets 생성에 실패했습니다.');
  saveSheetsConnection(created.spreadsheetId, created.spreadsheetUrl);
  return created;
}

async function ensureRequiredSheets(spreadsheet: SpreadsheetInfo): Promise<void> {
  const existing = new Set((spreadsheet.sheets || []).map((sheet) => sheet.properties?.title).filter((title): title is string => Boolean(title)));
  const requests = REQUIRED_SHEETS.filter((title) => !existing.has(title)).map((title) => ({ addSheet: { properties: { title } } }));
  if (requests.length && spreadsheet.spreadsheetId) await googleApi(`/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetId)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
}

function rowsForSync(records: SavingRecord[], goals: Record<string, number>, settings: AppSettings) {
  return {
    records: [['기록ID', '날짜', '저축액(원)', '메모', '등록일시'], ...records.map((record) => [record.id || '', record.date || '', Number(record.amount) || 0, record.memo || '', new Date(record.createdAt || Date.now()).toISOString()])],
    goals: [['년월', '목표액(원)'], ...Object.keys(goals).sort().map((monthKey) => [monthKey, Number(goals[monthKey]) || 0])],
    settings: [['항목', '값'], ['payday', settings.payday ?? ''], ['defaultMonthlyTarget', settings.defaultMonthlyTarget ?? '']],
  };
}
async function writeRange(spreadsheetId: string, range: string, values: unknown[][]): Promise<void> { await googleApi(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ range, majorDimension: 'ROWS', values }) }); }
async function readRange(spreadsheetId: string, range: string): Promise<unknown[][]> { const result = await googleApi<{ values?: unknown[][] }>(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`); return result.values || []; }
async function clearRange(spreadsheetId: string, range: string): Promise<void> { await googleApi(`/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`, { method: 'POST', body: JSON.stringify({}) }); }
async function deleteRow(spreadsheetId: string, sheetId: number, zeroBasedRowIndex: number): Promise<void> { await googleApi(`/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: zeroBasedRowIndex, endIndex: zeroBasedRowIndex + 1 } } }] }) }); }
async function getSpreadsheetForSync(): Promise<SpreadsheetInfo> { const spreadsheet = await ensureSpreadsheet(); if (!spreadsheet.spreadsheetId) throw new Error('Google Sheets ID를 확인할 수 없습니다.'); await ensureRequiredSheets(spreadsheet); return spreadsheet; }

export async function connectGoogleSheets(): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  if (!getGoogleClientId()) throw new Error('Google OAuth Client ID가 설정되지 않았습니다.');
  const spreadsheet = await getSpreadsheetForSync();
  const id = spreadsheet.spreadsheetId!;
  const url = spreadsheet.spreadsheetUrl || spreadsheetUrl(id);
  saveSheetsConnection(id, url);
  return { spreadsheetId: id, spreadsheetUrl: url };
}

// 기본값은 false. Google 로그인, 온라인 복귀, 개별 기록 저장만으로는 절대 Sheets에 쓰지 않는다.
export async function syncAllToGoogleSheets(records: SavingRecord[], goals: Record<string, number>, settings: AppSettings, manual = false): Promise<boolean> {
  if (!manual) return false;
  const spreadsheetId = getSavedSpreadsheetId();
  if (!spreadsheetId) return false;
  updateSyncStatus('syncing');
  try {
    const spreadsheet = await getSpreadsheetForSync();
    const id = spreadsheet.spreadsheetId!;
    const rows = rowsForSync(records, goals, settings);
    await Promise.all(REQUIRED_SHEETS.map((title) => clearRange(id, `${title}!A:Z`)));
    await Promise.all([writeRange(id, '저축내역!A1', rows.records), writeRange(id, '월별목표!A1', rows.goals), writeRange(id, '설정!A1', rows.settings)]);
    updateSyncStatus('success');
    return true;
  } catch (error) { console.warn('Google Sheets backup failed; local data remains available:', error); updateSyncStatus('error'); return false; }
}

// 개별 자동 동기화는 사용하지 않는다. 전체 백업 버튼을 눌렀을 때 최신 로컬 데이터를 한 번에 백업한다.
export function syncRecordToGoogleSheets(_record: SavingRecord): Promise<boolean> { return Promise.resolve(false); }
export function deleteRecordFromGoogleSheets(_recordId: string): Promise<boolean> { return Promise.resolve(false); }
export function syncGoalToGoogleSheets(_monthKey: string, _targetAmount: number): Promise<boolean> { return Promise.resolve(false); }

async function syncAllFromStorage(): Promise<boolean> {
  try {
    const { StorageRepository } = await import('./storage');
    return syncAllToGoogleSheets(StorageRepository.getAllRecords(), StorageRepository.getAllGoalKeys().reduce((acc, key) => { acc[key] = StorageRepository.getMonthlyGoal(key); return acc; }, {} as Record<string, number>), StorageRepository.getSettings(), false);
  } catch (error) { console.warn('Google Sheets full sync skipped:', error); return false; }
}
export function syncNowFromStorage(): Promise<boolean> { return syncAllFromStorage(); }
if (typeof window !== 'undefined') window.addEventListener('online', () => { /* 온라인 복귀만으로 백업하지 않음 */ });
