import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  Award,
  ChevronRight,
  Sparkles,
  Calendar,
  CheckCircle2,
  X,
  ArrowUpRight,
  Check,
  ExternalLink,
  Gift,
} from 'lucide-react';
import { SavingRecord, AppSettings, AppTechItem } from '../types';
import {
  StorageRepository,
  getCurrentMonthKey,
  formatCurrencyKRW,
  formatDateKorean,
} from '../data/storage';
import { LevelCalculator } from '../domain/levelCalculator';
import { AppTechRepository } from '../data/xmlParser';

interface HomeScreenProps {
  onOpenAddModal: () => void;
  onEditRecord: (record: SavingRecord) => void;
  onNavigateTab: (tab: 'home' | 'record' | 'history') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenAddModal,
  onEditRecord,
  onNavigateTab,
}) => {
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(getCurrentMonthKey());
  const [settings, setSettings] = useState<AppSettings>(StorageRepository.getSettings());
  const [records, setRecords] = useState<SavingRecord[]>([]);
  const [monthlyTarget, setMonthlyTarget] = useState<number>(1500000);
  const [showProposalBanner, setShowProposalBanner] = useState<boolean>(false);
  const [proposalData, setProposalData] = useState<{
    prevMonthName: string;
    prevTarget: number;
    suggestedTarget: number;
    prevMonthKey: string;
  } | null>(null);

  // Payday direct input state
  const [isEditingPayday, setIsEditingPayday] = useState<boolean>(false);
  const [paydayInput, setPaydayInput] = useState<string>(String(settings.payday || 25));
  const paydayInputRef = useRef<HTMLInputElement>(null);

  // Monthly target inline editing state
  const [isEditingTarget, setIsEditingTarget] = useState<boolean>(false);
  const [targetInput, setTargetInput] = useState<string>('');
  const targetInputRef = useRef<HTMLInputElement>(null);

  // GitHub XML recommendation item (랜덤 1개)
  const [randomAppTech, setRandomAppTech] = useState<AppTechItem | null>(null);

  const loadData = () => {
    const monthKey = getCurrentMonthKey();
    setCurrentMonthKey(monthKey);
    const loadedSettings = StorageRepository.getSettings();
    setSettings(loadedSettings);
    setPaydayInput(String(loadedSettings.payday || 25));
    setRecords(StorageRepository.getRecordsForMonth(monthKey));
    const target = StorageRepository.getMonthlyGoal(monthKey);
    setMonthlyTarget(target);
    setTargetInput(new Intl.NumberFormat('ko-KR').format(target));

    // Check Previous Month Goal Achievement for Next Month Proposal (요구사항 10번)
    checkPreviousMonthProposal(monthKey);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = StorageRepository.subscribe(loadData);
    return () => unsubscribe();
  }, []);

  // Fetch GitHub XML AppTech items and pick 1 random item
  useEffect(() => {
    let isMounted = true;
    const fetchRandomXmlItem = async () => {
      try {
        const result = await AppTechRepository.fetchAppTechItems(settings.customXmlUrl);
        const activeItems = result.items.filter((item) => item.isActive);
        if (activeItems.length > 0 && isMounted) {
          const randomIndex = Math.floor(Math.random() * activeItems.length);
          setRandomAppTech(activeItems[randomIndex]);
        }
      } catch (err) {
        console.warn('Failed to fetch XML apptech item:', err);
      }
    };
    fetchRandomXmlItem();
    return () => {
      isMounted = false;
    };
  }, [settings.customXmlUrl]);

  const checkPreviousMonthProposal = (monthKey: string) => {
    const [year, month] = monthKey.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    const prevMonthKey = `${prevYear}-${prevMonth}`;

    const appSettings = StorageRepository.getSettings();
    // 이미 이 제안을 확인했는지 체크
    if (appSettings.dismissedNextMonthProposals.includes(prevMonthKey)) {
      setShowProposalBanner(false);
      return;
    }

    const prevGoal = StorageRepository.getMonthlyGoal(prevMonthKey);
    const prevTotalSaved = StorageRepository.getTotalSavingsForMonth(prevMonthKey);

    // 지난달 저축액이 지난달 목표 이상인 경우 제안 배너 표시
    if (prevTotalSaved >= prevGoal && prevGoal > 0) {
      const suggested = LevelCalculator.suggestNextMonthGoal(prevGoal);
      setProposalData({
        prevMonthName: `${prevYear}년 ${parseInt(prevMonth, 10)}월`,
        prevTarget: prevGoal,
        suggestedTarget: suggested,
        prevMonthKey,
      });
      setShowProposalBanner(true);
    } else {
      setShowProposalBanner(false);
    }
  };

  const handleAcceptProposal = () => {
    if (!proposalData) return;
    StorageRepository.setMonthlyGoal(currentMonthKey, proposalData.suggestedTarget);
    setMonthlyTarget(proposalData.suggestedTarget);
    setTargetInput(new Intl.NumberFormat('ko-KR').format(proposalData.suggestedTarget));

    const updatedDismissed = [...settings.dismissedNextMonthProposals, proposalData.prevMonthKey];
    StorageRepository.saveSettings({ dismissedNextMonthProposals: updatedDismissed });
    setShowProposalBanner(false);
  };

  const handleDeclineProposal = () => {
    if (!proposalData) return;
    const updatedDismissed = [...settings.dismissedNextMonthProposals, proposalData.prevMonthKey];
    StorageRepository.saveSettings({ dismissedNextMonthProposals: updatedDismissed });
    setShowProposalBanner(false);
  };

  // Payday change handler (strictly integer 1 ~ 31)
  const handlePaydayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw === '') {
      setPaydayInput('');
      return;
    }
    const val = parseInt(raw, 10);
    if (val >= 1 && val <= 31) {
      setPaydayInput(String(val));
    }
  };

  const handleSavePayday = () => {
    let day = parseInt(paydayInput, 10);
    if (isNaN(day) || day < 1) day = 1;
    if (day > 31) day = 31;
    setPaydayInput(String(day));
    StorageRepository.saveSettings({ payday: day });
    setIsEditingPayday(false);
  };

  // Monthly Target save handler
  const handleStartEditingTarget = () => {
    setTargetInput(new Intl.NumberFormat('ko-KR').format(monthlyTarget));
    setIsEditingTarget(true);
    setTimeout(() => {
      targetInputRef.current?.focus();
      targetInputRef.current?.select();
    }, 50);
  };

  const handleTargetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw === '') {
      setTargetInput('');
      return;
    }
    const num = parseInt(raw, 10);
    setTargetInput(new Intl.NumberFormat('ko-KR').format(num));
  };

  const handleSaveTarget = () => {
    const raw = targetInput.replace(/[^0-9]/g, '');
    let amount = parseInt(raw, 10);
    if (isNaN(amount) || amount <= 0) {
      amount = 1500000;
    }
    StorageRepository.setMonthlyGoal(currentMonthKey, amount);
    StorageRepository.saveSettings({ defaultMonthlyTarget: amount });
    setMonthlyTarget(amount);
    setTargetInput(new Intl.NumberFormat('ko-KR').format(amount));
    setIsEditingTarget(false);
  };

  // Calculations
  const currentMonthSaved = records.reduce((sum, r) => sum + r.amount, 0);
  const progressRatio = monthlyTarget > 0 ? currentMonthSaved / monthlyTarget : 0;
  const progressPercent = Math.min(100, Math.round(progressRatio * 100));

  const totalAccumulatedSavings = StorageRepository.getTotalAccumulatedSavings();
  const levelInfo = LevelCalculator.calculateLevelInfo(totalAccumulatedSavings);

  const [yearStr, monthStr] = currentMonthKey.split('-');
  const monthNum = parseInt(monthStr, 10);

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header Card: Month & Payday input */}
      <div className="flex items-center justify-between pt-1 pb-1">
        <div>
          <div className="flex items-center gap-1.5 text-stone-500 text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5" />
            <span>저축 현황</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            {yearStr}년 {monthNum}월
          </h1>
        </div>
        <div className="text-right">
          {isEditingPayday ? (
            <div className="inline-flex items-center gap-1 bg-stone-200/90 border border-emerald-500 rounded-full px-2.5 py-0.5 shadow-2xs animate-in fade-in zoom-in-95 duration-150">
              <span className="text-xs font-semibold text-stone-700 pl-0.5">월급일</span>
              <input
                ref={paydayInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={paydayInput}
                onChange={handlePaydayChange}
                onBlur={handleSavePayday}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePayday();
                  if (e.key === 'Escape') {
                    setPaydayInput(String(settings.payday || 25));
                    setIsEditingPayday(false);
                  }
                }}
                autoFocus
                placeholder="25"
                className="w-7 text-center text-xs font-bold text-stone-900 bg-white border border-stone-300 rounded px-0.5 py-0.5 outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-xs font-semibold text-stone-700">일</span>
              <button
                type="button"
                onClick={handleSavePayday}
                className="p-0.5 text-emerald-700 hover:text-emerald-800 cursor-pointer ml-0.5 transition-colors"
                title="저장"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPaydayInput(String(settings.payday || 25));
                setIsEditingPayday(true);
                setTimeout(() => {
                  paydayInputRef.current?.focus();
                  paydayInputRef.current?.select();
                }, 50);
              }}
              className="inline-flex items-center gap-1 bg-stone-200/70 hover:bg-stone-300/80 active:scale-95 px-3 py-1 rounded-full text-xs font-semibold text-stone-700 hover:text-stone-900 transition-all cursor-pointer shadow-2xs"
              title="클릭하여 월급일 수정"
            >
              <span>월급일</span>
              <span className="font-bold text-stone-900">{settings.payday || 25}일</span>
            </button>
          )}
        </div>
      </div>

      {/* Next Month Goal Suggestion Proposal Card (요구사항 10번) */}
      <AnimatePresence>
        {showProposalBanner && proposalData && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            className="p-4 bg-gradient-to-br from-emerald-500/10 via-teal-50 to-amber-50/50 rounded-3xl border border-emerald-200 shadow-xs relative overflow-hidden"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500 text-white rounded-2xl shrink-0 mt-0.5 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h2 className="text-sm font-bold text-stone-900">
                  {proposalData.prevMonthName} 목표 달성 완료! 🎉
                </h2>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  지난달 멋지게 목표를 달성하셨어요! 이번 달에는 조금만 더 저축해 볼까요?
                </p>
                <div className="mt-2.5 py-2 px-3 bg-white/80 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                  <span className="text-stone-500">
                    기존 {formatCurrencyKRW(proposalData.prevTarget)}
                  </span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    제안 {formatCurrencyKRW(proposalData.suggestedTarget)}
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded-full">
                      +5만원
                    </span>
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptProposal}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    수락 (+5만원 목표 상향)
                  </button>
                  <button
                    type="button"
                    onClick={handleDeclineProposal}
                    className="py-2 px-3 bg-stone-200/80 hover:bg-stone-300 text-stone-700 text-xs font-semibold rounded-xl transition-colors"
                  >
                    기존 목표 유지
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDeclineProposal}
              className="absolute top-3 right-3 p-1 text-stone-400 hover:text-stone-600 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Savings Progress Card */}
      <div className="p-5 sm:p-6 bg-white rounded-3xl border border-stone-200 shadow-sm relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
            이번 달 저축 진행률
          </span>
          <span
            className={`px-2.5 py-0.5 text-xs font-black rounded-full ${
              progressPercent >= 100
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-stone-100 text-stone-700'
            }`}
          >
            {progressPercent}% 달성
          </span>
        </div>

        {/* Big Savings Amount numbers with inline target editor */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            {formatCurrencyKRW(currentMonthSaved)}
          </span>

          <span className="text-sm sm:text-base font-semibold text-stone-400">/</span>

          {isEditingTarget ? (
            <div className="inline-flex items-center gap-1 bg-stone-50 border border-emerald-500 rounded-xl px-2 py-1 shadow-2xs">
              <input
                ref={targetInputRef}
                type="text"
                value={targetInput}
                onChange={handleTargetInputChange}
                onBlur={handleSaveTarget}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTarget();
                  if (e.key === 'Escape') {
                    setTargetInput(new Intl.NumberFormat('ko-KR').format(monthlyTarget));
                    setIsEditingTarget(false);
                  }
                }}
                className="w-28 sm:w-32 text-sm sm:text-base font-bold text-stone-900 bg-white border border-stone-300 rounded-lg px-2 py-0.5 outline-hidden focus:ring-1 focus:ring-emerald-500 text-right"
                placeholder="목표 금액"
              />
              <span className="text-xs font-bold text-stone-600">원</span>
              <button
                type="button"
                onClick={handleSaveTarget}
                className="p-1 text-emerald-700 hover:text-emerald-800 cursor-pointer"
                title="저장"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartEditingTarget}
              className="inline-flex items-center text-sm sm:text-base font-semibold text-stone-500 hover:text-emerald-700 bg-stone-100/70 hover:bg-emerald-50 px-2 py-1 rounded-xl transition-all cursor-pointer border border-transparent hover:border-emerald-200"
              title="클릭하여 목표 금액 변경"
            >
              <span>{formatCurrencyKRW(monthlyTarget)}</span>
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-stone-100 rounded-full h-3.5 p-0.5 overflow-hidden border border-stone-200/70">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, progressRatio * 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              progressPercent >= 100
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-xs'
                : 'bg-emerald-500'
            }`}
          />
        </div>

        {/* Remaining amount status */}
        <div className="flex items-center justify-between text-xs text-stone-500 mt-2.5">
          <span>
            {monthlyTarget > currentMonthSaved
              ? `목표까지 ${formatCurrencyKRW(monthlyTarget - currentMonthSaved)} 남았어요`
              : '🎉 이번 달 목표 금액을 모두 채웠습니다!'}
          </span>
        </div>
      </div>

      {/* Level & XP Status Card */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/70 via-stone-50 to-emerald-50/40 rounded-3xl border border-stone-200/80 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-900 flex items-center justify-center font-black text-lg border border-amber-300 shadow-xs shrink-0">
            Lv.{levelInfo.level}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-stone-800">
                {levelInfo.title}
              </h2>
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              {levelInfo.currentLevelXp.toLocaleString()} / {levelInfo.xpForNextLevel.toLocaleString()} XP
              <span className="text-[11px] text-stone-400 ml-1">
                (누적 {formatCurrencyKRW(levelInfo.totalAccumulatedSavings)})
              </span>
            </div>
            {/* Tiny XP progress bar */}
            <div className="w-32 sm:w-44 bg-stone-200/80 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.round(levelInfo.levelProgressRatio * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-1 rounded-lg">
            1만원 = 10 XP
          </span>
        </div>
      </div>

      {/* Recent Savings Snippet (최근 기록 3개) */}
      <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            이번 달 저축 내역
          </h2>
          <button
            type="button"
            onClick={() => onNavigateTab('history')}
            className="text-xs font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-0.5 cursor-pointer"
          >
            전체보기
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-6 text-stone-400">
            <p className="text-xs font-medium">이번 달 아직 등록된 저축 기록이 없어요.</p>
            <p className="text-[11px] text-stone-400 mt-1">
              하단 가운데 [+] 저축 버튼을 눌러 첫 저축을 시작해 보세요!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.slice(0, 3).map((rec) => (
              <div
                key={rec.id}
                onClick={() => onEditRecord(rec)}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-stone-50 active:bg-stone-100 border border-transparent hover:border-stone-200 cursor-pointer transition-all"
              >
                <div>
                  <div className="text-xs font-bold text-stone-800">{rec.memo}</div>
                  <div className="text-[11px] text-stone-400">{formatDateKorean(rec.date)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-emerald-700">
                    +{formatCurrencyKRW(rec.amount)}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    +{LevelCalculator.savingsToXp(rec.amount)} XP
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GitHub XML recommendation item (이번 달 저축 내역 아래 작게 유지, 랜덤 1개) */}
      {randomAppTech && (
        <div className="p-3.5 bg-stone-50/90 hover:bg-stone-100/90 border border-stone-200/90 rounded-2xl transition-all shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Gift className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-stone-800 truncate">
                    {randomAppTech.name}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                    {randomAppTech.category}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate mt-0.5 max-w-[240px] sm:max-w-md">
                  {randomAppTech.description}
                </p>
              </div>
            </div>

            {randomAppTech.referralUrl && (
              <a
                href={randomAppTech.referralUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-stone-200/80 text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                title="바로가기"
              >
                <span>이동</span>
                <ExternalLink className="w-3 h-3 text-stone-400" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

