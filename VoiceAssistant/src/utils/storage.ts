import { MMKV } from 'react-native-mmkv';
import { DayState, emptyDayState } from '../shared/types';
import { ApiEnvMode, API_ENDPOINTS, DEFAULT_ENV_MODE } from '../config/apiConfig';

let mmkvInstance: MMKV | null = null;
try {
  mmkvInstance = new MMKV({ id: 'voice-assistant-storage' });
} catch (e) {
  console.warn('[Storage] MMKV native initialization fallback:', e);
}

const memoryCache = new Map<string, string>();

const KEYS = {
  DAY_STATE: 'day_state_cache',
  SERVER_URL: 'server_url_setting',
  ENV_MODE: 'env_mode_setting',
};

export class AppStorage {
  static saveDayState(state: DayState): void {
    try {
      const dataStr = JSON.stringify(state);
      if (mmkvInstance) {
        mmkvInstance.set(KEYS.DAY_STATE, dataStr);
      } else {
        memoryCache.set(KEYS.DAY_STATE, dataStr);
      }
    } catch (e) {
      console.error('[Storage] Save day state failed:', e);
    }
  }

  static getDayState(): DayState {
    try {
      let cached: string | undefined;
      if (mmkvInstance) {
        cached = mmkvInstance.getString(KEYS.DAY_STATE);
      } else {
        cached = memoryCache.get(KEYS.DAY_STATE);
      }
      if (cached) {
        return JSON.parse(cached) as DayState;
      }
    } catch (e) {
      console.error('[Storage] Load day state failed:', e);
    }
    return emptyDayState();
  }

  static saveEnvMode(mode: ApiEnvMode): void {
    if (mmkvInstance) {
      mmkvInstance.set(KEYS.ENV_MODE, mode);
    } else {
      memoryCache.set(KEYS.ENV_MODE, mode);
    }
  }

  static getEnvMode(): ApiEnvMode {
    const val = mmkvInstance
      ? mmkvInstance.getString(KEYS.ENV_MODE)
      : memoryCache.get(KEYS.ENV_MODE);
    return (val as ApiEnvMode) || DEFAULT_ENV_MODE;
  }

  static saveServerUrl(url: string): void {
    if (mmkvInstance) {
      mmkvInstance.set(KEYS.SERVER_URL, url);
    } else {
      memoryCache.set(KEYS.SERVER_URL, url);
    }
  }

  static getServerUrl(): string {
    const mode = this.getEnvMode();
    if (mode === 'PROD') {
      return API_ENDPOINTS.PROD.WS;
    }
    const val = mmkvInstance
      ? mmkvInstance.getString(KEYS.SERVER_URL)
      : memoryCache.get(KEYS.SERVER_URL);
    return val || API_ENDPOINTS.DEV.WS;
  }

  static getHttpBaseUrl(): string {
    const mode = this.getEnvMode();
    if (mode === 'PROD') {
      return API_ENDPOINTS.PROD.HTTP;
    }
    const wsUrl = this.getServerUrl();
    const httpUrl = wsUrl
      .replace(/^ws:\/\//, 'http://')
      .replace(/^wss:\/\//, 'https://')
      .replace(/\/ws\/live$/, '');
    return httpUrl || API_ENDPOINTS.DEV.HTTP;
  }
}
