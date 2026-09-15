import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Calendar, Tag, Plus, Check } from 'lucide-react';
import { SavingRecord } from '../types';
import { StorageRepository } from '../data/storage';
import confetti from 'canvas-confetti';

interface SavingRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordToEdit?: SavingRecord | null;
  onSaved?: () => void;
}

export const SavingRecordModal: React.FC<SavingRecordModalProps> = ({
  isOpen,
  onClose,
  recordToEdit,
  onSaved,
}) => {
  const [amount, setAmount] = useState<number>(100000);
  const [amountInputStr, setAmountInputStr] = useState<string>('100,000');
  const [date, setDate] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize or reset form values
  useEffect(() => {
    if (isOpen) {
      if (recordToEdit) {
        setAmount(recordToEdit.amount);
        setAmountInputStr(new Intl.NumberFormat('ko-KR').format(recordToEdit.amount));
        setDate(recordToEdit.date);
        setMemo(recordToEdit.memo);
      } else {
        // New record default to today
        const today = new Date().toISOString().split('T')[0];
        setAmount(100000);
        setAmountInputStr('100,000');
        setDate(today);
        setMemo('월급 저축');
      }
      setShowDeleteConfirm(false);
    }
  }, [isOpen, recordToEdit]);

  const handleAmountChange = (raw: string) => {
    // Remove non-digits
    const digitsOnly = raw.replace(/\D/g, '');
    const num = digitsOnly ? parseInt(digitsOnly, 10) : 0;
    setAmount(num);
    setAmountInputStr(num > 0 ? new Intl.NumberFormat('ko-KR').format(num) : '');
  };

  const addQuickAmount = (val: number) => {
    const next = amount + val;
    setAmount(next);
    setAmountInputStr(new Intl.NumberFormat('ko-KR').format(next));
  };

  const handleClearAmount = () => {
    setAmount(0);
    setAmountInputStr('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('저축 금액을 0원보다 크게 입력해주세요.');
      return;
    }

    StorageRepository.saveRecord({
      id: recordToEdit ? recordToEdit.id : undefined,
      amount,
      date: date || new Date().toISOString().split('T')[0],
      memo: memo.trim() || '저축',
    });

    // Celebration confetti for recording savings!
    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10B981', '#34D399', '#FBBF24', '#F472B6'],
      });
    } catch {
      // ignore
    }

    if (onSaved) onSaved();
    onClose();
  };

  const handleDelete = () => {
    if (!recordToEdit) return;
    StorageRepository.deleteRecord(recordToEdit.id);
    if (onSaved) onSaved();
    onClose();
  };

  if (!isOpen) return null;

  const quickAmounts = [
    { label: '+1만', value: 10000 },
    { label: '+5만', value: 50000 },
    { label: '+10만', value: 100000 },
    { label: '+50만', value: 500000 },
  ];

  const memoSuggestions = ['월급 저축', '부수입 저축', '커피값 아껴서', '비상금 적립', '당근마켓 판매'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/70">
          <div>
            <h2 className="text-base font-bold text-stone-800">
              {recordToEdit ? '저축 기록 수정' : '저축 기록하기'}
            </h2>
            <p className="text-xs text-stone-500">
              {recordToEdit ? '기록된 저축 내역을 수정합니다.' : '오늘의 저축을 차곡차곡 기록해 보세요.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">
              저축 금액 (원)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-lg">
                ₩
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amountInputStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className="w-full pl-9 pr-14 py-3 bg-stone-50 hover:bg-stone-100/70 focus:bg-white text-stone-900 text-2xl font-bold rounded-2xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-hidden transition-all text-right"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 text-sm font-semibold">
                원
              </span>
            </div>

            {/* Quick addition chips */}
            <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
              {quickAmounts.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => addQuickAmount(chip.value)}
                  className="px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:scale-95 border border-emerald-200 rounded-lg transition-all shrink-0"
                >
                  {chip.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearAmount}
                className="px-2 py-1 text-xs font-medium text-stone-500 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors shrink-0 ml-auto"
              >
                초기화
              </button>
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-stone-500" />
              날짜
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm font-medium focus:border-emerald-500 focus:bg-white outline-hidden transition-colors"
            />
          </div>

          {/* Memo Input & Suggestions */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 mb-1.5">
              <Tag className="w-3.5 h-3.5 text-stone-500" />
              메모
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 월급 저축, 커피값 아껴서"
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm focus:border-emerald-500 focus:bg-white outline-hidden transition-colors"
            />
            {/* Memo chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {memoSuggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setMemo(sug)}
                  className="px-2 py-0.5 text-[11px] text-stone-600 bg-stone-100 hover:bg-stone-200/80 rounded-md transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            {recordToEdit && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-3 text-rose-600 hover:bg-rose-50 active:scale-95 border border-rose-200 rounded-2xl transition-all shrink-0"
                title="기록 삭제"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-sm shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <Check className="w-5 h-5" />
              {recordToEdit ? '수정 완료' : '저축 기록 저장'}
            </button>
          </div>
        </form>

        {/* Delete Confirmation Overlay */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="p-4 bg-rose-50 border-t border-rose-200 flex items-center justify-between"
            >
              <div className="text-xs text-rose-800">
                <p className="font-bold">이 저축 기록을 삭제하시겠어요?</p>
                <p className="text-[11px] text-rose-600">삭제 시 이번 달 저축액과 경험치가 차감됩니다.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs text-white bg-rose-600 hover:bg-rose-700 font-bold rounded-lg transition-colors"
                >
                  삭제 확인
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
