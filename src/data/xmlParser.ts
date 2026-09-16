import { AppTechItem } from '../types';

export const DEFAULT_APPTECH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<recommendedApps version="1.0">
  <app id="monimo" isActive="true">
    <name>모니모 (Monimo)</name>
    <category>금융/미션</category>
    <description>매일 미션과 챌린지로 포인트를 모아 생활비 절약에 활용할 수 있습니다.</description>
    <url>https://monimo.com</url>
  </app>
</recommendedApps>`;

const APPTECH_CACHE_KEY = 'saving_game_apptech_cache_data_v1';
const APPTECH_CACHE_TIME_KEY = 'saving_game_apptech_cache_time_v1';
const RECOMMENDED_APPS_XML_URL = 'https://ninetaild.github.io/app/xml/recommended-apps.xml';

function childText(element: Element, name: string): string { return element.querySelector(name)?.textContent?.trim() || ''; }
function readAttributeOrChild(element: Element, name: string): string { return element.getAttribute(name)?.trim() || childText(element, name); }

export function parseAppTechXml(xmlString: string): AppTechItem[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) throw new Error('XML 파싱 오류: 올바른 XML 형식인지 확인해주세요.');
  const elements = Array.from(xmlDoc.getElementsByTagName('app'));
  const result: AppTechItem[] = [];
  elements.forEach((element, index) => {
    const id = readAttributeOrChild(element, 'id') || `app_${index}`;
    const name = childText(element, 'name'); const description = childText(element, 'description'); const category = childText(element, 'category') || '기타';
    const referralCode = childText(element, 'referralCode'); const url = childText(element, 'url'); const isActiveValue = element.getAttribute('isActive')?.trim() || '';
    const isActive = isActiveValue === '' || isActiveValue.toLowerCase() === 'true';
    if (isActive && name && description && url) result.push({ id, name, description, category, referralCode, url, referralUrl: url, isActive: true });
  });
  return result;
}

export interface AppTechFetchResult { items: AppTechItem[]; source: 'network' | 'cache' | 'default'; lastUpdated: string; errorMessage?: string; }

export const AppTechRepository = {
  getCachedData(): { items: AppTechItem[]; time: string } | null {
    try { const data = localStorage.getItem(APPTECH_CACHE_KEY); const time = localStorage.getItem(APPTECH_CACHE_TIME_KEY); if (data) return { items: JSON.parse(data), time: time || '알 수 없음' }; } catch (e) { console.error('Failed to read AppTech cache', e); }
    return null;
  },
  saveToCache(items: AppTechItem[]) {
    try { localStorage.setItem(APPTECH_CACHE_KEY, JSON.stringify(items)); localStorage.setItem(APPTECH_CACHE_TIME_KEY, new Date().toLocaleString('ko-KR')); } catch (e) { console.error('Failed to write AppTech cache', e); }
  },
  async fetchAppTechItems(_url?: string): Promise<AppTechFetchResult> {
    try {
      const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(RECOMMENDED_APPS_XML_URL, { signal: controller.signal, cache: 'no-store' }); clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const parsedItems = parseAppTechXml(await response.text()); if (parsedItems.length === 0) throw new Error('추천 앱 XML에 표시할 활성 앱이 없습니다.');
      this.saveToCache(parsedItems); return { items: parsedItems, source: 'network', lastUpdated: new Date().toLocaleString('ko-KR') };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '네트워크 통신 실패'; console.warn('Recommended app XML fetch failed, using local cache/default:', errorMsg);
      const cached = this.getCachedData();
      if (cached && cached.items.length > 0) return { items: cached.items, source: 'cache', lastUpdated: cached.time, errorMessage: `추천 앱 XML 연결 실패 (${errorMsg}). 저장된 추천 목록을 표시합니다.` };
      return { items: parseAppTechXml(DEFAULT_APPTECH_XML), source: 'default', lastUpdated: '내장 기본 데이터', errorMessage: `추천 앱 XML 연결 실패 (${errorMsg}). 기본 추천 목록을 표시합니다.` };
    }
  },
};
