import type { SessionStatus } from '../shared/types';

type Props = {
  status: SessionStatus;
  listening: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSendText: (text: string) => void;
};

export function VoiceConsole({
  status,
  listening,
  error,
  onConnect,
  onDisconnect,
  onSendText,
}: Props) {
  const live = status === 'live';

  return (
    <section className="voice-console">
      <div className={`orb ${live ? 'live' : ''} ${listening ? 'listening' : ''}`} />
      <p className="status-line">
        {status === 'idle' && 'Ready — start a continuous Live session'}
        {status === 'connecting' && 'Connecting to Gemini Live…'}
        {status === 'live' &&
          (listening
            ? 'Listening continuously — put the phone down, speak anytime'
            : 'Live — starting microphone…')}
        {status === 'error' && 'Session error'}
      </p>
      {error ? <p className="error">{error}</p> : null}

      <div className="cta-row">
        {!live ? (
          <button type="button" className="primary" onClick={onConnect}>
            Start Chief of Staff
          </button>
        ) : (
          <button type="button" className="danger" onClick={onDisconnect}>
            End session
          </button>
        )}
      </div>

      <form
        className="text-fallback"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const text = String(fd.get('text') ?? '').trim();
          if (!text || !live) return;
          onSendText(text);
          e.currentTarget.reset();
        }}
      >
        <input
          name="text"
          placeholder="Optional text inject (debug / noisy room)"
          disabled={!live}
          autoComplete="off"
        />
        <button type="submit" disabled={!live}>
          Send
        </button>
      </form>

      <p className="hint">
        Try: “I’m staying here for 40 minutes.” · “Save this: James ordered 250
        units for Thursday.” · “Give me another 10 minutes.” · “What should I
        prioritize?”
      </p>
    </section>
  );
}
