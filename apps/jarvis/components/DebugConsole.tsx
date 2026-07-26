'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  clearEntries,
  formatEntries,
  getEntries,
  subscribe,
  type LogEntry,
  type LogLevel,
} from '@/lib/jarvisLog';

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: 'text-muted',
  success: 'text-ok',
  warn: 'text-gold',
  error: 'text-crimson',
};

const EMPTY: LogEntry[] = [];

export default function DebugConsole() {
  // The log lives outside React (the voice loop writes to it from Web Speech
  // callbacks), so subscribe to it as an external store.
  const entries = useSyncExternalStore(subscribe, getEntries, () => EMPTY);
  const [copied, setCopied] = useState(false);
  const [env, setEnv] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    const speechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition ?? window.webkitSpeechRecognition) !== undefined;
    setEnv([
      { label: 'Wake word capable', value: speechRecognition ? 'yes' : 'no (press-to-talk only)' },
      { label: 'Speech synthesis', value: typeof window !== 'undefined' && window.speechSynthesis ? 'yes' : 'no' },
      {
        label: 'Microphone API',
        value: typeof navigator !== 'undefined' && navigator.mediaDevices ? 'yes' : 'no',
      },
      {
        label: 'Secure context',
        value: typeof window !== 'undefined' && window.isSecureContext ? 'yes' : 'no (mic will be blocked)',
      },
      {
        label: 'Installed as app',
        value:
          typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
            ? 'yes'
            : 'no (browser tab)',
      },
      {
        label: 'Service worker',
        value: typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'yes' : 'no',
      },
    ]);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatEntries(entries));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="w-full max-w-xl flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-display font-semibold text-xl">Debug</h2>
        <p className="text-sm text-muted mt-1">
          Live trace of Jarvis&rsquo;s microphone, wake word and API activity. There is no devtools on a
          phone, and a voice loop that stops re-arming looks exactly like silence — this is how you tell
          the difference.
        </p>
      </div>

      <section className="rounded-xl border border-edge bg-ink-2 p-4">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-faint mb-3">This device</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {env.map((row) => (
            <div key={row.label} className="flex justify-between gap-3 text-sm">
              <dt className="text-muted">{row.label}</dt>
              <dd
                className={`font-mono text-xs pt-0.5 ${
                  row.value.startsWith('no') ? 'text-gold' : 'text-ok'
                }`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-edge bg-ink-2 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-edge">
          <h3 className="font-mono text-[10px] tracking-widest uppercase text-faint">
            Event log · {entries.length}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={copy}
              className="font-mono text-[10px] tracking-widest uppercase rounded-full border border-edge px-3 py-1 text-muted hover:text-text hover:border-edge-2 transition"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={clearEntries}
              className="font-mono text-[10px] tracking-widest uppercase rounded-full border border-edge px-3 py-1 text-muted hover:text-text hover:border-edge-2 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-faint">
            Nothing yet. Open the Assistant and tap the circle, or look a word up in Malti, then come
            back — events are recorded for this browser session.
          </p>
        ) : (
          <ol className="divide-y divide-edge max-h-[50vh] overflow-y-auto">
            {[...entries].reverse().map((entry) => (
              <li key={entry.id} className="px-4 py-2 font-mono text-xs">
                <div className="flex gap-2 flex-wrap items-baseline">
                  <span className="text-faint">
                    {new Date(entry.at).toLocaleTimeString('en-GB', { hour12: false })}
                  </span>
                  <span className="text-faint">{entry.source}</span>
                  <span className={LEVEL_STYLE[entry.level]}>{entry.message}</span>
                </div>
                {entry.detail && (
                  <p className="text-faint mt-0.5 break-words whitespace-pre-wrap">{entry.detail}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-center text-xs text-faint">
        The log is kept in memory only — it is never sent anywhere and clears when you close the app.
      </p>
    </div>
  );
}
