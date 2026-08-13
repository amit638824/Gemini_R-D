import type { ServerToClientMessage } from '../shared/types.js';
export type EmitFn = (msg: ServerToClientMessage) => void;
/**
 * One Gemini Live session bound to a browser WebSocket client.
 * Server-to-server pattern keeps the API key off the device.
 */
export declare class LiveSessionManager {
    private ai;
    private session;
    private emit;
    private closed;
    private unsubscribeState;
    private proactiveQueue;
    private speakingProactive;
    constructor(emit: EmitFn);
    connect(): Promise<void>;
    sendAudioBase64(data: string): Promise<void>;
    sendText(text: string): Promise<void>;
    sendAudioStreamEnd(): Promise<void>;
    /**
     * Inject a proactive speak prompt into the live session.
     * Used by the timer scheduler when phone is away.
     */
    speakProactively(prompt: string): Promise<void>;
    close(): Promise<void>;
    private onGeminiMessage;
}
