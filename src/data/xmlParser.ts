import { AppTechItem } from '../types';

export const DEFAULT_APPTECH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<apptech>
    <item
        id="app001"
        name="토스 만보기 & 출석"
        description="매일 1만보 걷기와 행운복권으로 쏠쏠하게 모아 저축통장에 입금!"
        category="만보기/출석"
        referralCode="TOSS-SAVING26"
        referralUrl="https://toss.im"
        isActive="true" />
    <item
        id="app002"
        name="모니모 (Monimo)"
        description="매일 아침 젤리 챌린지와 기상 미션으로 현금성 포인트 적립"
        category="금융/미션"
        referralCode="MONI-789XYZ"
        referralUrl="https://monimo.com"
        isActive="true" />
    <item
        id="app003"
        name="캐시워크 (Cashwalk)"
        description="하루 100캐시씩 걸음 포인트 적립, 커피 쿠폰과 네이버페이로 교환"
        category="만보기"
        referralCode="KRW-WALK88"
        referralUrl="https://cashwalk.com"
        isActive="true" />
    <item
        id="app004"
        name="페이북 머니박스"
        description="매일 출석체크와 룰렛 돌리기로 모은 머니를 계좌로 송금"
        category="출석/머니"
        referralCode="PAYBOOK-010"
        referralUrl="https://paybook.co.kr"
        isActive="true" />
    <item
        id="app005"
        name="비활성 프로모션 테스트"
        description="isActive가 false이므로 화면에 노출되지 않아야 하는 항목"
        category="테스트"
        referralCode="HIDDEN"
        referralUrl="https://example.com"
        isActive="false" />
</apptech>`;

const APPTECH_CACHE_KEY = 'saving_game_apptech_cache_data_v1';
const APPTECH_CACHE_TIME_KEY = 'saving_game_apptech_cache_time_v1';

export function parseAppTechXml(xmlString: string): AppTechItem[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parser errors
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('XML 파싱 오류: 올바른 XML 형식인지 확인해주세요.');
  }

  const items = xmlDoc.getElementsByTagName('item');
  const result: AppTechItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const itemElem = items[i];
    const id = itemElem.getAttribute('id') || `app_${i}`;
    const name = itemElem.getAttribute('name') || '';
    const description = itemElem.getAttribute('description') || '';
    const category = itemElem.getAttribute('category') || '기타';
    const referralCode = itemElem.getAttribute('referralCode') || '';
    const referralUrl = itemElem.getAttribute('referralUrl') || '';
    const isActiveStr = itemElem.getAttribute('isActive');
    const isActive = isActiveStr === 'true';

    // isActive가 false인 항목은 화면에 표시하지 않음 (요구사항 12번)
    if (isActive && name) {
      result.push({
        id,
        name,
        description,
        category,
        referralCode,
        referralUrl,
        isActive,
      });
    }
  }

  return result;
}

export interface AppTechFetchResult {
  items: AppTechItem[];
  source: 'network' | 'cache' | 'default';
  lastUpdated: string;
  errorMessage?: string;
}

export const AppTechRepository = {
  /**
   * 로컬 캐시에서 불러오기
   */
  getCachedData(): { items: AppTechItem[]; time: string } | null {
    try {
      const data = localStorage.getItem(APPTECH_CACHE_KEY);
      const time = localStorage.getItem(APPTECH_CACHE_TIME_KEY);
      if (data) {
        return {
          items: JSON.parse(data),
          time: time || '알 수 없음',
        };
      }
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

  /**
   * GitHub XML 다운로드 및 로컬 캐시 폴백 처리
   */
  async fetchAppTechItems(url: string): Promise<AppTechFetchResult> {
    const targetUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    try {
      // 1. 네트워크 다운로드 시도 (5초 타임아웃)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsedItems = parseAppTechXml(xmlText);

      // 성공 시 캐시 저장
      this.saveToCache(parsedItems);

      return {
        items: parsedItems,
        source: 'network',
        lastUpdated: new Date().toLocaleString('ko-KR'),
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '네트워크 통신 실패';
      console.warn('GitHub XML fetch failed, attempting local cache fallback:', errorMsg);

      // 2. 캐시 확인
      const cached = this.getCachedData();
      if (cached && cached.items.length > 0) {
        return {
          items: cached.items,
          source: 'cache',
          lastUpdated: cached.time,
          errorMessage: `GitHub 연결 실패 (${errorMsg}). 저장된 로컬 캐시를 표시합니다.`,
        };
      }

      // 3. 기본 번들 데이터 폴백 (오프라인에서도 완전히 작동하도록 보장)
      const defaultItems = parseAppTechXml(DEFAULT_APPTECH_XML);
      return {
        items: defaultItems,
        source: 'default',
        lastUpdated: '내장 기본 데이터',
        errorMessage: `GitHub 연결 실패 (${errorMsg}). 앱 기본 추천 데이터를 표시합니다.`,
      };
    }
  },
};
