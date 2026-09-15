import { SavingRecord } from '../types';

export type CycleTransactionType = 'salary' | 'income' | 'expense' | 'saving';

export interface CycleTransaction {
  id: string;
  date: string;
  amount: number;
  memo: string;
  type: CycleTransactionType;
  createdAt: number;
}

export interface PayCycle {
  startDate: string;
  endDate: string;
}

const TRANSACTION_KEY = 'saving_game_cycle_transactions_v1';
const SETTLED_KEY = 'saving_game_cycle_settled_v1';

type Listener = () => void;
const listeners = new Set<Listener>();
const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function paydayDate(year: number, monthIndex: number, payday: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(Math.max(1, payday), lastDay));
}

export function getCycleForDate(date: Date, payday: number): PayCycle {
  const thisPayday = paydayDate(date.getFullYear(), date.getMonth(), payday);
  const start = date >= thisPayday ? thisPayday : paydayDate(date.getFullYear(), date.getMonth() - 1, payday);
  const end = paydayDate(start.getFullYear(), start.getMonth() + 1, payday);
  return { startDate: dateKey(start), endDate: dateKey(end) };
}

export function getNextPayday(date: Date, payday: number): Date {
  const current = paydayDate(date.getFullYear(), date.getMonth(), payday);
  return date < current ? current : paydayDate(date.getFullYear(), date.getMonth() + 1, payday);
}

export function getPreviousDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
}

function notify() { listeners.forEach((listener) => listener()); }

function normalizeAmount(type: CycleTransactionType, amount: number): number {
  const value = Math.round(Math.abs(Number(amount) || 0));
  return type === 'expense' ? -value : value;
}

export const CycleStorage = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getAllTransactions(): CycleTransaction[] {
    try {
      const raw = localStorage.getItem(TRANSACTION_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  saveTransaction(input: Omit<CycleTransaction, 'id' | 'createdAt' | 'amount'> & { amount: number; id?: string }): CycleTransaction {
    const transactions = this.getAllTransactions();
    const transaction: CycleTransaction = {
      id: input.id || `cycle_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: input.date,
      amount: normalizeAmount(input.type, input.amount),
      memo: input.memo || (input.type === 'expense' ? '소비' : input.type === 'salary' ? '급여' : input.type === 'saving' ? '저축' : '수입'),
      type: input.type,
      createdAt: Date.now(),
    };
    const index = transactions.findIndex((item) => item.id === transaction.id);
    if (index >= 0) transactions[index] = transaction;
    else transactions.unshift(transaction);
    transactions.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    localStorage.setItem(TRANSACTION_KEY, JSON.stringify(transactions));
    notify();
    return transaction;
  },

  deleteTransaction(id: string): boolean {
    const transactions = this.getAllTransactions();
    const filtered = transactions.filter((item) => item.id !== id);
    if (filtered.length === transactions.length) return false;
    localStorage.setItem(TRANSACTION_KEY, JSON.stringify(filtered));
    notify();
    return true;
  },

  getTransactionsForCycle(cycle: PayCycle): CycleTransaction[] {
    return this.getAllTransactions().filter((item) => item.date >= cycle.startDate && item.date < cycle.endDate);
  },

  hasSettled(cycleStart: string): boolean {
    try {
      const settled: string[] = JSON.parse(localStorage.getItem(SETTLED_KEY) || '[]');
      return settled.includes(cycleStart);
    } catch { return false; }
  },

  markSettled(cycleStart: string) {
    try {
      const settled: string[] = JSON.parse(localStorage.getItem(SETTLED_KEY) || '[]');
      if (!settled.includes(cycleStart)) {
        settled.push(cycleStart);
        localStorage.setItem(SETTLED_KEY, JSON.stringify(settled));
      }
    } catch {}
    notify();
  },
};

export function getCycleSettlementAmount(cycle: PayCycle, records: SavingRecord[], transactions: CycleTransaction[]): number {
  const income = transactions.filter((item) => item.date >= cycle.startDate && item.date < cycle.endDate && (item.type === 'salary' || item.type === 'income')).reduce((sum, item) => sum + Math.max(0, item.amount), 0);
  const spending = transactions.filter((item) => item.date >= cycle.startDate && item.date < cycle.endDate && item.type === 'expense').reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const saving = records.filter((item) => item.date >= cycle.startDate && item.date < cycle.endDate).reduce((sum, item) => sum + Math.max(0, item.amount), 0);
  return Math.max(0, income - spending - saving);
}
