import { ISessionManager, SessionManagerListener } from './SessionManager';
import { AssistantState, TranscriptTurn, ToolCallItem, DayState, SessionStatus } from './types';
import { emptyDayState, ClientToServerMessage, ServerToClientMessage } from '../shared/types';
import { AudioChunkPayload, VoiceBridge } from '../native/VoiceBridge';
import { AppStorage } from '../utils/storage';

const CANCELLABLE_STUB_RESPONSES = [
  "Hello! I am your AI Chief of Staff. I'm connected and listening with full day state tracking active.",
  "Got it. Order for 250 units saved to Thursday schedule. Task pipeline updated.",
  "Understood. 30-minute check-in scheduled. Foreground background service monitoring active.",
  "Task priority updated. Next item: Client sync meeting.",
];

export class StubAgent implements ISessionManager {
  private currentState: AssistantState = 'idle';
  private sessionStatus: SessionStatus = 'idle';
  private dayState: DayState = AppStorage.getDayState();
  private transcript: TranscriptTurn[] = [];
  private toolCalls: ToolCallItem[] = [];
  private listeners: Set<SessionManagerListener> = new Set();
  
  private ws: WebSocket | null = null;
  private isSpeechActive = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private responseTimer: ReturnType<typeof setTimeout> | null = null;
  private speakingTimer: ReturnType<typeof setTimeout> | null = null;
  private responseIndex = 0;
  private speechStartTime = 0;
  private lastSpeechEndTime = 0;
  private lastAudioChunkTime = 0;

  private userPartial = '';
  private assistantPartial = '';

  async startSession(): Promise<void> {
    this.setState('listening');
    this.addSystemMessage("Continuous voice session active.");
  }

  async stopSession(): Promise<void> {
    this.clearTimers();
    this.setState('idle');
    this.addSystemMessage("Voice session paused.");
  }

  async connectWebSocket(url = AppStorage.getServerUrl()): Promise<void> {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;

    this.setSessionStatus('connecting');
    this.addSystemMessage(`Connecting to Live WebSocket backend at ${url}...`);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setSessionStatus('live');
        this.setState('listening');
        this.addSystemMessage("Connected to Gemini Live WebSocket backend.");
      };

      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as ServerToClientMessage;
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('[WebSocket] Message parse error:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Connection error on ' + url + ':', err);
        if (url.includes('127.0.0.1')) {
          const fallbackUrl = url.replace('127.0.0.1', '10.0.2.2');
          console.log('[WebSocket] Retrying fallback URL:', fallbackUrl);
          this.ws = null;
          void this.connectWebSocket(fallbackUrl);
          return;
        }
        this.setSessionStatus('error', 'WebSocket connection failed — using local state stub');
      };

      this.ws.onclose = () => {
        this.setSessionStatus('idle');
        this.ws = null;
      };
    } catch (e) {
      console.warn('[WebSocket] Direct connection failed, active in local mode.', e);
      this.setSessionStatus('error', 'Failed to initialize WebSocket');
    }
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setSessionStatus('idle');
  }

  sendTextMessage(text: string): void {
    if (!text.trim()) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: ClientToServerMessage = { type: 'text', text };
      this.ws.send(JSON.stringify(msg));
    }

    // Add turn locally
    this.transcript.push({
      id: `user_${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: Date.now(),
    });
    this.notifyTranscript();

    // Trigger AI response loop ONLY if WebSocket is disconnected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.setState('thinking');
      setTimeout(() => {
        this.triggerAssistantResponse();
      }, 1000);
    }
  }

  processAudioChunk(data: AudioChunkPayload): void {
    this.notifyRms(data.rms);

    // If WebSocket is open or connecting, stream chunk directly to backend
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        // Real-time timestamp check (unthrottled by JS background timer pause)
        const millisSinceLastAudioChunk = Date.now() - this.lastAudioChunkTime;
        if (this.currentState === 'speaking' && millisSinceLastAudioChunk >= 1200) {
          this.lastSpeechEndTime = Date.now();
          this.setState('listening');
        }

        // Echo Gate: Mute microphone stream ONLY while assistant is actively receiving/playing audio
        if (this.currentState === 'speaking' || Date.now() - this.lastSpeechEndTime < 400) {
          return;
        }
        const msg: ClientToServerMessage = { type: 'audio', data: data.pcmChunk };
        this.ws.send(JSON.stringify(msg));
      }
      return;
    }

    // Local VAD & stub response loop
    if (this.currentState === 'thinking' || this.currentState === 'speaking') {
      return;
    }

    const SPEECH_THRESHOLD = 0.08;
    const SILENCE_GAP_MS = 1200;

    if (data.rms > SPEECH_THRESHOLD) {
      if (!this.isSpeechActive) {
        this.isSpeechActive = true;
        this.speechStartTime = Date.now();
        this.updateUserPartialTurn("Listening to user speech...");
      }

      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else if (this.isSpeechActive) {
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.handleUserSpeechCompleted();
        }, SILENCE_GAP_MS);
      }
    }
  }

  getState(): AssistantState {
    return this.currentState;
  }

  getSessionStatus(): SessionStatus {
    return this.sessionStatus;
  }

  getDayState(): DayState {
    return this.dayState;
  }

  getToolCalls(): ToolCallItem[] {
    return [...this.toolCalls];
  }

  getTranscript(): TranscriptTurn[] {
    return [...this.transcript];
  }

  clearTranscript(): void {
    this.transcript = [];
    this.userPartial = '';
    this.assistantPartial = '';
    this.notifyTranscript();
  }

  addListener(listener: SessionManagerListener): () => void {
    this.listeners.add(listener);
    listener.onStateChange(this.currentState);
    listener.onTranscriptUpdate(this.getTranscript());
    if (listener.onDayStateUpdate) listener.onDayStateUpdate(this.dayState);
    if (listener.onToolCall) listener.onToolCall(this.getToolCalls());
    if (listener.onSessionStatusChange) listener.onSessionStatusChange(this.sessionStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // --- Server Message Handling ---

  private handleServerMessage(msg: ServerToClientMessage): void {
    switch (msg.type) {
      case 'ready':
      case 'state':
        this.dayState = msg.state;
        if (msg.type === 'ready') this.setSessionStatus('live');
        this.notifyDayState();
        break;
      case 'status':
        this.setSessionStatus(msg.status, msg.detail);
        break;
      case 'transcript':
        this.appendServerTranscript(msg.role, msg.text, msg.final);
        break;
      case 'tool':
        const toolItem: ToolCallItem = {
          id: `tool_${Date.now()}_${Math.random()}`,
          name: msg.name,
          args: msg.args,
          result: msg.result,
          at: new Date().toLocaleTimeString(),
        };
        this.toolCalls = [toolItem, ...this.toolCalls].slice(0, 30);
        this.notifyToolCalls();
        break;
      case 'audio':
        if ((msg as any).data) {
          this.lastAudioChunkTime = Date.now();
          VoiceBridge.playAudioChunk((msg as any).data);
          this.setState('speaking');
          if (this.speakingTimer) {
            clearTimeout(this.speakingTimer);
          }
          this.speakingTimer = setTimeout(() => {
            this.lastSpeechEndTime = Date.now();
            if (this.currentState === 'speaking') {
              this.setState('listening');
            }
          }, 1200);
        }
        break;
      case 'interrupted':
        if (this.speakingTimer) clearTimeout(this.speakingTimer);
        VoiceBridge.stopAudio();
        this.lastSpeechEndTime = Date.now();
        this.setState('listening');
        break;
      case 'error':
        this.notifyError(msg.message);
        break;
      default:
        break;
    }
  }

  private appendServerTranscript(role: 'user' | 'assistant', text: string, final?: boolean): void {
    const isUser = role === 'user';
    const partialKey = isUser ? 'userPartial' : 'assistantPartial';
    
    if (!final) {
      this[partialKey] += text;
      const snapshot = this[partialKey];
      const existingIdx = this.transcript.findIndex(t => t.isPartial && t.sender === role);
      const turn: TranscriptTurn = {
        id: existingIdx >= 0 ? this.transcript[existingIdx].id : `partial_${role}_${Date.now()}`,
        sender: role,
        text: snapshot,
        timestamp: Date.now(),
        isPartial: true,
      };
      if (existingIdx >= 0) {
        this.transcript[existingIdx] = turn;
      } else {
        this.transcript.push(turn);
      }
    } else {
      const fullText = (this[partialKey] + text).trim() || text.trim();
      this[partialKey] = '';
      this.transcript = this.transcript.filter(t => !t.isPartial || t.sender !== role);
      if (fullText) {
        this.transcript.push({
          id: `${role}_${Date.now()}`,
          sender: role,
          text: fullText,
          timestamp: Date.now(),
        });
      }
    }

    if (role === 'assistant') {
      this.setState('speaking');
      if (final) {
        this.lastSpeechEndTime = Date.now();
        if (this.speakingTimer) clearTimeout(this.speakingTimer);
        this.speakingTimer = setTimeout(() => {
          if (this.currentState === 'speaking') {
            this.setState('listening');
          }
        }, 800);
      }
    } else if (role === 'user') {
      if (this.speakingTimer) clearTimeout(this.speakingTimer);
      if (this.currentState === 'speaking') {
        VoiceBridge.stopAudio();
      }
      this.setState('listening');
    }
    this.notifyTranscript();
  }

  // --- Private Helpers ---

  private handleUserSpeechCompleted(): void {
    this.isSpeechActive = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // Do NOT trigger static stub response if connected to WebSocket
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const durationSec = Math.max(1, Math.round((Date.now() - this.speechStartTime) / 1000));
    this.replaceUserPartialTurn(`[Voice Audio Captured (~${durationSec}s)] "Can you summarize my daily schedule and check-ins?"`);
    this.setState('thinking');

    this.responseTimer = setTimeout(() => {
      this.triggerAssistantResponse();
    }, 1200);
  }

  private triggerAssistantResponse(): void {
    const text = CANCELLABLE_STUB_RESPONSES[this.responseIndex % CANCELLABLE_STUB_RESPONSES.length];
    this.responseIndex++;

    this.setState('speaking');

    const assistantTurn: TranscriptTurn = {
      id: `turn_${Date.now()}`,
      sender: 'assistant',
      text: text,
      timestamp: Date.now(),
    };

    this.transcript.push(assistantTurn);
    this.notifyTranscript();

    // Auto update day state order/task mock
    if (text.includes("Order")) {
      this.dayState.orders.unshift({
        id: `o_${Date.now()}`,
        customer: 'James',
        quantity: 250,
        unit: 'units',
        dueDate: 'Thursday',
        raw: '250 units for Thursday',
        createdAt: new Date().toISOString(),
      });
      this.notifyDayState();
    }

    const speakingDurationMs = Math.max(2000, text.length * 45);
    this.speakingTimer = setTimeout(() => {
      if (this.currentState === 'speaking') {
        this.setState('listening');
      }
    }, speakingDurationMs);
  }

  private updateUserPartialTurn(partialText: string): void {
    const existingIndex = this.transcript.findIndex(t => t.isPartial && t.sender === 'user');
    const turn: TranscriptTurn = {
      id: existingIndex >= 0 ? this.transcript[existingIndex].id : `turn_user_${Date.now()}`,
      sender: 'user',
      text: partialText,
      timestamp: Date.now(),
      isPartial: true,
    };

    if (existingIndex >= 0) {
      this.transcript[existingIndex] = turn;
    } else {
      this.transcript.push(turn);
    }
    this.notifyTranscript();
  }

  private replaceUserPartialTurn(finalText: string): void {
    const existingIndex = this.transcript.findIndex(t => t.isPartial && t.sender === 'user');
    const turn: TranscriptTurn = {
      id: `turn_user_${Date.now()}`,
      sender: 'user',
      text: finalText,
      timestamp: Date.now(),
      isPartial: false,
    };

    if (existingIndex >= 0) {
      this.transcript[existingIndex] = turn;
    } else {
      this.transcript.push(turn);
    }
    this.notifyTranscript();
  }

  private addSystemMessage(text: string): void {
    this.transcript.push({
      id: `sys_${Date.now()}_${Math.random()}`,
      sender: 'system',
      text,
      timestamp: Date.now(),
    });
    this.notifyTranscript();
  }

  private setState(state: AssistantState): void {
    this.currentState = state;
    this.listeners.forEach(l => l.onStateChange(state));
  }

  private setSessionStatus(status: SessionStatus, errorDetail?: string | null): void {
    this.sessionStatus = status;
    this.listeners.forEach(l => {
      if (l.onSessionStatusChange) l.onSessionStatusChange(status, errorDetail);
    });
  }

  private notifyTranscript(): void {
    const current = this.getTranscript();
    this.listeners.forEach(l => l.onTranscriptUpdate(current));
  }

  private notifyDayState(): void {
    AppStorage.saveDayState(this.dayState);
    this.listeners.forEach(l => {
      if (l.onDayStateUpdate) l.onDayStateUpdate(this.dayState);
    });
  }

  private notifyToolCalls(): void {
    const calls = this.getToolCalls();
    this.listeners.forEach(l => {
      if (l.onToolCall) l.onToolCall(calls);
    });
  }

  private notifyRms(rms: number): void {
    this.listeners.forEach(l => l.onAudioRms(rms));
  }

  private notifyError(err: string): void {
    this.listeners.forEach(l => l.onError(err));
  }

  private clearTimers(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.responseTimer) clearTimeout(this.responseTimer);
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    this.silenceTimer = null;
    this.responseTimer = null;
    this.speakingTimer = null;
    this.isSpeechActive = false;
  }
}
