export type CycleTransactionType = 'salary' | 'income' | 'expense';

export interface CycleTransaction {
  id: string;
  date: string;
  amount: number;
  memo: string;
  type: CycleTransactionType;
}

const KEY = 'saving_game_cycle_transactions_v1';
const SETTLED_KEY = 'saving_game_cycle_settled_v1';
const listeners = new Set<() => void>();

const read = <T>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  listeners.forEach((fn) => fn());
};

export const CycleStorage = {
  subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); },
  getAllTransactions(): CycleTransaction[] { return read(KEY, []); },
  saveTransaction(input: Omit<CycleTransaction, 'id'>) {
    const items = this.getAllTransactions();
    const item = { ...input, id: 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) };
    write(KEY, [item, ...items]);
    return item;
  },
  hasSettled(cycleStart: string) { return read<string[]>(SETTLED_KEY, []).includes(cycleStart); },
  markSettled(cycleStart: string) { const current = read<string[]>(SETTLED_KEY, []); if (!current.includes(cycleStart)) write(SETTLED_KEY, [...current, cycleStart]); },
};

export function getCycleForDate(date: Date, payday: number) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const day = date.getDate();
  const thisPayday = new Date(y, m, Math.min(payday, new Date(y, m + 1, 0).getDate()));
  let start = thisPayday;
  if (day < thisPayday.getDate()) start = new Date(y, m - 1, Math.min(payday, new Date(y, m, 0).getDate()));
  const end = new Date(start.getFullYear(), start.getMonth() + 1, Math.min(payday, new Date(start.getFullYear(), start.getMonth() + 2, 0).getDate()));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}

export function getNextPayday(date: Date, payday: number) {
  const y = date.getFullYear(), m = date.getMonth();
  const candidate = new Date(y, m, Math.min(payday, new Date(y, m + 1, 0).getDate()));
  return date.getDate() < candidate.getDate() ? candidate : new Date(y, m + 1, Math.min(payday, new Date(y, m + 2, 0).getDate()));
}
export function getPreviousDate(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1); }
