import { AppTechItem } from '../types';

export const DEFAULT_APPTECH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<recommendedApps version="1.0">
  <app id="Life_planet" isActive="true">
    <name>라이프플래닛</name>
    <category>만보기</category>
    <description>만보 걷고 하루 한 번 버튼 클릭만으로 기프티콘 구매해요</description>
    <url>https://m.lifeplanet.co.kr:444/bridge/bm/BM07000S.dev?shareCd=20231098212</url>
  </app>
</recommendedApps>`;

const APPTECH_CACHE_KEY = 'saving_game_apptech_cache_data_v1';
const APPTECH_CACHE_TIME_KEY = 'saving_game_apptech_cache_time_v1';
const XML_DIRECTORY_API_URL = 'https://api.github.com/repos/Ninetaild/app/contents/xml';
const RAW_GITHUB_BASE_URL = 'https://raw.githubusercontent.com/Ninetaild/app';

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

interface GitHubXmlFile { name: string; download_url: string | null; type: string; sha: string; }

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const listResponse = await fetch(`${XML_DIRECTORY_API_URL}?_refresh=${Date.now()}`, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
      clearTimeout(timeoutId);
      if (!listResponse.ok) throw new Error(`XML 목록 HTTP ${listResponse.status}: ${listResponse.statusText}`);
      const files = (await listResponse.json()) as GitHubXmlFile[];
      const xmlFiles = files.filter((file) => file.type === 'file' && file.name.toLowerCase().endsWith('.xml') && file.sha);
      if (xmlFiles.length === 0) throw new Error('xml 디렉터리에 XML 파일이 없습니다.');

      const xmlResults = await Promise.allSettled(xmlFiles.map(async (file) => {
        // Use the file's blob SHA in the raw URL so a changed XML gets a new URL immediately.
        const response = await fetch(`${RAW_GITHUB_BASE_URL}/${file.sha}/xml/${encodeURIComponent(file.name)}`, { signal: AbortSignal.timeout(4500), cache: 'no-store' });
        if (!response.ok) throw new Error(`${file.name} HTTP ${response.status}: ${response.statusText}`);
        return parseAppTechXml(await response.text());
      }));
      const successfulItems = xmlResults.filter((result): result is PromiseFulfilledResult<AppTechItem[]> => result.status === 'fulfilled').flatMap((result) => result.value);
      if (successfulItems.length === 0) throw new Error('GitHub의 XML 파일을 불러오지 못했습니다.');
      this.saveToCache(successfulItems);
      return { items: successfulItems, source: 'network', lastUpdated: new Date().toLocaleString('ko-KR') };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '네트워크 통신 실패'; console.warn('Recommended app XML fetch failed, using local cache/default:', errorMsg);
      const cached = this.getCachedData();
      if (cached && cached.items.length > 0) return { items: cached.items, source: 'cache', lastUpdated: cached.time, errorMessage: `추천 앱 XML 연결 실패 (${errorMsg}). 저장된 추천 목록을 표시합니다.` };
      return { items: parseAppTechXml(DEFAULT_APPTECH_XML), source: 'default', lastUpdated: '내장 기본 데이터', errorMessage: `추천 앱 XML 연결 실패 (${errorMsg}). 기본 추천 목록을 표시합니다.` };
    }
  },
};
