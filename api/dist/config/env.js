import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Works from src/config (dev) and dist/config (prod)
const apiRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(apiRoot, '.env') });
dotenv.config({ path: path.join(apiRoot, '.env.local'), override: true });
export const env = {
    port: Number(process.env.PORT || 3001),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'production',
    publicUrl: process.env.PUBLIC_URL || 'https://apigemini.techwagger.com',
    clientOrigin: process.env.CLIENT_ORIGIN || 'https://apigemini.techwagger.com',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiLiveModel: process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview',
    geminiApiVersion: process.env.GEMINI_API_VERSION || 'v1beta',
    geminiVoice: process.env.GEMINI_VOICE || 'Aoede',
    timerWarnBeforeSec: Number(process.env.TIMER_WARN_BEFORE_SEC || 300),
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI ||
            'https://apigemini.techwagger.com/api/google/callback',
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
    },
};
export function assertGeminiKey() {
    const key = env.geminiApiKey || '';
    if (!key || key === 'your_gemini_api_key_here' || key === 'missing') {
        console.warn('[env] GEMINI_API_KEY is not set. Add it in api/.env before starting Live sessions.');
    }
}
//# sourceMappingURL=env.js.map