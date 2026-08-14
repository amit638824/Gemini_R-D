import { AssistantState, TranscriptTurn, ToolCallItem, DayState, SessionStatus } from './types';
import { AudioChunkPayload } from '../native/VoiceBridge';

export interface SessionManagerListener {
  onStateChange: (state: AssistantState) => void;
  onTranscriptUpdate: (turns: TranscriptTurn[]) => void;
  onAudioRms: (rms: number) => void;
  onDayStateUpdate?: (dayState: DayState) => void;
  onToolCall?: (tools: ToolCallItem[]) => void;
  onSessionStatusChange?: (status: SessionStatus, errorDetail?: string | null) => void;
  onError: (error: string) => void;
}

export interface ISessionManager {
  startSession(): Promise<void>;
  stopSession(): Promise<void>;
  processAudioChunk(data: AudioChunkPayload): void;
  sendTextMessage(text: string): void;
  connectWebSocket(url?: string): Promise<void>;
  disconnectWebSocket(): void;
  getState(): AssistantState;
  getSessionStatus(): SessionStatus;
  getDayState(): DayState;
  getToolCalls(): ToolCallItem[];
  getTranscript(): TranscriptTurn[];
  addListener(listener: SessionManagerListener): () => void;
  clearTranscript(): void;
}
