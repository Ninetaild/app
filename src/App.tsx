import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Maximize2,
  ShieldCheck,
  PiggyBank,
  FileSpreadsheet,
} from 'lucide-react';
import { NavigationTab, SavingRecord, AppSettings } from './types';
import { StorageRepository } from './data/storage';
import { Navigation } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { SavingRecordModal } from './components/SavingRecordModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [settings, setSettings] = useState<AppSettings>(StorageRepository.getSettings());
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [recordToEdit, setRecordToEdit] = useState<SavingRecord | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);

  // Initialize storage listeners on load
  useEffect(() => {
    setSettings(StorageRepository.getSettings());

    const unsubscribe = StorageRepository.subscribe(() => {
      setSettings(StorageRepository.getSettings());
    });
    return () => unsubscribe();
  }, []);

  const handleOpenAddModal = () => {
    setRecordToEdit(null);
    setModalOpen(true);
  };

  const handleEditRecord = (record: SavingRecord) => {
    setRecordToEdit(record);
    setModalOpen(true);
  };

  const handleSaved = () => {
    // refresh
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 flex flex-col items-center">
      {/* Top Application Control Bar */}
      <header className="w-full bg-white border-b border-stone-200 px-4 py-2.5 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-stone-900 tracking-tight">
                  저축 가계부
                </span>
                <button
                  type="button"
                  onClick={() => setIsSheetsModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-200 transition-colors cursor-pointer"
                  title="Google Sheets 자동 백업 설정"
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                  <span>{settings.googleSheetsUrl ? '시트 백업 연동됨' : '시트 자동 백업'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Phone frame toggle for testing */}
            <button
              type="button"
              onClick={() => setIsPhoneFrame(!isPhoneFrame)}
              className="px-2.5 py-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title={isPhoneFrame ? '전체 화면으로 확장' : '모바일 폰 프레임으로 보기'}
            >
              {isPhoneFrame ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">넓게 보기</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">스마트폰 뷰</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Viewport Container */}
      <main
        className={`w-full flex-1 transition-all duration-300 ${
          isPhoneFrame
            ? 'max-w-md my-0 sm:my-4 sm:rounded-[36px] bg-white sm:border sm:border-stone-200 sm:shadow-xl sm:overflow-hidden min-h-[calc(100vh-60px)] sm:min-h-[760px] flex flex-col'
            : 'max-w-3xl my-0 sm:my-6 px-4'
        }`}
      >
        {/* Mobile Status Bar Simulation (visible in phone frame on larger screens) */}
        {isPhoneFrame && (
          <div className="hidden sm:flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold text-stone-400 select-none">
            <span>2026.09.14</span>
            <div className="w-20 h-3.5 bg-stone-900 rounded-full mx-auto" />
            <span>100% 🔋</span>
          </div>
        )}

        {/* Scrollable View Content */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto">
          {currentTab === 'home' && (
            <HomeScreen
              onOpenAddModal={handleOpenAddModal}
              onEditRecord={handleEditRecord}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'history' && (
            <HistoryScreen
              onEditRecord={handleEditRecord}
              onOpenAddModal={handleOpenAddModal}
            />
          )}
        </div>
      </main>

      {/* Bottom Navigation Bar: Home, Record (+), History */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onQuickAdd={handleOpenAddModal}
      />

      {/* Saving Record Add/Edit Modal */}
      <SavingRecordModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setRecordToEdit(null);
        }}
        recordToEdit={recordToEdit}
        onSaved={handleSaved}
      />

      {/* Google Sheets Auto-Sync Settings & Guide Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
      />
    </div>
  );
}

