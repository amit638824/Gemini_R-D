export declare const env: {
    rawPort: string;
    port: number;
    host: string;
    nodeEnv: string;
    publicUrl: string;
    clientOrigin: string;
    geminiApiKey: string;
    geminiLiveModel: string;
    geminiApiVersion: string;
    geminiVoice: string;
    timerWarnBeforeSec: number;
    google: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        refreshToken: string;
    };
};
export declare function assertGeminiKey(): void;
