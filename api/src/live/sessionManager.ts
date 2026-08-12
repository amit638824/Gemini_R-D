import {
  GoogleGenAI,
  Modality,
  type Session,
  type LiveServerMessage,
} from '@google/genai';
import type { DayState, ServerToClientMessage } from '../shared/types.js';
import { env } from '../config/env.js';
import { buildSystemInstruction } from './systemPrompt.js';
import { toolDeclarations } from '../tools/definitions.js';
import { handleToolCall, toolResponsePayload } from '../tools/handlers.js';
import { stateStore } from '../state/store.js';
import { timerScheduler } from '../scheduler/timerScheduler.js';

export type EmitFn = (msg: ServerToClientMessage) => void;

/**
 * One Gemini Live session bound to a browser WebSocket client.
 * Server-to-server pattern keeps the API key off the device.
 */
export class LiveSessionManager {
  private ai: GoogleGenAI;
  private session: Session | null = null;
  private emit: EmitFn;
  private closed = false;
  private unsubscribeState: (() => void) | null = null;
  private proactiveQueue: string[] = [];
  private speakingProactive = false;

  constructor(emit: EmitFn) {
    this.emit = emit;
    this.ai = new GoogleGenAI({
      apiKey: env.geminiApiKey,
      httpOptions: { apiVersion: env.geminiApiVersion },
    });
  }

  async connect(): Promise<void> {
    this.emit({ type: 'status', status: 'connecting' });

    const config: Record<string, unknown> = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: buildSystemInstruction(),
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: env.geminiVoice },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: [{ functionDeclarations: toolDeclarations }],
    };

    // Proactive audio (ignore ambient chatter) — only on 2.5 + v1alpha
    if (env.geminiApiVersion === 'v1alpha') {
      config.proactivity = { proactiveAudio: true };
    }

    this.session = await this.ai.live.connect({
      model: env.geminiLiveModel,
      config: config as never,
      callbacks: {
        onopen: () => {
          this.emit({ type: 'status', status: 'live' });
          this.emit({ type: 'ready', state: stateStore.get() });
        },
        onmessage: (message) => {
          void this.onGeminiMessage(message);
        },
        onerror: (e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.error('[live] error', message);
          this.emit({ type: 'status', status: 'error', detail: message });
          this.emit({ type: 'error', message });
        },
        onclose: (e) => {
          const reason =
            e && typeof e === 'object' && 'reason' in e
              ? String((e as { reason?: string }).reason ?? 'closed')
              : 'closed';
          if (!this.closed) {
            this.emit({ type: 'status', status: 'idle', detail: reason });
          }
        },
      },
    });

    this.unsubscribeState = stateStore.subscribe((state: DayState) => {
      this.emit({ type: 'state', state });
    });

    timerScheduler.start(async ({ message }) => {
      await this.speakProactively(message);
    });
  }

  async sendAudioBase64(data: string): Promise<void> {
    if (!this.session || this.closed) return;
    await this.session.sendRealtimeInput({
      audio: {
        data,
        mimeType: 'audio/pcm;rate=16000',
      },
    });
  }

  async sendText(text: string): Promise<void> {
    if (!this.session || this.closed) return;
    await this.session.sendRealtimeInput({ text });
  }

  async sendAudioStreamEnd(): Promise<void> {
    if (!this.session || this.closed) return;
    try {
      await this.session.sendRealtimeInput({ audioStreamEnd: true });
    } catch {
      // older SDK builds may not expose audioStreamEnd — ignore
    }
  }

  /**
   * Inject a proactive speak prompt into the live session.
   * Used by the timer scheduler when phone is away.
   */
  async speakProactively(prompt: string): Promise<void> {
    if (!this.session || this.closed) {
      this.proactiveQueue.push(prompt);
      return;
    }
    if (this.speakingProactive) {
      this.proactiveQueue.push(prompt);
      return;
    }
    this.speakingProactive = true;
    try {
      await this.session.sendRealtimeInput({ text: prompt });
    } catch (err) {
      console.error('[live] proactive inject failed', err);
    } finally {
      this.speakingProactive = false;
      const next = this.proactiveQueue.shift();
      if (next) void this.speakProactively(next);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.unsubscribeState?.();
    this.unsubscribeState = null;
    try {
      this.session?.close();
    } catch {
      /* ignore */
    }
    this.session = null;
  }

  private async onGeminiMessage(message: LiveServerMessage): Promise<void> {
    const content = message.serverContent;

    if (content?.interrupted) {
      this.emit({ type: 'interrupted' });
    }

    if (content?.inputTranscription?.text) {
      this.emit({
        type: 'transcript',
        role: 'user',
        text: content.inputTranscription.text,
        final: Boolean(
          (content.inputTranscription as { finished?: boolean }).finished,
        ),
      });
    }

    if (content?.outputTranscription?.text) {
      this.emit({
        type: 'transcript',
        role: 'assistant',
        text: content.outputTranscription.text,
        final: Boolean(
          (content.outputTranscription as { finished?: boolean }).finished,
        ),
      });
    }

    if (content?.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.emit({
            type: 'audio',
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType ?? 'audio/pcm;rate=24000',
          });
        }
        if (part.text) {
          this.emit({
            type: 'transcript',
            role: 'assistant',
            text: part.text,
          });
        }
      }
    }

    const toolCall = message.toolCall;
    if (toolCall?.functionCalls?.length && this.session) {
      const functionResponses = [];
      for (const fc of toolCall.functionCalls) {
        const name = fc.name ?? 'unknown';
        const args = (fc.args ?? {}) as Record<string, unknown>;
        const { result, event } = await handleToolCall(name, args);
        this.emit({ type: 'tool', name: event.name, args: event.args, result: event.result });
        functionResponses.push(
          toolResponsePayload(fc.id ?? '', name, result),
        );
      }
      await this.session.sendToolResponse({ functionResponses });
    }
  }
}
