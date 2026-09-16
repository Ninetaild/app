import { SavingRecord, MonthlyGoal, AppSettings } from '../types';
import {
  syncRecordToGoogleSheets,
  deleteRecordFromGoogleSheets,
  syncGoalToGoogleSheets,
  syncAllToGoogleSheets,
  getSavedSheetsUrl,
  saveSheetsUrl,
  getAnonymousUserId,
} from './googleSheets';

const STORAGE_KEYS = {
  RECORDS: 'saving_game_records_v2',
  GOALS: 'saving_game_goals_v2',
  SETTINGS: 'saving_game_settings_v2',
  APPTECH_CACHE: 'saving_game_apptech_cache_v2',
};

const DEFAULT_SETTINGS: AppSettings = {
  payday: 25,
  defaultMonthlyTarget: 1500000, // 150만원
  showCharacter: true,
  showAppTech: true,
  customXmlUrl: 'https://ninetaild.github.io/app/xml.xml',
  dismissedNextMonthProposals: [],
  googleSheetsUrl: '',
  clientId: '',
};

// Helper: 현재 로컬 날짜의 YYYY-MM 문자열 반환
export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatMonthDisplay(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return `${year}년 ${parseInt(month, 10)}월`;
}

export function formatCurrencyKRW(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US').format(amount);
  const language = typeof document !== 'undefined' ? document.documentElement.lang : 'ko';
  if (language === 'en') return `$${formatted}`;
  if (language === 'ja') return `¥${formatted}`;
  return `${formatted}원`;
}

export function formatDateKorean(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return dateStr;
}

// Request persistent storage quota from Android / Browser so local data is never purged
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persisted) => {
    if (persisted) {
      console.log('Persistent local storage granted on device.');
    }
  }).catch(() => {});
}

// Dual-Storage Layer: IndexedDB permanent backup for APK / WebView / Mobile environments
const IDB_CONFIG = {
  DB_NAME: 'SavingBookLocalDB_v2',
  STORE_NAME: 'app_keyval',
  VERSION: 1,
};

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(IDB_CONFIG.DB_NAME, IDB_CONFIG.VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_NAME)) {
        db.createObjectStore(IDB_CONFIG.STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_CONFIG.STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

async function idbRemove(key: string): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

// Initial Sync: Ensure data persists across APK reinstall, process kill, or WebStorage cleanup
async function syncLocalAndIndexedDB() {
  if (typeof window === 'undefined') return;

  try {
    const localRecords = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!localRecords || localRecords === '[]') {
      // Check if IndexedDB has previously saved records
      const idbRecords = await idbGet(STORAGE_KEYS.RECORDS);
      if (idbRecords && idbRecords !== '[]') {
        localStorage.setItem(STORAGE_KEYS.RECORDS, idbRecords);
        const idbGoals = await idbGet(STORAGE_KEYS.GOALS);
        if (idbGoals) localStorage.setItem(STORAGE_KEYS.GOALS, idbGoals);
        const idbSettings = await idbGet(STORAGE_KEYS.SETTINGS);
        if (idbSettings) localStorage.setItem(STORAGE_KEYS.SETTINGS, idbSettings);
        notifyListeners();
      }
    } else {
      // LocalStorage has records, sync to IndexedDB
      idbSet(STORAGE_KEYS.RECORDS, localRecords);
      const localGoals = localStorage.getItem(STORAGE_KEYS.GOALS);
      if (localGoals) idbSet(STORAGE_KEYS.GOALS, localGoals);
      const localSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (localSettings) idbSet(STORAGE_KEYS.SETTINGS, localSettings);
    }
  } catch (e) {
    console.warn('Initial storage synchronization note:', e);
  }
}

if (typeof window !== 'undefined') {
  syncLocalAndIndexedDB();
  window.addEventListener('pagehide', () => {
    try {
      const rec = localStorage.getItem(STORAGE_KEYS.RECORDS);
      if (rec) idbSet(STORAGE_KEYS.RECORDS, rec);
      const goals = localStorage.getItem(STORAGE_KEYS.GOALS);
      if (goals) idbSet(STORAGE_KEYS.GOALS, goals);
      const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settings) idbSet(STORAGE_KEYS.SETTINGS, settings);
    } catch {}
  });

  // Background Auto-Sync with Google Sheets if configured
  setTimeout(() => {
    try {
      const url = getSavedSheetsUrl();
      if (url) {
        const records = StorageRepository.getAllRecords();
        const goals = StorageRepository.getAllGoalKeys().reduce((acc, key) => {
          acc[key] = StorageRepository.getMonthlyGoal(key);
          return acc;
        }, {} as Record<string, number>);
        syncAllToGoogleSheets(records, goals, StorageRepository.getSettings()).catch(() => {});
      }
    } catch {}
  }, 1500);
}

type StorageListener = () => void;
const listeners: Set<StorageListener> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export const StorageRepository = {
  subscribe(listener: StorageListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        if (!parsed.customXmlUrl || parsed.customXmlUrl.includes('USERNAME/REPOSITORY')) {
          parsed.customXmlUrl = 'https://ninetaild.github.io/app/xml.xml';
        }
        if (!parsed.googleSheetsUrl) {
          parsed.googleSheetsUrl = getSavedSheetsUrl();
        }
        if (!parsed.clientId) {
          parsed.clientId = getAnonymousUserId();
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    return {
      ...DEFAULT_SETTINGS,
      googleSheetsUrl: getSavedSheetsUrl(),
      clientId: getAnonymousUserId(),
    };
  },

  saveSettings(settings: Partial<AppSettings>) {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    if (settings.googleSheetsUrl !== undefined) {
      saveSheetsUrl(settings.googleSheetsUrl);
    }
    try {
      const serialized = JSON.stringify(updated);
      localStorage.setItem(STORAGE_KEYS.SETTINGS, serialized);
      idbSet(STORAGE_KEYS.SETTINGS, serialized);
    } catch (e) {
      console.error('Failed to save settings', e);
    }
    notifyListeners();
    return updated;
  },

  // === Records (저축 기록) ===
  getAllRecords(): SavingRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load records', e);
    }
    return [];
  },

  saveRecord(record: Omit<SavingRecord, 'id' | 'createdAt'> & { id?: string }): SavingRecord {
    const records = this.getAllRecords();
    let saved: SavingRecord;

    if (record.id) {
      // 수정
      const idx = records.findIndex((r) => r.id === record.id);
      if (idx >= 0) {
        saved = {
          ...records[idx],
          amount: Math.round(Number(record.amount) || 0),
          date: record.date,
          memo: record.memo || '저축',
        };
        records[idx] = saved;
      } else {
        saved = {
          id: record.id,
          amount: Math.round(Number(record.amount) || 0),
          date: record.date,
          memo: record.memo || '저축',
          createdAt: Date.now(),
        };
        records.push(saved);
      }
    } else {
      // 신규 추가
      saved = {
        id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        amount: Math.round(Number(record.amount) || 0),
        date: record.date,
        memo: record.memo || '저축',
        createdAt: Date.now(),
      };
      records.unshift(saved);
    }

    // 최신 날짜 순으로 정렬
    records.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.createdAt - a.createdAt));

    try {
      const serialized = JSON.stringify(records);
      localStorage.setItem(STORAGE_KEYS.RECORDS, serialized);
      idbSet(STORAGE_KEYS.RECORDS, serialized);
      syncRecordToGoogleSheets(saved).catch(() => {});
    } catch (e) {
      console.error('Failed to save records', e);
    }

    notifyListeners();
    return saved;
  },

  deleteRecord(id: string): boolean {
    const records = this.getAllRecords();
    const filtered = records.filter((r) => r.id !== id);
    if (filtered.length !== records.length) {
      try {
        const serialized = JSON.stringify(filtered);
        localStorage.setItem(STORAGE_KEYS.RECORDS, serialized);
        idbSet(STORAGE_KEYS.RECORDS, serialized);
        deleteRecordFromGoogleSheets(id).catch(() => {});
      } catch (e) {
        console.error('Failed to delete record', e);
      }
      notifyListeners();
      return true;
    }
    return false;
  },

  getRecordsForMonth(monthKey: string): SavingRecord[] {
    const records = this.getAllRecords();
    return records.filter((r) => r.date.startsWith(monthKey));
  },

  getTotalSavingsForMonth(monthKey: string): number {
    const monthRecords = this.getRecordsForMonth(monthKey);
    return monthRecords.reduce((sum, r) => sum + r.amount, 0);
  },

  getTotalAccumulatedSavings(): number {
    const records = this.getAllRecords();
    return records.reduce((sum, r) => sum + r.amount, 0);
  },

  // === Goals (월별 목표액) ===
  getMonthlyGoal(monthKey: string): number {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GOALS);
      if (data) {
        const goals: Record<string, number> = JSON.parse(data);
        if (goals[monthKey] !== undefined) {
          return goals[monthKey];
        }
      }
    } catch (e) {
      console.error('Failed to read monthly goal', e);
    }
    // 기본 설정값 반환
    return this.getSettings().defaultMonthlyTarget;
  },

  setMonthlyGoal(monthKey: string, targetAmount: number) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GOALS);
      const goals: Record<string, number> = data ? JSON.parse(data) : {};
      goals[monthKey] = targetAmount;
      const serialized = JSON.stringify(goals);
      localStorage.setItem(STORAGE_KEYS.GOALS, serialized);
      idbSet(STORAGE_KEYS.GOALS, serialized);
      syncGoalToGoogleSheets(monthKey, targetAmount).catch(() => {});
    } catch (e) {
      console.error('Failed to save monthly goal', e);
    }
    notifyListeners();
  },

  getAllGoalKeys(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GOALS);
      if (data) {
        const goals: Record<string, number> = JSON.parse(data);
        return Object.keys(goals);
      }
    } catch (e) {
      console.error('Failed to get goal keys', e);
    }
    return [];
  },

  // === 초기 시드 데이터 생성 (사용자가 앱을 처음 켰을 때 바로 체험 가능하도록) ===
  seedDemoData() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;
    const currentMonthStr = String(currentMonthNum).padStart(2, '0');
    const currentMonthKey = `${currentYear}-${currentMonthStr}`;

    // 이전 달 계산
    const prevDate = new Date(currentYear, now.getMonth() - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonthNum = prevDate.getMonth() + 1;
    const prevMonthStr = String(prevMonthNum).padStart(2, '0');
    const prevMonthKey = `${prevYear}-${prevMonthStr}`;

    const demoRecords: SavingRecord[] = [
      {
        id: 'seed_1',
        date: `${currentMonthKey}-01`,
        amount: 1000000,
        memo: '월급날 정기 적금 이체',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
      },
      {
        id: 'seed_2',
        date: `${currentMonthKey}-12`,
        amount: 200000,
        memo: '외식비 절약 추가 저축',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
      },
      // 지난달 데이터 (목표 달성 케이스: 1,500,000원 달성)
      {
        id: 'seed_3',
        date: `${prevMonthKey}-01`,
        amount: 1200000,
        memo: '지난달 정기 적금',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 40,
      },
      {
        id: 'seed_4',
        date: `${prevMonthKey}-18`,
        amount: 350000,
        memo: '당근마켓 중고판매금 저축',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 25,
      },
    ];

    try {
      const serializedRecords = JSON.stringify(demoRecords);
      localStorage.setItem(STORAGE_KEYS.RECORDS, serializedRecords);
      idbSet(STORAGE_KEYS.RECORDS, serializedRecords);
      
      const goals: Record<string, number> = {
        [currentMonthKey]: 1500000,
        [prevMonthKey]: 1500000,
      };
      const serializedGoals = JSON.stringify(goals);
      localStorage.setItem(STORAGE_KEYS.GOALS, serializedGoals);
      idbSet(STORAGE_KEYS.GOALS, serializedGoals);
      this.saveSettings({ defaultMonthlyTarget: 1500000 });
    } catch (e) {
      console.error('Failed to seed demo data', e);
    }

    notifyListeners();
  },

  clearAllData() {
    try {
      localStorage.removeItem(STORAGE_KEYS.RECORDS);
      localStorage.removeItem(STORAGE_KEYS.GOALS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.APPTECH_CACHE);
      idbRemove(STORAGE_KEYS.RECORDS);
      idbRemove(STORAGE_KEYS.GOALS);
      idbRemove(STORAGE_KEYS.SETTINGS);
      idbRemove(STORAGE_KEYS.APPTECH_CACHE);
    } catch (e) {
      console.error('Failed to clear data', e);
    }
    notifyListeners();
  },

  hasRecords(): boolean {
    return this.getAllRecords().length > 0;
  },

  // === Backup & Restore (기기 변경 및 로컬 백업용) ===
  exportBackupData(): string {
    const backup = {
      app: 'saving-game-v2',
      version: 2,
      exportedAt: new Date().toISOString(),
      records: this.getAllRecords(),
      goals: (() => {
        try {
          const g = localStorage.getItem(STORAGE_KEYS.GOALS);
          return g ? JSON.parse(g) : {};
        } catch {
          return {};
        }
      })(),
      settings: this.getSettings(),
    };
    return JSON.stringify(backup, null, 2);
  },

  restoreBackupData(jsonString: string): { success: boolean; count: number; error?: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return { success: false, count: 0, error: '올바른 백업 파일 형식이 아닙니다.' };
      }
      const records = Array.isArray(data.records) ? data.records : [];
      const goals = data.goals && typeof data.goals === 'object' ? data.goals : {};
      const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};

      const serializedRecords = JSON.stringify(records);
      const serializedGoals = JSON.stringify(goals);
      const serializedSettings = JSON.stringify({ ...DEFAULT_SETTINGS, ...settings });

      localStorage.setItem(STORAGE_KEYS.RECORDS, serializedRecords);
      idbSet(STORAGE_KEYS.RECORDS, serializedRecords);

      localStorage.setItem(STORAGE_KEYS.GOALS, serializedGoals);
      idbSet(STORAGE_KEYS.GOALS, serializedGoals);

      localStorage.setItem(STORAGE_KEYS.SETTINGS, serializedSettings);
      idbSet(STORAGE_KEYS.SETTINGS, serializedSettings);

      notifyListeners();
      return { success: true, count: records.length };
    } catch (e: any) {
      return { success: false, count: 0, error: e?.message || 'JSON 파싱 오류가 발생했습니다.' };
    }
  },
};
