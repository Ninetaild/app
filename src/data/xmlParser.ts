import { AppTechItem } from '../types';

export const DEFAULT_APPTECH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<recommendedApps version="1.0">
  <app id="toss" isActive="true">
    <name>토스 만보기 &amp; 출석</name>
    <category>만보기/출석</category>
    <description>매일 걷기와 출석 미션으로 포인트를 모아 저축에 활용할 수 있습니다.</description>
    <url>https://toss.im</url>
  </app>
  <app id="monimo" isActive="true">
    <name>모니모 (Monimo)</name>
    <category>금융/미션</category>
    <description>매일 미션과 챌린지로 포인트를 모아 생활비 절약에 활용할 수 있습니다.</description>
    <url>https://monimo.com</url>
  </app>
  <app id="cashwalk" isActive="true">
    <name>캐시워크 (Cashwalk)</name>
    <category>만보기</category>
    <description>걸음 수에 따라 포인트를 적립하고 다양한 쿠폰으로 교환할 수 있습니다.</description>
    <url>https://cashwalk.com</url>
  </app>
  <app id="paybook" isActive="true">
    <name>페이북 머니박스</name>
    <category>출석/머니</category>
    <description>출석과 이벤트로 모은 머니를 생활비 절약에 활용할 수 있습니다.</description>
    <url>https://paybook.co.kr</url>
  </app>
</recommendedApps>`;

const APPTECH_CACHE_KEY = 'saving_game_apptech_cache_data_v1';
const APPTECH_CACHE_TIME_KEY = 'saving_game_apptech_cache_time_v1';
const LOCAL_RECOMMENDED_APPS_XML = './xml/recommended-apps.xml';

function childText(element: Element, name: string): string {
  return element.querySelector(name)?.textContent?.trim() || '';
}

function readAttributeOrChild(element: Element, name: string): string {
  return element.getAttribute(name)?.trim() || childText(element, name);
}

export function parseAppTechXml(xmlString: string): AppTechItem[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('XML 파싱 오류: 올바른 XML 형식인지 확인해주세요.');
  }

  // recommended-apps.xml의 실제 구조인 <recommendedApps><app>...</app></recommendedApps>를 기준으로 읽는다.
  const elements = Array.from(xmlDoc.getElementsByTagName('app'));
  const result: AppTechItem[] = [];

  elements.forEach((element, index) => {
    const id = readAttributeOrChild(element, 'id') || `app_${index}`;
    const name = childText(element, 'name');
    const description = childText(element, 'description');
    const category = childText(element, 'category') || '기타';
    const referralCode = childText(element, 'referralCode');
    const url = childText(element, 'url');
    const isActiveValue = element.getAttribute('isActive')?.trim() || '';
    const isActive = isActiveValue === '' || isActiveValue.toLowerCase() === 'true';

    if (isActive && name && description && url) {
      result.push({
        id,
        name,
        description,
        category,
        referralCode,
        url,
        // 기존 화면 코드와의 호환성을 위해 동일한 값을 유지한다.
        referralUrl: url,
        isActive: true,
      });
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

function normalizeXmlUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return LOCAL_RECOMMENDED_APPS_XML;
  if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
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
    const configuredUrl = normalizeXmlUrl(url);
    const targetUrl = configuredUrl === 'https://ninetaild.github.io/app/xml.xml'
      ? LOCAL_RECOMMENDED_APPS_XML
      : configuredUrl;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const parsedItems = parseAppTechXml(await response.text());
      if (parsedItems.length === 0) {
        throw new Error('추천 앱 XML에 표시할 활성 앱이 없습니다.');
      }

      this.saveToCache(parsedItems);
      return {
        items: parsedItems,
        source: 'network',
        lastUpdated: new Date().toLocaleString('ko-KR'),
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '네트워크 통신 실패';
      console.warn('Recommended app XML fetch failed, attempting local cache/default fallback:', errorMsg);

      const cached = this.getCachedData();
      if (cached && cached.items.length > 0) {
        return {
          items: cached.items,
          source: 'cache',
          lastUpdated: cached.time,
          errorMessage: `추천 앱 XML 연결 실패 (${errorMsg}). 저장된 추천 목록을 표시합니다.`,
        };
      }

      const defaultItems = parseAppTechXml(DEFAULT_APPTECH_XML);
      return {
        items: defaultItems,
        source: 'default',
        lastUpdated: '내장 기본 데이터',
        errorMessage: `추천 앱 XML 연결 실패 (${errorMsg}). 기본 추천 목록을 표시합니다.`,
      };
    }
  },
};
