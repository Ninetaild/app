import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  WifiOff,
  Wifi,
  Database,
  ArrowUpRight,
} from 'lucide-react';
import { AppTechItem } from '../types';
import { AppTechRepository, AppTechFetchResult } from '../data/xmlParser';
import { StorageRepository } from '../data/storage';

export const AppTechScreen: React.FC = () => {
  const [items, setItems] = useState<AppTechItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<'network' | 'cache' | 'default'>('default');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const settings = StorageRepository.getSettings();

  const fetchItems = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result: AppTechFetchResult = await AppTechRepository.fetchAppTechItems(
        settings.customXmlUrl
      );
      setItems(result.items);
      setDataSource(result.source);
      setLastUpdated(result.lastUpdated);
      if (result.errorMessage) {
        setErrorMessage(result.errorMessage);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleCopyReferral = (item: AppTechItem) => {
    if (!item.referralCode) return;
    try {
      navigator.clipboard.writeText(item.referralCode);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Clipboard copy failed', e);
    }
  };

  const getSourceBadge = () => {
    switch (dataSource) {
      case 'network':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
            <Wifi className="w-3 h-3 text-emerald-600" />
            GitHub 최신 동기화
          </span>
        );
      case 'cache':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
            <Database className="w-3 h-3 text-amber-600" />
            오프라인 로컬 캐시
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-stone-100 text-stone-700 text-xs font-semibold rounded-full">
            <WifiOff className="w-3 h-3 text-stone-500" />
            기본 내장 데이터
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pt-1 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <span>앱테크 추천</span>
            <span className="text-lg">💡</span>
          </h1>
          <p className="text-xs text-stone-500">
            소소하게 포인트를 모아 저축 부수입을 만드는 추천 서비스 목록
          </p>
        </div>
        <button
          type="button"
          onClick={fetchItems}
          disabled={loading}
          className="p-2 text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 active:scale-95 border border-stone-200 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          title="GitHub XML 다시 동기화"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>새로고침</span>
        </button>
      </div>

      {/* Sync Status Banner */}
      <div className="p-3 bg-white rounded-2xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {getSourceBadge()}
          <span className="text-stone-400 text-[11px]">
            {lastUpdated ? `업데이트: ${lastUpdated}` : ''}
          </span>
        </div>
        <span className="text-[11px] text-stone-400 truncate max-w-[200px]" title={settings.customXmlUrl}>
          출처: GitHub XML
        </span>
      </div>

      {/* Network or Cache Warning message if any */}
      {errorMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-semibold">네트워크 안내:</span> {errorMessage}
            <div className="text-[11px] text-amber-700 mt-0.5">
              가계부 저축 기록 및 레벨업 기능은 인터넷 연결 없이도 안전하게 작동합니다.
            </div>
          </div>
        </div>
      )}

      {/* AppTech Items List */}
      {loading ? (
        <div className="py-12 text-center text-stone-400">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-emerald-600" />
          <p className="text-xs font-semibold">GitHub XML 파싱 중...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-3xl border border-stone-200 text-stone-400">
          <p className="text-xs font-medium">표시할 활성 앱테크 목록이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-5 bg-white rounded-3xl border border-stone-200 shadow-xs hover:border-emerald-200 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-stone-900">
                      {item.name}
                    </h2>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200/60">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Referral Code & Action Links */}
              <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                {item.referralCode ? (
                  <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                    <span className="text-[11px] text-stone-500 font-medium">추천인 코드:</span>
                    <span className="text-xs font-bold text-stone-800 font-mono">
                      {item.referralCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyReferral(item)}
                      className="p-1 text-stone-500 hover:text-emerald-700 active:scale-95 transition-colors"
                      title="코드 복사"
                    >
                      {copiedId === item.id ? (
                        <span className="inline-flex items-center text-[10px] text-emerald-600 font-bold gap-0.5">
                          <Check className="w-3 h-3" /> 복사됨
                        </span>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <span />
                )}

                {item.referralUrl && (
                  <a
                    href={item.referralUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-2xs"
                  >
                    <span>가입 및 시작하기</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Explicit Legal Disclosure Box (요구사항 14번) */}
      <div className="p-4 bg-stone-100/80 rounded-2xl border border-stone-200 text-[11px] text-stone-600 space-y-1 leading-relaxed">
        <div className="font-bold text-stone-800 flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-stone-600" />
          투명성 고지 및 안내
        </div>
        <p>
          위 추천 링크 및 추천인 코드를 통해 가입하시는 경우, 앱 운영자에게 소정의 보상(포인트, 리워드)이 발생할 수 있습니다.
        </p>
        <p className="text-stone-500">
          앱테크 추천은 부가적인 편의 기능이며, 본 가계부 앱의 모든 핵심 저축 및 레벨업 기능은 인터넷 연결 및 앱테크 여부와 무관하게 100% 로컬에서 작동합니다.
        </p>
      </div>
    </div>
  );
};
