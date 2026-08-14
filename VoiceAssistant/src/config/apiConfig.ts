export type ApiEnvMode = 'DEV' | 'PROD';

export const API_ENDPOINTS = {
  PROD: {
    HTTP: 'https://apigemini.techwagger.com',
    WS: 'wss://apigemini.techwagger.com/ws/live',
  },
  DEV: {
    HTTP: 'http://127.0.0.1:3001',
    WS: 'ws://127.0.0.1:3001/ws/live',
  },
};

export const DEFAULT_ENV_MODE: ApiEnvMode = 'PROD';
// export const DEFAULT_ENV_MODE: ApiEnvMode = 'DEV';
