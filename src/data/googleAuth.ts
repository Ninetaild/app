const CLIENT_ID = ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '').trim();
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SHEETS_API = 'https://sheets.googleapis.com/v4';

type GoogleAccounts = {
  oauth2?: {
    initTokenClient: (options: {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
    }) => TokenClient;
  };
};

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient { requestAccessToken: (options?: { prompt?: string }) => void; }

function getGoogleAccounts(): GoogleAccounts['oauth2'] {
  const win = window as unknown as { google?: { accounts?: GoogleAccounts } };
  return win.google?.accounts?.oauth2;
}

let accessToken = '';
let tokenExpiresAt = 0;

export function getGoogleClientId(): string { return CLIENT_ID; }

function loadGoogleIdentityServices(): Promise<void> {
  if (getGoogleAccounts()?.initTokenClient) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gsi]') as HTMLScriptElement | null;
    if (existing) {
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (getGoogleAccounts()?.initTokenClient) {
          window.clearInterval(timer);
          resolve();
        } else if (Date.now() - started > 10000) {
          window.clearInterval(timer);
          reject(new Error('Google 인증 라이브러리를 불러오지 못했습니다.'));
        }
      }, 50);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google 인증 라이브러리를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });
}

export async function getAccessToken(forceConsent = false): Promise<string> {
  if (!CLIENT_ID) throw new Error('Google OAuth Client ID가 설정되지 않았습니다.');
  if (accessToken && Date.now() < tokenExpiresAt - 60_000 && !forceConsent) return accessToken;

  await loadGoogleIdentityServices();
  const oauth2 = getGoogleAccounts();
  if (!oauth2?.initTokenClient) throw new Error('Google OAuth를 사용할 수 없습니다.');

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error_description || response.error || 'Google 인증이 취소되었습니다.'));
          return;
        }
        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000;
        resolve(accessToken);
      },
    });
    client.requestAccessToken({ prompt: forceConsent ? 'consent' : '' });
  });
}

export function clearGoogleToken(): void {
  accessToken = '';
  tokenExpiresAt = 0;
}

export async function googleApi<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${SHEETS_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

  if (response.status === 401 && retry) {
    clearGoogleToken();
    await getAccessToken(true);
    return googleApi<T>(path, init, false);
  }

  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data
      ? String((data as { error?: { message?: string } }).error?.message || '')
      : '';
    throw new Error(message || `Google Sheets API 오류 (${response.status})`);
  }
  return data as T;
}
