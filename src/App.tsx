import React, { useState, useEffect } from 'react';
import { Smartphone, Maximize2, PiggyBank, FileSpreadsheet } from 'lucide-react';
import { NavigationTab, SavingRecord, AppSettings } from './types';
import { StorageRepository } from './data/storage';
import { Navigation } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { SavingRecordModal } from './components/SavingRecordModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { CycleTransaction, CycleTransactionType } from './data/cycleStorage';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [settings, setSettings] = useState<AppSettings>(StorageRepository.getSettings());
  const [isPhoneFrame, setIsPhoneFrame] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<CycleTransactionType>('saving');
  const [recordToEdit, setRecordToEdit] = useState<SavingRecord | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<CycleTransaction | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);

  useEffect(() => { setSettings(StorageRepository.getSettings()); return StorageRepository.subscribe(() => setSettings(StorageRepository.getSettings())); }, []);
  const handleOpenAddModal = (type: CycleTransactionType = 'saving') => { setRecordToEdit(null); setTransactionToEdit(null); setModalType(type); setModalOpen(true); };
  const handleEditRecord = (record: SavingRecord) => { setRecordToEdit(record); setTransactionToEdit(null); setModalType('saving'); setModalOpen(true); };
  const handleEditTransaction = (transaction: CycleTransaction) => { setTransactionToEdit(transaction); setRecordToEdit(null); setModalType(transaction.type); setModalOpen(true); };

  return <div className="min-h-screen bg-stone-100 text-stone-800 flex flex-col items-center">
    <header className="w-full bg-white border-b border-stone-200 px-4 py-2.5 sticky top-0 z-30 shadow-2xs"><div className="max-w-4xl mx-auto flex items-center justify-between"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><PiggyBank className="w-5 h-5" /></div><div className="flex items-center gap-2"><span className="font-black text-sm text-stone-900">저축 가계부</span><button onClick={() => setIsSheetsModalOpen(true)} className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><FileSpreadsheet className="w-3 h-3" />{settings.googleSheetsUrl ? '시트 백업' : '시트 백업'}</button></div></div><button onClick={() => setIsPhoneFrame(!isPhoneFrame)} className="px-2.5 py-1 text-xs font-semibold text-stone-600 bg-stone-100 rounded-xl flex items-center gap-1.5">{isPhoneFrame ? <><Maximize2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">넓게 보기</span></> : <><Smartphone className="w-3.5 h-3.5 text-emerald-600" /><span className="hidden sm:inline">스마트폰 뷰</span></>}</button></div></header>
    <main className={`w-full flex-1 ${isPhoneFrame ? 'max-w-md my-0 sm:my-4 sm:rounded-[36px] bg-white sm:border sm:border-stone-200 sm:shadow-xl sm:overflow-hidden min-h-[calc(100vh-60px)] sm:min-h-[760px] flex flex-col' : 'max-w-3xl my-0 sm:my-6 px-4'}`}>
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto">{currentTab === 'home' && <HomeScreen onOpenAddModal={handleOpenAddModal} onEditRecord={handleEditRecord} onEditTransaction={handleEditTransaction} onNavigateTab={setCurrentTab} />}{currentTab === 'history' && <HistoryScreen />}</div>
    </main>
    <Navigation currentTab={currentTab} onSelectTab={setCurrentTab} />
    <SavingRecordModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setRecordToEdit(null); setTransactionToEdit(null); }} recordToEdit={recordToEdit} transactionToEdit={transactionToEdit} onSaved={() => {}} cycleTransactionType={modalType} />
    <GoogleSheetsModal isOpen={isSheetsModalOpen} onClose={() => setIsSheetsModalOpen(false)} />
  </div>;
}
