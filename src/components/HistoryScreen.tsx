import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Target } from 'lucide-react';
import { SavingRecord } from '../types';
import { StorageRepository, getCurrentMonthKey, formatCurrencyKRW, formatDateKorean, formatMonthDisplay } from '../data/storage';
import { CycleStorage, CycleTransaction, getCycleForDate } from '../data/cycleStorage';
import { LevelCalculator } from '../domain/levelCalculator';

export const HistoryScreen: React.FC = () => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(getCurrentMonthKey());
  const [allRecords, setAllRecords] = useState<SavingRecord[]>([]);
  const [allTransactions, setAllTransactions] = useState<CycleTransaction[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  const loadData = () => {
    const records = StorageRepository.getAllRecords();
    const transactions = CycleStorage.getAllTransactions();
    setAllRecords(records);
    setAllTransactions(transactions);
    const monthsSet = new Set<string>([getCurrentMonthKey()]);
    records.forEach((r) => monthsSet.add(r.date.substring(0, 7)));
    transactions.forEach((t) => monthsSet.add(t.date.substring(0, 7)));
    StorageRepository.getAllGoalKeys().forEach((m) => monthsSet.add(m));
    const sortedMonths = Array.from(monthsSet).filter(Boolean).sort().reverse();
    setAvailableMonths(sortedMonths);
    if (!monthsSet.has(selectedMonthKey) && sortedMonths.length > 0) setSelectedMonthKey(sortedMonths[0]);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = StorageRepository.subscribe(loadData);
    const cycleUnsubscribe = CycleStorage.subscribe(loadData);
    return () => { unsubscribe(); cycleUnsubscribe(); };
  }, []);

  const monthRecords = allRecords.filter((r) => r.date.startsWith(selectedMonthKey));
  const monthTransactions = allTransactions.filter((t) => t.date.startsWith(selectedMonthKey));
  const payday = (() => { const value = StorageRepository.getSettings().payday; return Number.isInteger(value) && value >= 1 && value <= 31 ? value : 25; })();
  const cycleAnchor = useMemo(() => {
    const now = new Date();
    const currentMonthKey = getCurrentMonthKey();
    if (selectedMonthKey === currentMonthKey) return now;
    const [year, month] = selectedMonthKey.split('-').map(Number);
    return new Date(year, month - 1, 15);
  }, [selectedMonthKey]);
  const selectedCycle = useMemo(() => getCycleForDate(cycleAnchor, payday), [cycleAnchor, payday]);
  const cycleIncomeTotal = allTransactions
    .filter((t) => t.type === 'income' && t.date >= selectedCycle.startDate && t.date < selectedCycle.endDate)
    .reduce((sum, t) => sum + Math.max(0, t.amount), 0);
  const monthTotal = monthRecords.reduce((sum, r) => sum + Math.max(0, r.amount), 0);
  const monthExpenseTotal = monthTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const monthIncomeTotal = cycleIncomeTotal;
  const monthGoal = StorageRepository.getMonthlyGoal(selectedMonthKey);
  const isGoalAchieved = monthGoal > 0 && monthTotal >= monthGoal;
  const progressPercent = monthGoal > 0 ? Math.round((monthTotal / monthGoal) * 100) : 0;

  const currentIndex = availableMonths.indexOf(selectedMonthKey);
  const handlePrevMonth = () => { if (currentIndex < availableMonths.length - 1) setSelectedMonthKey(availableMonths[currentIndex + 1]); };
  const handleNextMonth = () => { if (currentIndex > 0) setSelectedMonthKey(availableMonths[currentIndex - 1]); };

  const editGoal = () => {
    const input = window.prompt(`${formatMonthDisplay(selectedMonthKey)} 저축 목표를 1원 이상의 정수로 입력하세요.`, String(monthGoal || ''));
    if (input === null) return;
    const value = input.trim();
    if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
      alert('저축 목표는 1원 이상의 정수만 입력할 수 있습니다.');
      return;
    }
    StorageRepository.setMonthlyGoal(selectedMonthKey, Number(value));
  };

  const expenses = monthTransactions.filter((t) => t.type === 'expense');

  return <div className="space-y-4 pb-20">
    <div className="pt-1 pb-1"><h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">저축 히스토리</h1><p className="text-[11px] text-stone-400 mt-1">기록은 조회만 가능하며, 수정·삭제는 홈 화면에서 할 수 있습니다.</p></div>

    <div className="flex items-center justify-between p-2.5 bg-white rounded-2xl border border-stone-200 shadow-2xs">
      <button type="button" onClick={handlePrevMonth} disabled={currentIndex >= availableMonths.length - 1} className="p-2 text-stone-500 hover:text-stone-900 disabled:text-stone-300 disabled:cursor-not-allowed rounded-lg hover:bg-stone-100 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
      <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-600" /><select value={selectedMonthKey} onChange={(e) => setSelectedMonthKey(e.target.value)} className="font-bold text-stone-800 text-sm bg-transparent outline-hidden cursor-pointer">{availableMonths.map((m) => <option key={m} value={m}>{formatMonthDisplay(m)}</option>)}</select></div>
      <button type="button" onClick={handleNextMonth} disabled={currentIndex <= 0} className="p-2 text-stone-500 hover:text-stone-900 disabled:text-stone-300 disabled:cursor-not-allowed rounded-lg hover:bg-stone-100 transition-colors"><ChevronRight className="w-5 h-5" /></button>
    </div>

    <button type="button" onClick={editGoal} className="w-full text-left p-5 bg-white rounded-3xl border border-stone-200 shadow-xs space-y-3 hover:border-emerald-300 transition-colors">
      <div className="flex items-center justify-between"><span className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><Target className="w-4 h-4 text-emerald-600" />저축 목표</span>{isGoalAchieved ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full"><CheckCircle2 className="w-3.5 h-3.5" />목표 달성</span> : <span className="text-[11px] text-stone-400">눌러서 목표 수정</span>}</div>
      <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-stone-50 rounded-2xl border border-stone-100"><span className="text-[11px] text-stone-500 block mb-0.5">이번 달 저축</span><span className="text-lg font-black text-emerald-700">{formatCurrencyKRW(monthTotal)}</span></div><div className="p-3 bg-stone-50 rounded-2xl border border-stone-100"><span className="text-[11px] text-stone-500 block mb-0.5">목표 금액</span><span className="text-lg font-black text-stone-800">{formatCurrencyKRW(monthGoal)}</span></div></div>
      <div className="space-y-1"><div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden"><div className={`h-full rounded-full transition-all ${isGoalAchieved ? 'bg-emerald-500' : 'bg-stone-400'}`} style={{ width: `${Math.min(100, progressPercent)}%` }} /></div><div className="flex justify-between text-[11px] text-stone-400"><span>0원</span><span>달성률 {progressPercent}%</span><span>{formatCurrencyKRW(monthGoal)}</span></div></div>
    </button>

    <div className="grid grid-cols-3 gap-2"><div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100"><div className="text-[10px] text-emerald-700">저축</div><div className="text-sm font-black text-emerald-800 mt-0.5">{formatCurrencyKRW(monthTotal)}</div></div><div className="p-3 bg-stone-100 rounded-2xl border border-stone-200"><div className="text-[10px] text-stone-500">지출</div><div className="text-sm font-black text-stone-800 mt-0.5">{formatCurrencyKRW(monthExpenseTotal)}</div></div><div className="p-3 bg-white rounded-2xl border border-stone-200"><div className="text-[10px] text-stone-500">수입</div><div className="text-sm font-black text-stone-800 mt-0.5">{formatCurrencyKRW(monthIncomeTotal)}</div></div></div>

    <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-600" />저축 내역 ({monthRecords.length}건)</h2><span className="text-[10px] text-stone-400">개별 기록</span></div>
      {monthRecords.length === 0 ? <div className="text-center py-8 text-stone-400"><AlertCircle className="w-7 h-7 mx-auto mb-2 text-stone-300" /><p className="text-xs">기록된 저축 내역이 없습니다.</p></div> : <div className="divide-y divide-stone-100">{monthRecords.map((rec) => <div key={rec.id} className="py-3 px-1 flex items-center justify-between"><div className="min-w-0"><div className="text-xs font-bold text-stone-800 truncate">{rec.memo}</div><div className="text-[11px] text-stone-400">{formatDateKorean(rec.date)}</div></div><div className="text-right shrink-0 ml-3"><div className="text-sm font-black text-emerald-700">+{formatCurrencyKRW(rec.amount)}</div><div className="text-[10px] text-stone-400">+{LevelCalculator.savingsToXp(rec.amount)} XP</div></div></div>)}</div>}
    </div>

    <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-stone-600" />지출 내역 ({expenses.length}건)</h2><span className="text-[10px] text-stone-400">개별 기록</span></div>
      {expenses.length === 0 ? <div className="text-center py-8 text-stone-400"><p className="text-xs">기록된 지출 내역이 없습니다.</p></div> : <div className="divide-y divide-stone-100">{expenses.map((tx) => <div key={tx.id} className="py-3 px-1 flex items-center justify-between"><div className="min-w-0"><div className="text-xs font-bold text-stone-800 truncate">{tx.memo}</div><div className="text-[11px] text-stone-400">{formatDateKorean(tx.date)}</div></div><div className="text-sm font-black text-stone-700 shrink-0 ml-3">-{formatCurrencyKRW(Math.abs(tx.amount))}</div></div>)}</div>}
    </div>
  </div>;
};
