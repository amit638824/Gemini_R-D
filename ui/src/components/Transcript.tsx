import type { TranscriptLine } from '../hooks/useLiveVoice';

export function Transcript({ lines }: { lines: TranscriptLine[] }) {
  return (
    <div className="panel transcript">
      <h2>Conversation</h2>
      <div className="transcript-scroll">
        {lines.length === 0 ? (
          <p className="muted">Speak naturally — mic streams continuously.</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`bubble ${line.role}`}>
              <span className="role">{line.role === 'user' ? 'You' : 'Chief'}</span>
              <p>{line.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
