import React, { useEffect, useState } from 'react';
import { Cloud, ExternalLink, FileSpreadsheet, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { clearSheetsConnection, connectGoogleSheets, getLastSyncInfo, getSavedSheetsUrl, syncAllToGoogleSheets } from '../data/googleSheets';
import { clearGoogleToken, getGoogleClientId } from '../data/googleAuth';
import { StorageRepository } from '../data/storage';

interface GoogleSheetsModalProps { isOpen: boolean; onClose: () => void; }

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({ isOpen, onClose }) => {
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<{ time: string | null; status: string | null }>({ time: null, status: null });
  const hasClientId = Boolean(getGoogleClientId());

  useEffect(() => {
    if (!isOpen) return;
    setSpreadsheetUrl(getSavedSheetsUrl());
    setLastSync(getLastSyncInfo());
    setMessage(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const syncNow = async () => {
    setIsSyncing(true);
    setMessage(null);
    try {
      const records = StorageRepository.getAllRecords();
      const goals = StorageRepository.getAllGoalKeys().reduce((acc, key) => {
        acc[key] = StorageRepository.getMonthlyGoal(key);
        return acc;
      }, {} as Record<string, number>);
      const success = await syncAllToGoogleSheets(records, goals, StorageRepository.getSettings());
      setLastSync(getLastSyncInfo());
      setMessage(success ? 'Google Sheets에 최신 로컬 데이터를 백업했습니다.' : '백업에 실패했습니다. 저축 데이터는 이 기기에 그대로 남아 있습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google Sheets 백업에 실패했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnect = async () => {
    if (!hasClientId) {
      setMessage('앱 배포 설정에 VITE_GOOGLE_CLIENT_ID가 필요합니다.');
      return;
    }
    setIsConnecting(true);
    setMessage(null);
    try {
      const result = await connectGoogleSheets();
      setSpreadsheetUrl(result.spreadsheetUrl);
      setMessage('내 Google Drive에 「저축 게임 데이터」를 만들고 연결했습니다.');
      await syncNow();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google 연결에 실패했습니다.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearSheetsConnection();
    clearGoogleToken();
    setSpreadsheetUrl('');
    setLastSync({ time: null, status: null });
    setMessage('Google Sheets 연결을 해제했습니다. 로컬 데이터는 삭제되지 않습니다.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><FileSpreadsheet className="w-4 h-4" /></div>
            <div><h2 className="text-base sm:text-lg font-black text-stone-900">Google Sheets 백업</h2><p className="text-[11px] text-stone-500">내 Google Drive에 저장하는 개인 백업</p></div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-600">백업 상태</span>
            {spreadsheetUrl ? <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full text-[11px]"><ShieldCheck className="w-3 h-3" /> 연결됨</span> : <span className="font-semibold text-stone-600 bg-stone-200/80 px-2 py-0.5 rounded-full text-[11px]">로컬 저장만 사용</span>}
          </div>
          {spreadsheetUrl && <button type="button" onClick={() => window.open(spreadsheetUrl, '_blank', 'noopener,noreferrer')} className="w-full flex items-center justify-between gap-2 text-[11px] text-stone-600 bg-white border border-stone-200 rounded-xl px-3 py-2 hover:bg-stone-50"><span className="truncate font-medium">내 Google Sheets: 저축 게임 데이터</span><ExternalLink className="w-3 h-3 shrink-0" /></button>}
          {lastSync.time && <div className="text-[11px] text-stone-500 pt-1 border-t border-stone-200/60">최근 백업: <span className="text-stone-700 font-medium">{lastSync.time}</span></div>}
        </div>

        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 space-y-3">
          <div className="flex items-start gap-2"><Cloud className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" /><div><p className="text-xs font-black text-stone-900">처음 한 번만 연결</p><p className="text-[11px] leading-relaxed text-stone-600 mt-0.5">Google 계정 접근을 승인하면 Google Sheets API로 개인 스프레드시트를 만들고 이후 같은 파일에 동기화합니다.</p></div></div>
          <button type="button" onClick={handleConnect} disabled={isConnecting} className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"><Cloud className={`w-3.5 h-3.5 ${isConnecting ? 'animate-pulse' : ''}`} />{isConnecting ? 'Google Sheets 연결 중...' : spreadsheetUrl ? 'Google 계정 다시 연결' : 'Google 계정 연결'}</button>
          {!hasClientId && <p className="text-[10px] text-amber-800">앱 배포 설정에 VITE_GOOGLE_CLIENT_ID가 필요합니다.</p>}
        </div>

        {message && <div className="text-[11px] text-stone-700 font-semibold bg-stone-50 p-3 rounded-xl border border-stone-200 whitespace-pre-line">{message}</div>}
        {spreadsheetUrl && <div className="space-y-2"><button type="button" onClick={syncNow} disabled={isSyncing} className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"><RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />{isSyncing ? '전체 데이터 백업 중...' : '지금 전체 데이터 백업'}</button><button type="button" onClick={handleDisconnect} className="w-full py-2 text-[11px] font-semibold text-stone-500 hover:text-stone-800">연결 해제</button></div>}

        <div className="p-3 rounded-2xl border border-stone-200 bg-white text-[11px] leading-relaxed text-stone-500"><p className="font-bold text-stone-700 mb-1">구조</p><p>저축 데이터는 먼저 기기에 저장됩니다. Google Sheets 백업은 선택 사항이며 서버, Firebase, Apps Script를 거치지 않습니다.</p><p className="mt-1">Google Cloud에는 Google Sheets API와 OAuth 설정만 필요합니다.</p></div>
      </div>
    </div>
  );
};
