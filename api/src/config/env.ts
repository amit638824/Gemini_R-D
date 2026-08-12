import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), override: true });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  geminiApiKey: required('GEMINI_API_KEY', 'missing'),
  geminiLiveModel:
    process.env.GEMINI_LIVE_MODEL ?? 'gemini-3.1-flash-live-preview',
  geminiApiVersion: process.env.GEMINI_API_VERSION ?? 'v1beta',
  geminiVoice: process.env.GEMINI_VOICE ?? 'Aoede',
  timerWarnBeforeSec: Number(process.env.TIMER_WARN_BEFORE_SEC ?? 300),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ??
      'http://localhost:3001/api/google/callback',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? '',
  },
};

export function assertGeminiKey(): void {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.warn(
      '[env] GEMINI_API_KEY is not set. Copy .env.example → .env and add your key.',
    );
  }
}
