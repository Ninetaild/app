import React, { useEffect, useState } from 'react';
import { ExternalLink, FileSpreadsheet, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { backupToGoogleSheets, clearSheetsConnection, getLastSyncInfo, getSavedSheetsUrl } from '../data/googleSheets';
import { restoreFromGoogleSheets } from '../data/googleSheetsRestore';
import { clearGoogleToken, getGoogleClientId } from '../data/googleAuth';
import { StorageRepository } from '../data/storage';

interface GoogleSheetsModalProps { isOpen: boolean; onClose: () => void; }

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({ isOpen, onClose }) => {
  const [savedUrl, setSavedUrl] = useState('');
  const [restoreUrl, setRestoreUrl] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<{ time: string | null; status: string | null }>({ time: null, status: null });

  useEffect(() => {
    if (!isOpen) return;
    const url = getSavedSheetsUrl();
    setSavedUrl(url);
    setRestoreUrl('');
    setLastSync(getLastSyncInfo());
    setMessage(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const backupNow = async () => {
    if (!getGoogleClientId()) { setMessage('앱 배포 설정에 VITE_GOOGLE_CLIENT_ID가 필요합니다.'); return; }
    setIsBackingUp(true); setMessage(null);
    try {
      const records = StorageRepository.getAllRecords();
      const goals = StorageRepository.getAllGoalKeys().reduce((acc, key) => { acc[key] = StorageRepository.getMonthlyGoal(key); return acc; }, {} as Record<string, number>);
      const success = await backupToGoogleSheets(records, goals, StorageRepository.getSettings());
      const url = getSavedSheetsUrl();
      setSavedUrl(url);
      setLastSync(getLastSyncInfo());
      setMessage(success ? 'Google Sheets에 현재 기기 데이터를 백업했습니다.' : '백업에 실패했습니다. 데이터는 이 기기에 그대로 남아 있습니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Google Sheets 백업에 실패했습니다.'); }
    finally { setIsBackingUp(false); }
  };

  const restoreNow = async () => {
    const value = restoreUrl.trim();
    if (!/^https?:\/\/(www\.)?docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+(?:[/?#].*)?$/i.test(value)) {
      setMessage('Google Sheets 주소 형식을 확인해 주세요.'); return;
    }
    if (!getGoogleClientId()) { setMessage('앱 배포 설정에 VITE_GOOGLE_CLIENT_ID가 필요합니다.'); return; }
    if (!window.confirm('현재 이 기기의 데이터를 Sheets 백업 내용으로 교체합니다. 계속하시겠습니까?')) return;
    setIsRestoring(true); setMessage(null);
    try {
      await restoreFromGoogleSheets(value);
      setMessage('Google Sheets 데이터를 복구했습니다. 앱을 새로고침합니다.');
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Google Sheets 복구에 실패했습니다.'); }
    finally { setIsRestoring(false); }
  };

  const disconnect = () => {
    clearSheetsConnection(); clearGoogleToken(); setSavedUrl(''); setLastSync({ time: null, status: null });
    setMessage('저장된 Sheets 연결 정보를 지웠습니다. 로컬 데이터는 삭제되지 않습니다.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><FileSpreadsheet className="w-4 h-4" /></div><div><h2 className="text-base sm:text-lg font-black text-stone-900">Google Sheets 백업</h2><p className="text-[11px] text-stone-500">필요할 때만 직접 백업합니다</p></div></div>
          <button type="button" onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 space-y-3">
          <div><p className="text-xs font-black text-stone-900">Google Sheets에 백업하기</p><p className="text-[11px] leading-relaxed text-stone-600 mt-0.5">백업하기를 누르면 Google 계정으로 인증한 뒤 새 Google Sheets를 만들고 현재 데이터를 기록합니다.</p></div>
          <button type="button" onClick={backupNow} disabled={isBackingUp || isRestoring} className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"><RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />{isBackingUp ? '백업 중...' : '백업하기'}</button>
          <p className="text-[10px] text-stone-500">Google 로그인이나 데이터 변경만으로는 자동 백업하지 않습니다.</p>
        </div>

        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-3">
          <div><p className="text-xs font-black text-stone-900">Sheets에서 복구하기</p><p className="text-[11px] leading-relaxed text-stone-600 mt-0.5">백업해 둔 Google Sheets의 주소를 입력하면 급여일, 수입, 저축, 소비, 목표 저축액을 이 기기로 복구합니다.</p></div>
          <input value={restoreUrl} onChange={(event) => setRestoreUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-[11px] outline-none focus:ring-2 focus:ring-amber-200" />
          <button type="button" onClick={restoreNow} disabled={isRestoring || isBackingUp} className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"><RefreshCw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />{isRestoring ? '복구 중...' : '복구하기'}</button>
          <p className="text-[10px] leading-relaxed text-stone-500">※ 복구하면 현재 이 기기의 데이터가 Sheets 백업 내용으로 교체됩니다.</p>
        </div>

        <div className="p-4 rounded-2xl border border-stone-200 bg-white space-y-3">
          <div className="flex items-center justify-between text-xs"><span className="font-semibold text-stone-600">최근 백업</span>{savedUrl ? <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full text-[11px]"><ShieldCheck className="w-3 h-3" />백업 시트 있음</span> : <span className="font-semibold text-stone-600 bg-stone-200/80 px-2 py-0.5 rounded-full text-[11px]">아직 없음</span>}</div>
          {savedUrl && <button type="button" onClick={() => window.open(savedUrl, '_blank', 'noopener,noreferrer')} className="w-full flex items-center justify-between gap-2 text-[11px] text-stone-600 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 hover:bg-white"><span className="truncate font-medium">최근 백업 시트 열기</span><ExternalLink className="w-3 h-3 shrink-0" /></button>}
          {lastSync.time && <div className="text-[11px] text-stone-500 pt-1 border-t border-stone-200/60">최근 백업: <span className="text-stone-700 font-medium">{lastSync.time}</span></div>}
        </div>

        {message && <div className="text-[11px] text-stone-700 font-semibold bg-stone-50 p-3 rounded-xl border border-stone-200 whitespace-pre-line">{message}</div>}
        {savedUrl && <button type="button" onClick={disconnect} className="w-full py-2 text-[11px] font-semibold text-stone-500 hover:text-stone-800">저장된 연결 정보 지우기</button>}
      </div>
    </div>
  );
};
