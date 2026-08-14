import { DayState, SessionStatus } from '../shared/types';

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface TranscriptTurn {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  isPartial?: boolean;
}

export interface ToolCallItem {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  at: string;
}

export interface ScheduledCheckIn {
  id: string;
  title: string;
  targetTimestamp: number;
  durationMinutes: number;
  warnBeforeMinutes: number;
  status: 'pending' | 'triggered' | 'completed' | 'cancelled';
}

export type { DayState, SessionStatus };
