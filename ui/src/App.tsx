import { useLiveVoice } from './hooks/useLiveVoice';
import { VoiceConsole } from './components/VoiceConsole';
import { StatePanel } from './components/StatePanel';
import { Transcript } from './components/Transcript';

export default function App() {
  const {
    status,
    state,
    transcripts,
    tools,
    error,
    listening,
    connect,
    disconnect,
    sendText,
  } = useLiveVoice();

  return (
    <div className="app-shell">
      <header className="brand">
        <p className="eyebrow">Gemini Live</p>
        <h1>Chief of Staff</h1>
        <p className="tagline">
          Hands-free voice · proactive timers · calendar &amp; tasks
        </p>
      </header>

      <main className="layout">
        <div className="main-col">
          <VoiceConsole
            status={status}
            listening={listening}
            error={error}
            onConnect={() => void connect()}
            onDisconnect={disconnect}
            onSendText={sendText}
          />
          <Transcript lines={transcripts} />
          {tools.length > 0 ? (
            <div className="panel tools">
              <h2>Tool calls</h2>
              <ul>
                {tools.slice(0, 8).map((t, i) => (
                  <li key={`${t.name}-${t.at}-${i}`}>
                    <code>{t.name}</code>
                    <pre>{JSON.stringify(t.args, null, 0)}</pre>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <StatePanel state={state} />
      </main>
    </div>
  );
}
