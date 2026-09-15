import { AppTechItem } from '../types';

export const DEFAULT_APPTECH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<apptech>
    <item id="app001" name="토스 만보기 & 출석" description="매일 1만보 걷기와 행운복권으로 쏠쏠하게 모아 저축통장에 입금!" category="만보기/출석" referralCode="TOSS-SAVING26" referralUrl="https://toss.im" isActive="true" />
    <item id="app002" name="모니모 (Monimo)" description="매일 아침 젤리 챌린지와 기상 미션으로 현금성 포인트 적립" category="금융/미션" referralCode="MONI-789XYZ" referralUrl="https://monimo.com" isActive="true" />
    <item id="app003" name="캐시워크 (Cashwalk)" description="하루 100캐시씩 걸음 포인트 적립, 커피 쿠폰과 네이버페이로 교환" category="만보기" referralCode="KRW-WALK88" referralUrl="https://cashwalk.com" isActive="true" />
    <item id="app004" name="페이북 머니박스" description="매일 출석체크와 룰렛 돌리기로 모은 머니를 계좌로 송금" category="출석/머니" referralCode="PAYBOOK-010" referralUrl="https://paybook.co.kr" isActive="true" />
</apptech>`;

const APPTECH_CACHE_KEY = 'saving_game_apptech_cache_data_v1';
const APPTECH_CACHE_TIME_KEY = 'saving_game_apptech_cache_time_v1';

function childText(element: Element, name: string): string {
  return element.querySelector(name)?.textContent?.trim() || '';
}

function readValue(element: Element, attributeName: string, childName = attributeName): string {
  return element.getAttribute(attributeName)?.trim() || childText(element, childName);
}

export function parseAppTechXml(xmlString: string): AppTechItem[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) throw new Error('XML 파싱 오류: 올바른 XML 형식인지 확인해주세요.');

  // 기존 <item ... /> 형식과 /xml/ 추천 목록 예시의 <app><name>...</name>...</app> 형식을 모두 지원한다.
  const elements = [
    ...Array.from(xmlDoc.getElementsByTagName('item')),
    ...Array.from(xmlDoc.getElementsByTagName('app')),
  ];
  const result: AppTechItem[] = [];

  elements.forEach((element, index) => {
    const id = readValue(element, 'id') || `app_${index}`;
    const name = readValue(element, 'name');
    const description = readValue(element, 'description');
    const category = readValue(element, 'category') || '기타';
    const referralCode = readValue(element, 'referralCode');
    const referralUrl = readValue(element, 'referralUrl', 'url');
    const isActiveValue = readValue(element, 'isActive');
    const isActive = isActiveValue === '' || isActiveValue.toLowerCase() === 'true';

    if (isActive && name && description) {
      result.push({ id, name, description, category, referralCode, referralUrl, isActive: true });
    }
  });

  return result;
}

export interface AppTechFetchResult {
  items: AppTechItem[];
  source: 'network' | 'cache' | 'default';
  lastUpdated: string;
  errorMessage?: string;
}

export const AppTechRepository = {
  getCachedData(): { items: AppTechItem[]; time: string } | null {
    try {
      const data = localStorage.getItem(APPTECH_CACHE_KEY);
      const time = localStorage.getItem(APPTECH_CACHE_TIME_KEY);
      if (data) return { items: JSON.parse(data), time: time || '알 수 없음' };
    } catch (e) {
      console.error('Failed to read AppTech cache', e);
    }
    return null;
  },

  saveToCache(items: AppTechItem[]) {
    try {
      const nowStr = new Date().toLocaleString('ko-KR');
      localStorage.setItem(APPTECH_CACHE_KEY, JSON.stringify(items));
      localStorage.setItem(APPTECH_CACHE_TIME_KEY, nowStr);
    } catch (e) {
      console.error('Failed to write AppTech cache', e);
    }
  },

  async fetchAppTechItems(url: string): Promise<AppTechFetchResult> {
    const targetUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(targetUrl, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const parsedItems = parseAppTechXml(await response.text());
      this.saveToCache(parsedItems);
      return { items: parsedItems, source: 'network', lastUpdated: new Date().toLocaleString('ko-KR') };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '네트워크 통신 실패';
      console.warn('GitHub XML fetch failed, attempting local cache fallback:', errorMsg);
      const cached = this.getCachedData();
      if (cached && cached.items.length > 0) {
        return { items: cached.items, source: 'cache', lastUpdated: cached.time, errorMessage: `GitHub 연결 실패 (${errorMsg}). 저장된 로컬 캐시를 표시합니다.` };
      }
      const defaultItems = parseAppTechXml(DEFAULT_APPTECH_XML);
      return { items: defaultItems, source: 'default', lastUpdated: '내장 기본 데이터', errorMessage: `GitHub 연결 실패 (${errorMsg}). 앱 기본 추천 데이터를 표시합니다.` };
    }
  },
};
