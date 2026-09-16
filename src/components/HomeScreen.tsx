import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Calendar, ChevronRight, CircleDollarSign, Gift, PiggyBank, WalletCards, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { SavingRecord, AppSettings, AppTechItem } from '../types';
import { StorageRepository, formatCurrencyKRW, formatDateKorean } from '../data/storage';
import { LevelCalculator } from '../domain/levelCalculator';
import { AppTechRepository } from '../data/xmlParser';
import { CycleTransaction, CycleTransactionType, CycleStorage, getCycleForDate, getPreviousDate, dateKey } from '../data/cycleStorage';

interface HomeScreenProps { onOpenAddModal: (type?: CycleTransactionType) => void; onEditRecord: (record: SavingRecord) => void; onEditTransaction: (transaction: CycleTransaction) => void; onNavigateTab: (tab: 'home' | 'record' | 'history') => void; }
const money = (value: number) => formatCurrencyKRW(Math.max(0, Math.round(value)));
const FALLBACK_APP: AppTechItem = { id: 'saving-app', name: '오늘의 절약 앱 추천', description: '걷기·출석·미션으로 포인트를 모아 생활비 절약에 활용해 보세요.', category: '절약', referralCode: '', url: '', referralUrl: '', isActive: true };
const RANK_EMOJI: Record<number, string> = { 0: '⚪', 1: '🥉', 2: '🥈', 3: '🥇', 4: '🏆', 5: '💎', 6: '👑' };

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenAddModal, onEditRecord, onEditTransaction, onNavigateTab }) => {
  const [settings, setSettings] = useState<AppSettings>(StorageRepository.getSettings());
  const [records, setRecords] = useState<SavingRecord[]>([]);
  const [transactions, setTransactions] = useState<CycleTransaction[]>([]);
  const [randomAppTech, setRandomAppTech] = useState<AppTechItem>(FALLBACK_APP);
  const loadData = () => { setSettings(StorageRepository.getSettings()); setRecords(StorageRepository.getAllRecords()); setTransactions(CycleStorage.getAllTransactions()); };
  useEffect(() => { loadData(); const a = StorageRepository.subscribe(loadData); const b = CycleStorage.subscribe(loadData); return () => { a(); b(); }; }, []);
  useEffect(() => { let mounted = true; const url = settings.customXmlUrl || undefined; AppTechRepository.fetchAppTechItems(url ? `${url}${url.includes('?') ? '&' : '?'}_refresh=${Date.now()}` : undefined).then((result) => { const active = result.items.filter((item) => item.isActive && item.name && item.description); if (mounted && active.length) setRandomAppTech(active[Math.floor(Math.random() * active.length)]); }).catch(() => { if (mounted) setRandomAppTech(FALLBACK_APP); }); return () => { mounted = false; }; }, [settings.customXmlUrl]);

  const today = useMemo(() => new Date(), []);
  const payday = Number.isInteger(settings.payday) && settings.payday >= 1 && settings.payday <= 31 ? settings.payday : 25;
  const cycle = useMemo(() => getCycleForDate(today, payday), [today, payday]);
  const cycleTransactions = useMemo(() => transactions.filter((t) => t.date >= cycle.startDate && t.date < cycle.endDate), [transactions, cycle]);
  const totalIncome = cycleTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + Math.max(0, t.amount), 0);
  const spending = cycleTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  // 진행 중인 급여기간은 사용자가 입력한 저축을 고정 저축 파이로 사용합니다. 수입과 저축은 동일하지 않습니다.
  const fixedSaving = records.filter((r) => r.date >= cycle.startDate && r.date < cycle.endDate).reduce((sum, r) => sum + Math.max(0, r.amount), 0);
  const fixedSavingForPie = totalIncome > 0 ? Math.min(totalIncome, fixedSaving) : 0;
  const spendingForPie = totalIncome > 0 ? Math.min(Math.max(0, totalIncome - fixedSavingForPie), spending) : 0;
  const savedPct = totalIncome > 0 ? (fixedSavingForPie / totalIncome) * 100 : 0;
  const spentPct = totalIncome > 0 ? (spendingForPie / totalIncome) * 100 : 0;

  const currentYear = today.getFullYear();
  const yearTransactions = useMemo(() => transactions.filter((t) => t.date.startsWith(`${currentYear}-`)), [transactions, currentYear]);
  const annualIncome = yearTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + Math.max(0, t.amount), 0);
  const annualExpense = yearTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const annualSavings = Math.max(0, annualIncome - annualExpense);
  const rankInfo = LevelCalculator.calculateLevelInfo(annualSavings);
  const rankEmoji = RANK_EMOJI[Math.min(6, Math.max(0, rankInfo.level))] || '⚪';
  const monthLabel = `${Number(cycle.startDate.slice(5, 7))}월`;
  const cycleEndDisplay = dateKey(getPreviousDate(new Date(`${cycle.endDate}T00:00:00`))).slice(5).replace('-', '/');
  const transactionRows = [...cycleTransactions.map((t) => ({ id: t.id, date: t.date, memo: t.memo, amount: t.amount, type: t.type as CycleTransactionType })), ...records.filter((r) => r.date >= cycle.startDate && r.date < cycle.endDate).map((r) => ({ id: r.id, date: r.date, memo: r.memo, amount: r.amount, type: 'saving' as const }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const segment = (width: number, className: string) => width > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${width}%` }} className={`h-full transition-[filter] hover:brightness-95 ${className}`} />;

  const changePayday = () => { const input = window.prompt('급여일을 1~31의 정수로 입력하세요.', String(payday)); if (input === null) return; if (!/^([1-9]|[12]\d|3[01])$/.test(input.trim())) return alert('급여일은 1~31의 정수만 입력할 수 있습니다.'); StorageRepository.saveSettings({ payday: Number(input.trim()) }); };
  const editRow = (row: typeof transactionRows[number]) => { if (row.type === 'saving') { const record = records.find((r) => r.id === row.id); if (record) onEditRecord(record); } else { const transaction = transactions.find((t) => t.id === row.id); if (transaction) onEditTransaction(transaction); } };
  const deleteRow = (row: typeof transactionRows[number]) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return;
    if (row.type === 'saving') StorageRepository.deleteRecord(row.id); else CycleStorage.deleteTransaction(row.id);
  };

  return <div className="space-y-4 pb-20">
    <div className="flex items-center justify-between pt-1 pb-1"><div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-stone-500" /><div><h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">{monthLabel}</h1><div className="text-[10px] text-stone-400 font-semibold">{cycle.startDate.slice(5).replace('-', '/')} ~ {cycleEndDisplay}</div></div></div><button type="button" onClick={changePayday} className="inline-flex items-center gap-1.5 bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 border border-stone-200 hover:border-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"><WalletCards className="w-3.5 h-3.5" />급여일 {payday}일</button></div>

    <div className="p-5 sm:p-6 bg-white rounded-3xl border border-stone-200 shadow-sm">
      <div className="flex items-center justify-between mb-4"><div><div className="text-xs font-bold text-stone-400 uppercase tracking-wider">이번 급여기간 · 수입</div><div className="text-2xl sm:text-3xl font-black text-stone-900 mt-1">{money(totalIncome)}</div></div><div className="text-right"><div className="text-[11px] text-stone-400">현재 저축</div><div className="text-lg font-black text-emerald-700">{money(fixedSaving)}</div></div></div>
      <div className="relative"><div className="w-full h-8 rounded-full bg-stone-100 border border-stone-200 overflow-hidden flex">{segment(savedPct, 'bg-emerald-500')}{segment(spentPct, 'bg-stone-400')}</div></div>
      <div className="grid grid-cols-2 gap-2 mt-3"><div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-100"><div className="text-[10px] text-emerald-700 font-semibold">저축</div><div className="text-sm font-black text-emerald-800 mt-0.5">{money(fixedSaving)}</div></div><div className="p-2.5 rounded-2xl bg-stone-100 border border-stone-200"><div className="text-[10px] text-stone-500 font-semibold">소비</div><div className="text-sm font-black text-stone-800 mt-0.5">{money(spending)}</div></div></div>
      <div className="grid grid-cols-3 gap-2 mt-4"><button onClick={() => onOpenAddModal('saving')} className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1"><PiggyBank className="w-4 h-4" />저축</button><button onClick={() => onOpenAddModal('income')} className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1"><WalletCards className="w-4 h-4" />수입</button><button onClick={() => onOpenAddModal('expense')} className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold flex items-center justify-center gap-1"><ArrowDownRight className="w-4 h-4" />소비</button></div>
    </div>

    <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/70 via-stone-50 to-emerald-50/40 rounded-3xl border border-stone-200/80 shadow-xs flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><div className="w-14 h-12 rounded-2xl bg-amber-400/20 text-amber-900 flex items-center justify-center font-black text-2xl border border-amber-300 shrink-0" title={rankInfo.title}>{rankEmoji}</div><div className="min-w-0"><h2 className="text-sm font-bold text-stone-800">연간 랭크</h2><div className="text-xs text-stone-500 mt-0.5">{rankInfo.currentLevelXp.toLocaleString()} / {rankInfo.xpForNextLevel.toLocaleString()} XP</div><div className="w-32 sm:w-44 bg-stone-200/80 h-1.5 rounded-full mt-1.5 overflow-hidden"><div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.round(rankInfo.levelProgressRatio * 100)}%` }} /></div></div></div><span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-1 rounded-lg shrink-0">{currentYear}년 {money(annualSavings)}</span></div>

    <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5"><CircleDollarSign className="w-4 h-4 text-emerald-600" />최근 돈의 흐름</h2><button onClick={() => onNavigateTab('history')} className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-0.5">전체보기<ChevronRight className="w-3.5 h-3.5" /></button></div>{transactionRows.length === 0 ? <div className="text-center py-5 text-stone-400 text-xs">아직 기록이 없어요. 수입부터 입력해 보세요.</div> : <div className="space-y-1.5">{transactionRows.map((row) => <div key={row.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-50"><div className="flex items-center gap-2 min-w-0"><div className={`w-7 h-7 rounded-lg flex items-center justify-center ${row.type === 'expense' ? 'bg-stone-100 text-stone-600' : 'bg-emerald-50 text-emerald-700'}`}>{row.type === 'expense' ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}</div><div className="min-w-0"><div className="text-xs font-bold text-stone-800 truncate">{row.memo}</div><div className="text-[10px] text-stone-400">{formatDateKorean(row.date)}</div></div></div><div className="flex items-center gap-1 shrink-0"><div className={`text-xs font-black mr-1 ${row.type === 'expense' ? 'text-stone-700' : 'text-emerald-700'}`}>{row.type === 'expense' ? '-' : '+'}{money(Math.abs(row.amount))}</div><button type="button" onClick={() => editRow(row)} className="p-1.5 text-stone-400 hover:text-emerald-700 rounded-lg hover:bg-emerald-50" aria-label="항목 수정"><Pencil className="w-3.5 h-3.5" /></button><button type="button" onClick={() => deleteRow(row)} className="p-1.5 text-stone-300 hover:text-rose-600 rounded-lg hover:bg-rose-50" aria-label="항목 삭제"><Trash2 className="w-3.5 h-3.5" /></button></div></div>)}</div>}</div>

    <a href={randomAppTech.url || randomAppTech.referralUrl || '#'} target={(randomAppTech.url || randomAppTech.referralUrl) ? '_blank' : undefined} rel={(randomAppTech.url || randomAppTech.referralUrl) ? 'noopener noreferrer' : undefined} onClick={(e) => { if (!(randomAppTech.url || randomAppTech.referralUrl)) e.preventDefault(); }} className="block p-4 bg-gradient-to-r from-amber-50 via-white to-emerald-50 border border-amber-200 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-300 transition-all"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0"><Gift className="w-4 h-4" /></div><div className="min-w-0 flex-1"><div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">오늘의 추천 앱</div><div className="text-sm font-black text-stone-900 mt-0.5">{randomAppTech.name}</div><p className="text-[11px] text-stone-600 mt-1 leading-relaxed">{randomAppTech.description}</p>{(randomAppTech.url || randomAppTech.referralUrl) && <span className="inline-block mt-1.5 text-[10px] font-bold text-amber-700">앱 자세히 보기 ↗</span>}</div></div></a>
  </div>;
};
