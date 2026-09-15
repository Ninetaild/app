import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  Gift,
  PiggyBank,
  WalletCards,
} from 'lucide-react';
import { motion } from 'motion/react';
import { SavingRecord, AppSettings, AppTechItem } from '../types';
import { StorageRepository, getCurrentMonthKey, formatCurrencyKRW, formatDateKorean } from '../data/storage';
import { LevelCalculator } from '../domain/levelCalculator';
import { AppTechRepository } from '../data/xmlParser';
import { CycleTransaction, CycleTransactionType, CycleStorage, getCycleForDate, getPreviousDate, getCycleSettlementAmount } from '../data/cycleStorage';

interface HomeScreenProps {
  onOpenAddModal: (type?: CycleTransactionType) => void;
  onEditRecord: (record: SavingRecord) => void;
  onNavigateTab: (tab: 'home' | 'record' | 'history') => void;
}

const money = (value: number) => formatCurrencyKRW(Math.max(0, Math.round(value)));

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenAddModal, onEditRecord, onNavigateTab }) => {
  const [settings, setSettings] = useState<AppSettings>(StorageRepository.getSettings());
  const [records, setRecords] = useState<SavingRecord[]>([]);
  const [transactions, setTransactions] = useState<CycleTransaction[]>([]);
  const [randomAppTech, setRandomAppTech] = useState<AppTechItem | null>(null);

  const loadData = () => {
    setSettings(StorageRepository.getSettings());
    setRecords(StorageRepository.getAllRecords());
    setTransactions(CycleStorage.getAllTransactions());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = StorageRepository.subscribe(loadData);
    const cycleUnsubscribe = CycleStorage.subscribe(loadData);
    return () => { unsubscribe(); cycleUnsubscribe(); };
  }, []);

  useEffect(() => {
    let mounted = true;
    AppTechRepository.fetchAppTechItems(settings.customXmlUrl).then((result) => {
      const active = result.items.filter((item) => item.isActive && item.name && item.description);
      if (mounted && active.length) setRandomAppTech(active[Math.floor(Math.random() * active.length)]);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [settings.customXmlUrl]);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`, [today]);
  const payday = settings.payday || 25;
  const cycle = useMemo(() => getCycleForDate(today, payday), [today, payday]);
  const cycleRecords = useMemo(() => records.filter((r) => r.date >= cycle.startDate && r.date < cycle.endDate), [records, cycle]);
  const cycleTransactions = useMemo(() => transactions.filter((t) => t.date >= cycle.startDate && t.date < cycle.endDate), [transactions, cycle]);

  // 지출은 저장 시 음수로 보관하지만 화면에서는 소비액을 양수로 표시한다.
  const salary = cycleTransactions.filter((t) => t.type === 'salary').reduce((s, t) => s + Math.max(0, t.amount), 0);
  const extraIncome = cycleTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + Math.max(0, t.amount), 0);
  const spending = cycleTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  const saved = cycleRecords.reduce((s, r) => s + Math.max(0, r.amount), 0);
  const totalIncome = salary + extraIncome;
  const available = Math.max(0, totalIncome - saved - spending);

  // 전체 파이는 '급여 + 수입' 100%를 기준으로 하고, 그 안에서 저축/소비/빈 파이를 나눈다.
  const savedPct = totalIncome > 0 ? Math.min(100, (saved / totalIncome) * 100) : 0;
  const spentPct = totalIncome > 0 ? Math.min(Math.max(0, 100 - savedPct), (spending / totalIncome) * 100) : 0;
  const remainingPct = Math.max(0, 100 - savedPct - spentPct);
  const hasSalary = salary > 0;

  // 급여일 당일에는 직전 급여 주기의 '빈 파이'를 자동으로 저축 파이로 이동한다.
  useEffect(() => {
    if (todayKey !== cycle.startDate) return;
    const previousCycle = getCycleForDate(getPreviousDate(today), payday);
    if (CycleStorage.hasSettled(previousCycle.startDate)) return;

    const amount = getCycleSettlementAmount(previousCycle, records, transactions);
    if (amount > 0) {
      StorageRepository.saveRecord({ amount, date: todayKey, memo: '급여일 직전 잔액 자동 저축' });
    }
    CycleStorage.markSettled(previousCycle.startDate);
  }, [cycle.startDate, payday, records, today, todayKey, transactions]);

  const totalAccumulatedSavings = StorageRepository.getTotalAccumulatedSavings();
  const levelInfo = LevelCalculator.calculateLevelInfo(totalAccumulatedSavings);
  const currentMonthKey = getCurrentMonthKey();
  const [yearStr, monthStr] = currentMonthKey.split('-');

  const transactionRows = [
    ...cycleTransactions.map((t) => ({ id: t.id, date: t.date, memo: t.memo, amount: t.amount, type: t.type })),
    ...cycleRecords.map((r) => ({ id: r.id, date: r.date, memo: r.memo, amount: r.amount, type: 'saving' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between pt-1 pb-1">
        <div>
          <div className="flex items-center gap-1.5 text-stone-500 text-xs font-semibold"><Calendar className="w-3.5 h-3.5" /><span>급여 주기 현황</span></div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">{yearStr}년 {parseInt(monthStr, 10)}월</h1>
          <p className="text-[11px] text-stone-400 mt-0.5">{formatDateKorean(cycle.startDate)} ~ {formatDateKorean(cycle.endDate)} 전날</p>
        </div>
        <button type="button" onClick={() => onOpenAddModal('salary')} className="inline-flex items-center gap-1.5 bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 border border-stone-200 hover:border-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"><WalletCards className="w-3.5 h-3.5" />월급일 {payday}일</button>
      </div>

      <div className="p-5 sm:p-6 bg-white rounded-3xl border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-4"><div><div className="text-xs font-bold text-stone-400 uppercase tracking-wider">전체 파이 · 급여 + 수입</div><div className="text-2xl sm:text-3xl font-black text-stone-900 mt-1">{money(totalIncome)}</div></div><div className="text-right"><div className="text-[11px] text-stone-400">현재 남은 금액</div><div className="text-lg font-black text-emerald-700">{money(available)}</div></div></div>
        <div className="w-full h-8 rounded-full bg-stone-100 border border-stone-200 overflow-hidden flex" title="급여 + 수입을 100%로 본 돈의 흐름">
          {savedPct > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${savedPct}%` }} className="h-full bg-emerald-500" title="저축 파이" />}
          {spentPct > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${spentPct}%` }} className="h-full bg-stone-400" title="소비 파이" />}
          {remainingPct > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${remainingPct}%` }} className="h-full bg-stone-100" title="빈 파이" />}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-stone-400"><span>저축 {Math.round(savedPct)}%</span><span className="text-center">소비 {Math.round(spentPct)}%</span><span className="text-right">빈 파이 {Math.round(remainingPct)}%</span></div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-100"><div className="text-[10px] text-emerald-700 font-semibold">저축 파이</div><div className="text-sm font-black text-emerald-800 mt-0.5">{money(saved)}</div></div>
          <div className="p-2.5 rounded-2xl bg-stone-100 border border-stone-200"><div className="text-[10px] text-stone-500 font-semibold">소비 파이</div><div className="text-sm font-black text-stone-800 mt-0.5">{money(spending)}</div></div>
          <div className="p-2.5 rounded-2xl bg-white border border-stone-200"><div className="text-[10px] text-stone-400 font-semibold">빈 파이</div><div className="text-sm font-black text-stone-900 mt-0.5">{money(available)}</div></div>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={() => onOpenAddModal('saving')} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"><PiggyBank className="w-4 h-4" />고정 저축</button><button onClick={() => onOpenAddModal('expense')} className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold flex items-center justify-center gap-1.5"><ArrowDownRight className="w-4 h-4" />소비</button><button onClick={() => onOpenAddModal('income')} className="flex-1 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-stone-700 border border-stone-200 hover:border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5"><ArrowUpRight className="w-4 h-4 text-emerald-600" />수입</button></div>
        {!hasSalary && <button onClick={() => onOpenAddModal('salary')} className="w-full mt-2.5 py-2.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 text-emerald-800 text-xs font-bold">급여일에 이번 급여를 먼저 입력해 주세요</button>}
      </div>

      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/70 via-stone-50 to-emerald-50/40 rounded-3xl border border-stone-200/80 shadow-xs flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-900 flex items-center justify-center font-black text-lg border border-amber-300 shrink-0">Lv.{levelInfo.level}</div><div><h2 className="text-sm font-bold text-stone-800">{levelInfo.title}</h2><div className="text-xs text-stone-500 mt-0.5">{levelInfo.currentLevelXp.toLocaleString()} / {levelInfo.xpForNextLevel.toLocaleString()} XP</div><div className="w-32 sm:w-44 bg-stone-200/80 h-1.5 rounded-full mt-1.5 overflow-hidden"><div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.round(levelInfo.levelProgressRatio * 100)}%` }} /></div></div></div><span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-1 rounded-lg shrink-0">누적 {money(levelInfo.totalAccumulatedSavings)}</span></div>

      <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5"><CircleDollarSign className="w-4 h-4 text-emerald-600" />최근 돈의 흐름</h2><button onClick={() => onNavigateTab('history')} className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-0.5">전체보기<ChevronRight className="w-3.5 h-3.5" /></button></div>{transactionRows.length === 0 ? <div className="text-center py-5 text-stone-400 text-xs">아직 기록이 없어요. 급여부터 입력해 보세요.</div> : <div className="space-y-1.5">{transactionRows.map((row) => <div key={row.id} onClick={() => row.type === 'saving' && onEditRecord(records.find((r) => r.id === row.id)!)} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-50 cursor-pointer"><div className="flex items-center gap-2 min-w-0"><div className={`w-7 h-7 rounded-lg flex items-center justify-center ${row.type === 'expense' ? 'bg-stone-100 text-stone-600' : 'bg-emerald-50 text-emerald-700'}`}>{row.type === 'expense' ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}</div><div className="min-w-0"><div className="text-xs font-bold text-stone-800 truncate">{row.memo}</div><div className="text-[10px] text-stone-400">{formatDateKorean(row.date)}</div></div></div><div className={`text-xs font-black ${row.type === 'expense' ? 'text-stone-700' : 'text-emerald-700'}`}>{row.type === 'expense' ? '-' : '+'}{money(Math.abs(row.amount))}</div></div>)}</div>}</div>

      {randomAppTech && (randomAppTech.referralUrl ? <a href={randomAppTech.referralUrl} target="_blank" rel="noopener noreferrer" className="block p-3.5 bg-stone-50/90 border border-stone-200/90 rounded-2xl shadow-2xs hover:bg-amber-50/50 hover:border-amber-200 transition-colors"><div className="flex items-start gap-2"><div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0"><Gift className="w-3.5 h-3.5" /></div><div className="min-w-0"><div className="text-xs font-bold text-stone-800">{randomAppTech.name}</div><p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{randomAppTech.description}</p><span className="inline-block mt-1 text-[10px] font-semibold text-amber-700">추천 앱 자세히 보기 ↗</span></div></div></a> : <div className="p-3.5 bg-stone-50/90 border border-stone-200/90 rounded-2xl shadow-2xs"><div className="flex items-start gap-2"><div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0"><Gift className="w-3.5 h-3.5" /></div><div className="min-w-0"><div className="text-xs font-bold text-stone-800">{randomAppTech.name}</div><p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{randomAppTech.description}</p></div></div></div>)}
    </div>
  );
};
