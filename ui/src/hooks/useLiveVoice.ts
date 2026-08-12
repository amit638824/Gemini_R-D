import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClientToServerMessage,
  DayState,
  ServerToClientMessage,
  SessionStatus,
} from '../shared/types';
import { emptyDayState } from '../shared/types';
import { AudioPlayer } from '../audio/player';
import { MicRecorder } from '../audio/recorder';

export type TranscriptLine = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  return `${proto}://${host}/ws/live`;
}

export function useLiveVoice() {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [state, setState] = useState<DayState>(emptyDayState());
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [tools, setTools] = useState<
    Array<{ name: string; args: unknown; result?: unknown; at: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef(new AudioPlayer());
  const micRef = useRef(new MicRecorder());
  const userPartialRef = useRef('');
  const assistantPartialRef = useRef('');

  const send = useCallback((msg: ClientToServerMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const appendTranscript = useCallback(
    (role: 'user' | 'assistant', text: string, final?: boolean) => {
      const partialRef = role === 'user' ? userPartialRef : assistantPartialRef;
      if (!final) {
        partialRef.current += text;
        const snapshot = partialRef.current;
        setTranscripts((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === role && last.id.startsWith('partial-')) {
            return [...prev.slice(0, -1), { ...last, text: snapshot }];
          }
          return [
            ...prev,
            { id: `partial-${role}-${Date.now()}`, role, text: snapshot },
          ];
        });
        return;
      }

      const full = (partialRef.current + text).trim() || text.trim();
      partialRef.current = '';
      if (!full) return;
      setTranscripts((prev) => {
        const withoutPartial = prev.filter((l) => !l.id.startsWith(`partial-${role}`));
        return [
          ...withoutPartial,
          { id: `${role}-${Date.now()}`, role, text: full },
        ];
      });
    },
    [],
  );

  const handleServerMessage = useCallback(
    (msg: ServerToClientMessage) => {
      switch (msg.type) {
        case 'status':
          setStatus(msg.status);
          if (msg.detail && msg.status === 'error') setError(msg.detail);
          break;
        case 'ready':
          setState(msg.state);
          setStatus('live');
          setError(null);
          break;
        case 'state':
          setState(msg.state);
          break;
        case 'audio':
          void playerRef.current.enqueueBase64(msg.data, msg.mimeType);
          break;
        case 'interrupted':
          playerRef.current.interrupt();
          break;
        case 'transcript':
          appendTranscript(msg.role, msg.text, msg.final);
          break;
        case 'tool':
          setTools((prev) => [
            {
              name: msg.name,
              args: msg.args,
              result: msg.result,
              at: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 30));
          break;
        case 'error':
          setError(msg.message);
          break;
        default:
          break;
      }
    },
    [appendTranscript],
  );

  const stopMic = useCallback(() => {
    micRef.current.stop();
    setListening(false);
    send({ type: 'audio_stream_end' });
  }, [send]);

  const startMic = useCallback(async () => {
    await playerRef.current.ensure();
    await micRef.current.start((data) => {
      send({ type: 'audio', data });
    });
    setListening(true);
  }, [send]);

  const connect = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      return;
    }
    setError(null);
    setStatus('connecting');
    setTranscripts([]);
    setTools([]);

    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerToClientMessage;
        handleServerMessage(msg);
      } catch (err) {
        console.error(err);
      }
    };

    ws.onopen = () => {
      // mic starts after live status — handled in effect below
    };

    ws.onerror = () => {
      setError('WebSocket error');
      setStatus('error');
    };

    ws.onclose = () => {
      stopMic();
      setStatus('idle');
      wsRef.current = null;
    };
  }, [handleServerMessage, stopMic]);

  const disconnect = useCallback(() => {
    stopMic();
    wsRef.current?.close();
    wsRef.current = null;
    void playerRef.current.close();
    playerRef.current = new AudioPlayer();
    setStatus('idle');
  }, [stopMic]);

  // Auto-start continuous mic when Live is ready
  useEffect(() => {
    if (status === 'live' && !listening) {
      void startMic().catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    }
  }, [status, listening, startMic]);

  useEffect(() => {
    return () => {
      stopMic();
      wsRef.current?.close();
      void playerRef.current.close();
    };
  }, [stopMic]);

  const sendText = useCallback(
    (text: string) => {
      send({ type: 'text', text });
      setTranscripts((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: 'user', text },
      ]);
    },
    [send],
  );

  return {
    status,
    state,
    transcripts,
    tools,
    error,
    listening,
    connect,
    disconnect,
    sendText,
  };
}
