import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertCircle, Target } from 'lucide-react';
import { SavingRecord } from '../types';
import { StorageRepository, formatCurrencyKRW, formatDateKorean, formatMonthDisplay } from '../data/storage';
import { CycleStorage, CycleTransaction, getCycleForDate } from '../data/cycleStorage';
import { LevelCalculator } from '../domain/levelCalculator';

type ViewMode = 'month' | 'year';
const money = (value: number) => formatCurrencyKRW(Math.max(0, Math.round(value)));
const cycleStartMonthDisplay = (cycleStart: string) => formatMonthDisplay(cycleStart.slice(0, 7));

export const HistoryScreen: React.FC = () => {
  const [mode, setMode] = useState<ViewMode>('month');
  const [selectedCycleStart, setSelectedCycleStart] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [allRecords, setAllRecords] = useState<SavingRecord[]>([]);
  const [allTransactions, setAllTransactions] = useState<CycleTransaction[]>([]);
  const [availableCycles, setAvailableCycles] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const loadData = () => {
    const records = StorageRepository.getAllRecords();
    const transactions = CycleStorage.getAllTransactions();
    const payday = StorageRepository.getSettings().payday;
    const today = new Date();
    const currentCycle = getCycleForDate(today, payday);
    const previousCycle = getCycleForDate(new Date(`${currentCycle.startDate}T12:00:00`).setDate ? new Date(new Date(`${currentCycle.startDate}T12:00:00`).getTime() - 86400000) : today, payday);
    const cycleStarts = new Set<string>([currentCycle.startDate, previousCycle.startDate]);
    records.forEach((r) => cycleStarts.add(getCycleForDate(new Date(`${r.date}T00:00:00`), payday).startDate));
    transactions.forEach((t) => cycleStarts.add(getCycleForDate(new Date(`${t.date}T00:00:00`), payday).startDate));
    setAllRecords(records); setAllTransactions(transactions);
    setAvailableCycles([...cycleStarts].filter(Boolean).sort().reverse());
    setSelectedCycleStart((current) => current && cycleStarts.has(current) ? current : currentCycle.startDate);
    const years = new Set<number>([today.getFullYear()]);
    [...records.map((r) => r.date.slice(0, 4)), ...transactions.map((t) => t.date.slice(0, 4))].forEach((y) => { const n = Number(y); if (Number.isInteger(n)) years.add(n); });
    setAvailableYears([...years].sort((a, b) => b - a));
  };
  useEffect(() => { loadData(); const a = StorageRepository.subscribe(loadData); const b = CycleStorage.subscribe(loadData); return () => { a(); b(); }; }, []);

  const payday = StorageRepository.getSettings().payday;
  const currentCycle = useMemo(() => getCycleForDate(new Date(), payday), [payday]);
  const selectedCycle = useMemo(() => selectedCycleStart ? { startDate: selectedCycleStart, endDate: getCycleForDate(new Date(`${selectedCycleStart}T12:00:00`), payday).endDate } : currentCycle, [selectedCycleStart, payday, currentCycle]);
  const isCurrentCycle = selectedCycle.startDate === currentCycle.startDate;
  const targetTransactions = useMemo(() => mode === 'month' ? allTransactions.filter((t) => t.date >= selectedCycle.startDate && t.date < selectedCycle.endDate) : allTransactions.filter((t) => t.date.startsWith(`${selectedYear}-`)), [allTransactions, mode, selectedCycle, selectedYear]);
  const income = targetTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + Math.max(0, t.amount), 0);
  const expense = targetTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const cycleRecords = allRecords.filter((r) => r.date >= selectedCycle.startDate && r.date < selectedCycle.endDate);
  const recordedSaving = cycleRecords.reduce((sum, r) => sum + Math.max(0, r.amount), 0);
  // 진행 중인 급여기간은 입력한 저축 기록을 고정 저축으로 보고, 지나간 급여기간은 수입 - 소비를 저축으로 확정합니다.
  const saving = mode === 'month' && isCurrentCycle ? recordedSaving : Math.max(0, income - expense);
  const monthGoal = StorageRepository.getMonthlyGoal(selectedCycle.startDate.slice(0, 7));
  const isGoalAchieved = monthGoal > 0 && saving >= monthGoal;
  const progressPercent = monthGoal > 0 ? Math.round((saving / monthGoal) * 100) : 0;
  const currentIndex = availableCycles.indexOf(selectedCycle.startDate);
  const yearIndex = availableYears.indexOf(selectedYear);

  const moveCycle = (direction: -1 | 1) => { const next = currentIndex + direction; if (next >= 0 && next < availableCycles.length) setSelectedCycleStart(availableCycles[next]); };
  const moveYear = (direction: -1 | 1) => { const next = yearIndex + direction; if (next >= 0 && next < availableYears.length) setSelectedYear(availableYears[next]); };
  const editGoal = () => {
    const input = window.prompt(`${cycleStartMonthDisplay(selectedCycle.startDate)} 저축 목표를 1원 이상의 정수로 입력하세요.`, String(monthGoal || ''));
    if (input === null) return; const value = input.trim();
    if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) return alert('저축 목표는 1원 이상의 정수만 입력할 수 있습니다.');
    StorageRepository.setMonthlyGoal(selectedCycle.startDate.slice(0, 7), Number(value));
  };

  return <div className="space-y-4 pb-20">
    <div className="pt-1 pb-1"><h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">저축 히스토리</h1></div>

    <div className="flex p-1 bg-stone-100 rounded-2xl border border-stone-200">
      <button type="button" onClick={() => setMode('month')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${mode === 'month' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>월별</button>
      <button type="button" onClick={() => setMode('year')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${mode === 'year' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>년별</button>
    </div>

    <div className="flex items-center justify-between p-2.5 bg-white rounded-2xl border border-stone-200 shadow-2xs">
      <button type="button" onClick={() => mode === 'month' ? moveCycle(1) : moveYear(1)} disabled={mode === 'month' ? currentIndex >= availableCycles.length - 1 : yearIndex >= availableYears.length - 1} className="p-2 text-stone-500 hover:text-stone-900 disabled:text-stone-300 disabled:cursor-not-allowed rounded-lg hover:bg-stone-100"><ChevronLeft className="w-5 h-5" /></button>
      <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-600" />{mode === 'month' ? <select value={selectedCycle.startDate} onChange={(e) => setSelectedCycleStart(e.target.value)} className="font-bold text-stone-800 text-sm bg-transparent outline-hidden cursor-pointer">{availableCycles.map((start) => <option key={start} value={start}>{cycleStartMonthDisplay(start)}</option>)}</select> : <span className="font-bold text-stone-800 text-sm">{selectedYear}년</span>}</div>
      <button type="button" onClick={() => mode === 'month' ? moveCycle(-1) : moveYear(-1)} disabled={mode === 'month' ? currentIndex <= 0 : yearIndex <= 0} className="p-2 text-stone-500 hover:text-stone-900 disabled:text-stone-300 disabled:cursor-not-allowed rounded-lg hover:bg-stone-100"><ChevronRight className="w-5 h-5" /></button>
    </div>

    <div className="grid grid-cols-3 gap-2"><div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100"><div className="text-[10px] text-emerald-700">저축</div><div className="text-sm font-black text-emerald-800 mt-0.5">{money(saving)}</div></div><div className="p-3 bg-stone-100 rounded-2xl border border-stone-200"><div className="text-[10px] text-stone-500">소비</div><div className="text-sm font-black text-stone-800 mt-0.5">{money(expense)}</div></div><div className="p-3 bg-white rounded-2xl border border-stone-200"><div className="text-[10px] text-stone-500">수입</div><div className="text-sm font-black text-stone-800 mt-0.5">{money(income)}</div></div></div>
    <div className="px-1 text-[11px] text-stone-400 text-right">{isCurrentCycle && mode === 'month' ? '현재 급여기간 · 저축 기록 기준' : '저축 = 수입 − 소비'}</div>

    {mode === 'month' && <button type="button" onClick={editGoal} className="w-full text-left p-5 bg-white rounded-3xl border border-stone-200 shadow-xs space-y-3 hover:border-emerald-300 transition-colors">
      <div className="flex items-center justify-between"><span className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><Target className="w-4 h-4 text-emerald-600" />저축 목표</span><span className={`text-[11px] ${isGoalAchieved ? 'font-black text-emerald-700' : 'text-stone-400'}`}>{isGoalAchieved ? '목표 달성' : '눌러서 목표 수정'}</span></div>
      <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-stone-50 rounded-2xl border border-stone-100"><span className="text-[11px] text-stone-500 block mb-0.5">저축</span><span className="text-lg font-black text-emerald-700">{money(saving)}</span></div><div className="p-3 bg-stone-50 rounded-2xl border border-stone-100"><span className="text-[11px] text-stone-500 block mb-0.5">목표 금액</span><span className="text-lg font-black text-stone-800">{money(monthGoal)}</span></div></div>
      <div className="space-y-1"><div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden"><div className={`h-full rounded-full transition-all ${isGoalAchieved ? 'bg-emerald-500' : 'bg-stone-400'}`} style={{ width: `${Math.min(100, progressPercent)}%` }} /></div><div className="flex justify-between text-[11px] text-stone-400"><span>0원</span><span>달성률 {progressPercent}%</span><span>{money(monthGoal)}</span></div></div>
    </button>}

    {mode === 'month' ? <>
      <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-600" />저축 내역 ({cycleRecords.length}건)</h2><span className="text-[10px] text-stone-400">개별 기록</span></div>{cycleRecords.length === 0 ? <div className="text-center py-8 text-stone-400"><AlertCircle className="w-7 h-7 mx-auto mb-2 text-stone-300" /><p className="text-xs">기록된 저축 내역이 없습니다.</p></div> : <div className="divide-y divide-stone-100">{cycleRecords.map((rec) => <div key={rec.id} className="py-3 px-1 flex items-center justify-between"><div className="min-w-0"><div className="text-xs font-bold text-stone-800 truncate">{rec.memo}</div><div className="text-[11px] text-stone-400">{formatDateKorean(rec.date)}</div></div><div className="text-right shrink-0 ml-3"><div className="text-sm font-black text-emerald-700">+{formatCurrencyKRW(rec.amount)}</div><div className="text-[10px] text-stone-400">+{LevelCalculator.savingsToXp(rec.amount)} XP</div></div></div>)}</div>}</div>
      <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-stone-600" />소비 내역 ({targetTransactions.filter((t) => t.type === 'expense').length}건)</h2><span className="text-[10px] text-stone-400">개별 기록</span></div>{targetTransactions.filter((t) => t.type === 'expense').length === 0 ? <div className="text-center py-8 text-stone-400"><p className="text-xs">기록된 소비 내역이 없습니다.</p></div> : <div className="divide-y divide-stone-100">{targetTransactions.filter((t) => t.type === 'expense').map((tx) => <div key={tx.id} className="py-3 px-1 flex items-center justify-between"><div className="min-w-0"><div className="text-xs font-bold text-stone-800 truncate">{tx.memo}</div><div className="text-[11px] text-stone-400">{formatDateKorean(tx.date)}</div></div><div className="text-sm font-black text-stone-700 shrink-0 ml-3">-{formatCurrencyKRW(Math.abs(tx.amount))}</div></div>)}</div>}</div>
    </> : <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs"><h2 className="text-sm font-bold text-stone-800 mb-3">{selectedYear}년 월별</h2><div className="divide-y divide-stone-100">{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => { const key = `${selectedYear}-${String(month).padStart(2, '0')}`; const tx = allTransactions.filter((t) => t.date.startsWith(key)); const i = tx.filter((t) => t.type === 'income').reduce((s, t) => s + Math.max(0, t.amount), 0); const e = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0); return <div key={key} className="py-2.5 flex items-center justify-between"><span className="text-xs font-bold text-stone-700">{month}월</span><div className="flex gap-3 text-[11px]"><span className="text-stone-500">수입 {money(i)}</span><span className="text-stone-500">소비 {money(e)}</span><span className="font-black text-emerald-700">저축 {money(Math.max(0, i - e))}</span></div></div>; })}</div></div>}
  </div>;
};
