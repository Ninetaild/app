import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Award,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Edit3,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { SavingRecord } from '../types';
import {
  StorageRepository,
  getCurrentMonthKey,
  formatCurrencyKRW,
  formatDateKorean,
  formatMonthDisplay,
} from '../data/storage';
import { LevelCalculator } from '../domain/levelCalculator';

interface HistoryScreenProps {
  onEditRecord: (record: SavingRecord) => void;
  onOpenAddModal?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  onEditRecord,
  onOpenAddModal,
}) => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(getCurrentMonthKey());
  const [allRecords, setAllRecords] = useState<SavingRecord[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  const loadData = () => {
    const records = StorageRepository.getAllRecords();
    setAllRecords(records);

    // Extract all unique months from records + goals + current month
    const monthsSet = new Set<string>();
    monthsSet.add(getCurrentMonthKey());

    records.forEach((r) => {
      const m = r.date.substring(0, 7);
      if (m) monthsSet.add(m);
    });

    StorageRepository.getAllGoalKeys().forEach((m) => monthsSet.add(m));

    const sortedMonths = Array.from(monthsSet).sort().reverse();
    setAvailableMonths(sortedMonths);

    // If current selected month is not in available, select first
    if (!monthsSet.has(selectedMonthKey) && sortedMonths.length > 0) {
      setSelectedMonthKey(sortedMonths[0]);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = StorageRepository.subscribe(loadData);
    return () => unsubscribe();
  }, []);

  const monthRecords = allRecords.filter((r) => r.date.startsWith(selectedMonthKey));
  const monthTotal = monthRecords.reduce((sum, r) => sum + r.amount, 0);
  const monthGoal = StorageRepository.getMonthlyGoal(selectedMonthKey);
  const isGoalAchieved = monthGoal > 0 && monthTotal >= monthGoal;
  const progressRatio = monthGoal > 0 ? monthTotal / monthGoal : 0;
  const progressPercent = Math.round(progressRatio * 100);

  // Month navigation (Previous / Next)
  const currentIndex = availableMonths.indexOf(selectedMonthKey);
  const handlePrevMonth = () => {
    if (currentIndex < availableMonths.length - 1) {
      setSelectedMonthKey(availableMonths[currentIndex + 1]);
    }
  };
  const handleNextMonth = () => {
    if (currentIndex > 0) {
      setSelectedMonthKey(availableMonths[currentIndex - 1]);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="pt-1 pb-1">
        <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
          저축 히스토리
        </h1>
      </div>

      {/* Month Selector Bar */}
      <div className="flex items-center justify-between p-2.5 bg-white rounded-2xl border border-stone-200 shadow-2xs">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={currentIndex >= availableMonths.length - 1}
          className="p-2 text-stone-500 hover:text-stone-900 disabled:text-stone-300 disabled:cursor-not-allowed rounded-lg hover:bg-stone-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <select
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="font-bold text-stone-800 text-sm bg-transparent outline-hidden cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthDisplay(m)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          disabled={currentIndex <= 0}
          className="p-2 text-stone-500 hover:text-stone-900 disabled:text-stone-300 disabled:cursor-not-allowed rounded-lg hover:bg-stone-100 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Monthly Summary Card */}
      <div className="p-5 bg-white rounded-3xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-500">
            {formatMonthDisplay(selectedMonthKey)} 종합
          </span>
          {isGoalAchieved ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              목표 달성 완료!
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 text-stone-600 text-xs font-semibold rounded-full">
              진행률 {progressPercent}%
            </span>
          )}
        </div>

        {/* Numbers Comparison */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-[11px] text-stone-500 block mb-0.5">총 저축액</span>
            <span className="text-lg font-black text-emerald-700">
              {formatCurrencyKRW(monthTotal)}
            </span>
          </div>
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-[11px] text-stone-500 block mb-0.5">저축 목표</span>
            <span className="text-lg font-black text-stone-800">
              {formatCurrencyKRW(monthGoal)}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1 pt-1">
          <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isGoalAchieved ? 'bg-emerald-500' : 'bg-stone-400'
              }`}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-stone-400">
            <span>0원</span>
            <span>달성률 {progressPercent}%</span>
            <span>{formatCurrencyKRW(monthGoal)}</span>
          </div>
        </div>
      </div>

      {/* Monthly Records List */}
      <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            저축 내역 ({monthRecords.length}건)
          </h2>
          <span className="text-xs text-stone-400">항목 터치 시 수정/삭제</span>
        </div>

        {monthRecords.length === 0 ? (
          <div className="text-center py-10 text-stone-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-stone-300" />
            <p className="text-xs font-semibold text-stone-500">기록된 저축 내역이 없습니다.</p>
            <p className="text-[11px] text-stone-400 mt-1">
              이 달에 저축한 금액이 있다면 지금 기록해 보세요!
            </p>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
            >
              저축 기록 추가하기
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {monthRecords.map((rec) => (
              <div
                key={rec.id}
                onClick={() => onEditRecord(rec)}
                className="py-3 px-2 flex items-center justify-between hover:bg-stone-50 active:bg-stone-100/70 rounded-xl cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold">
                      {rec.date.split('-')[2] || '일'}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      {rec.memo}
                      <Edit3 className="w-3 h-3 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {formatDateKorean(rec.date)}
                    </div>
                  </div>
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
    </div>
  );
};
