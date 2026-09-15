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
import { motion, AnimatePresence } from 'motion/react';
import { SavingRecord, AppSettings, AppTechItem } from '../types';
import { StorageRepository, getCurrentMonthKey, formatCurrencyKRW, formatDateKorean } from '../data/storage';
import { LevelCalculator } from '../domain/levelCalculator';
import { AppTechRepository } from '../data/xmlParser';
import { CycleTransaction, CycleTransactionType, CycleStorage, getCycleForDate, getNextPayday, getPreviousDate } from '../data/cycleStorage';

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
  const [settlement, setSettlement] = useState<{ cycleStart: string; amount: number } | null>(null);

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
      const active = result.items.filter((item) => item.isActive);
      if (mounted && active.length) setRandomAppTech(active[Math.floor(Math.random() * active.length)]);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [settings.customXmlUrl]);

  const today = useMemo(() => new Date(), []);
  const cycle = useMemo(() => getCycleForDate(today, settings.payday || 25), [today, settings.payday]);
  const cycleRecords = useMemo(() => records.filter((r) => r.date >= cycle.startDate && r.date < cycle.endDate), [records, cycle]);
  const cycleTransactions = useMemo(() => transactions.filter((t) => t.date >= cycle.startDate && t.date < cycle.endDate), [transactions, cycle]);

  const salary = cycleTransactions.filter((t) => t.type === 'salary').reduce((s, t) => s + t.amount, 0);
  const extraIncome = cycleTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const spending = cycleTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const saved = cycleRecords.reduce((s, r) => s + r.amount, 0);
  const totalIncome = salary + extraIncome;
  const available = Math.max(0, totalIncome - saved - spending);
  const denominator = Math.max(totalIncome, saved + spending, 1);
  const savedPct = Math.min(100, (saved / denominator) * 100);
  const spentPct = Math.min(100 - savedPct, (spending / denominator) * 100);
  const remainingPct = Math.max(0, 100 - savedPct - spentPct);
  const hasSalary = salary > 0;

  const totalAccumulatedSavings = StorageRepository.getTotalAccumulatedSavings();
  const levelInfo = LevelCalculator.calculateLevelInfo(totalAccumulatedSavings);
  const currentMonthKey = getCurrentMonthKey();
  const [yearStr, monthStr] = currentMonthKey.split('-');

  useEffect(() => {
    const nextPayday = getNextPayday(today, settings.payday || 25);
    const yesterday = getPreviousDate(nextPayday);
    const isEve = yesterday.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
    if (!isEve || available <= 0 || !hasSalary || CycleStorage.hasSettled(cycle.startDate)) {
      setSettlement(null);
      return;
    }
    setSettlement({ cycleStart: cycle.startDate, amount: available });
  }, [available, cycle.startDate, hasSalary, settings.payday, today]);

  const handleSettlement = () => {
    if (!settlement) return;
    StorageRepository.saveRecord({ amount: settlement.amount, date: today.toISOString().slice(0, 10), memo: '급여 전날 잔액 저축' });
    CycleStorage.markSettled(settlement.cycleStart);
    setSettlement(null);
  };

  const handleSkipSettlement = () => {
    if (!settlement) return;
    CycleStorage.markSettled(settlement.cycleStart);
    setSettlement(null);
  };

  const transactionRows = [
    ...cycleTransactions.map((t) => ({ id: t.id, date: t.date, memo: t.memo, amount: t.amount, type: t.type })),
    ...cycleRecords.map((r) => ({ id: r.id, date: r.date, memo: r.memo, amount: r.amount, type: 'saving' as CycleTransactionType })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between pt-1 pb-1">
        <div>
          <div className="flex items-center gap-1.5 text-stone-500 text-xs font-semibold"><Calendar className="w-3.5 h-3.5" /><span>급여 주기 현황</span></div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">{yearStr}년 {parseInt(monthStr, 10)}월</h1>
          <p className="text-[11px] text-stone-400 mt-0.5">{formatDateKorean(cycle.startDate)} ~ {formatDateKorean(cycle.endDate)} 전날</p>
        </div>
        <button type="button" onClick={() => onOpenAddModal('salary')} className="inline-flex items-center gap-1.5 bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 border border-stone-200 hover:border-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"><WalletCards className="w-3.5 h-3.5" />월급일 {settings.payday || 25}일</button>
      </div>

      <AnimatePresence>
        {settlement && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><PiggyBank className="w-5 h-5" /></div><div className="flex-1 min-w-0"><h2 className="text-sm font-black text-stone-900">급여 전날 정산 🎯</h2><p className="text-xs text-stone-600 mt-1">남은 {money(settlement.amount)}을 저축으로 기록할까요?</p><div className="flex gap-2 mt-3"><button onClick={handleSettlement} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">남은 금액 저축</button><button onClick={handleSkipSettlement} className="px-3 py-2 bg-white border border-stone-200 text-stone-600 rounded-xl text-xs font-semibold">이번엔 건너뛰기</button></div></div></div>
        </motion.div>}
      </AnimatePresence>

      <div className="p-5 sm:p-6 bg-white rounded-3xl border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-4"><div><div className="text-xs font-bold text-stone-400 uppercase tracking-wider">이번 급여 + 수입</div><div className="text-2xl sm:text-3xl font-black text-stone-900 mt-1">{money(totalIncome)}</div></div><div className="text-right"><div className="text-[11px] text-stone-400">현재 남은 금액</div><div className="text-lg font-black text-emerald-700">{money(available)}</div></div></div>
        <div className="w-full h-7 rounded-full bg-stone-100 border border-stone-200 overflow-hidden flex">
          {savedPct > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${savedPct}%` }} className="h-full bg-emerald-500" title="저축" />}
          {spentPct > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${spentPct}%` }} className="h-full bg-stone-400" title="소비" />}
          {remainingPct > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${remainingPct}%` }} className="h-full bg-stone-100" title="남은 금액" />}
        </div>
        <div className="flex justify-between text-[10px] text-stone-400 mt-1.5"><span>저축</span><span>소비</span><span>남음</span></div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-100"><div className="text-[10px] text-emerald-700 font-semibold">저축</div><div className="text-sm font-black text-emerald-800 mt-0.5">{money(saved)}</div></div>
          <div className="p-2.5 rounded-2xl bg-stone-100 border border-stone-200"><div className="text-[10px] text-stone-500 font-semibold">소비</div><div className="text-sm font-black text-stone-800 mt-0.5">{money(spending)}</div></div>
          <div className="p-2.5 rounded-2xl bg-white border border-stone-200"><div className="text-[10px] text-stone-400 font-semibold">남음</div><div className="text-sm font-black text-stone-900 mt-0.5">{money(available)}</div></div>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={() => onOpenAddModal('saving')} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"><PiggyBank className="w-4 h-4" />고정 저축</button><button onClick={() => onOpenAddModal('expense')} className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold flex items-center justify-center gap-1.5"><ArrowDownRight className="w-4 h-4" />소비</button><button onClick={() => onOpenAddModal('income')} className="flex-1 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-stone-700 border border-stone-200 hover:border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5"><ArrowUpRight className="w-4 h-4 text-emerald-600" />수입</button></div>
        {!hasSalary && <button onClick={() => onOpenAddModal('salary')} className="w-full mt-2.5 py-2.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 text-emerald-800 text-xs font-bold">급여일에 이번 급여를 먼저 입력해 주세요</button>}
      </div>

      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/70 via-stone-50 to-emerald-50/40 rounded-3xl border border-stone-200/80 shadow-xs flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-900 flex items-center justify-center font-black text-lg border border-amber-300 shrink-0">Lv.{levelInfo.level}</div><div><h2 className="text-sm font-bold text-stone-800">{levelInfo.title}</h2><div className="text-xs text-stone-500 mt-0.5">{levelInfo.currentLevelXp.toLocaleString()} / {levelInfo.xpForNextLevel.toLocaleString()} XP</div><div className="w-32 sm:w-44 bg-stone-200/80 h-1.5 rounded-full mt-1.5 overflow-hidden"><div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.round(levelInfo.levelProgressRatio * 100)}%` }} /></div></div></div><span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-1 rounded-lg shrink-0">누적 {money(levelInfo.totalAccumulatedSavings)}</span></div>

      <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5"><CircleDollarSign className="w-4 h-4 text-emerald-600" />최근 돈의 흐름</h2><button onClick={() => onNavigateTab('history')} className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-0.5">전체보기<ChevronRight className="w-3.5 h-3.5" /></button></div>{transactionRows.length === 0 ? <div className="text-center py-5 text-stone-400 text-xs">아직 기록이 없어요. 급여부터 입력해 보세요.</div> : <div className="space-y-1.5">{transactionRows.map((row) => <div key={row.id} onClick={() => row.type === 'saving' && onEditRecord(records.find((r) => r.id === row.id)!)} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-50 cursor-pointer"><div className="flex items-center gap-2 min-w-0"><div className={`w-7 h-7 rounded-lg flex items-center justify-center ${row.type === 'expense' ? 'bg-stone-100 text-stone-600' : 'bg-emerald-50 text-emerald-700'}`}>{row.type === 'expense' ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}</div><div className="min-w-0"><div className="text-xs font-bold text-stone-800 truncate">{row.memo}</div><div className="text-[10px] text-stone-400">{formatDateKorean(row.date)}</div></div></div><div className={`text-xs font-black ${row.type === 'expense' ? 'text-stone-700' : 'text-emerald-700'}`}>{row.type === 'expense' ? '-' : '+'}{money(row.amount)}</div></div>)}</div>}</div>

      {randomAppTech && <div className="p-3.5 bg-stone-50/90 border border-stone-200/90 rounded-2xl shadow-2xs"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 min-w-0"><div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0"><Gift className="w-3.5 h-3.5" /></div><div className="min-w-0"><div className="text-xs font-bold text-stone-800 truncate">{randomAppTech.name}</div><p className="text-[11px] text-stone-500 truncate mt-0.5">{randomAppTech.description}</p></div></div>{randomAppTech.referralUrl && <a href={randomAppTech.referralUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 px-2.5 py-1 bg-white text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold">이동</a>}</div></div>}
    </div>
  );
};
