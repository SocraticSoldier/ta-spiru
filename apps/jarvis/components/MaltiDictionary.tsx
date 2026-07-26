'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  detachAndAbort,
  getSpeechRecognitionCtor,
  requestMicrophone,
  speak,
} from '@/lib/speech';
import { log } from '@/lib/jarvisLog';

type Sense = { english: string; note: string };
type Inflection = { label: string; form: string; english: string };
type Example = { mt: string; en: string };

export type MaltiEntry = {
  headword: string;
  recognized: boolean;
  partOfSpeech: string;
  origin: 'Semitic' | 'Romance' | 'English' | 'Mixed' | 'Unknown';
  root: string;
  pronunciation: string;
  senses: Sense[];
  inflection: Inflection[];
  examples: Example[];
  usageNote: string;
  related: string[];
};

/** Spread across Semitic and Romance origins so the etymology field earns its place. */
const SEED_WORDS = ['bonġu', 'grazzi', 'ktieb', 'saħħa', 'mela', 'qattus'];

const ORIGIN_STYLE: Record<MaltiEntry['origin'], string> = {
  Semitic: 'text-gold border-gold/40 bg-gold-soft',
  Romance: 'text-[#7db3e8] border-[#5b9bd5]/40 bg-[#5b9bd5]/10',
  English: 'text-ok border-ok/40 bg-ok-soft',
  Mixed: 'text-muted border-edge-2 bg-ink-3',
  Unknown: 'text-muted border-edge-2 bg-ink-3',
};

export default function MaltiDictionary() {
  const [query, setQuery] = useState('');
  const [entry, setEntry] = useState<MaltiEntry | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSpeechSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  useEffect(() => {
    return () => {
      detachAndAbort(recognitionRef);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const lookup = useCallback(async (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;

    setQuery(trimmed);
    setLoading(true);
    setError('');
    setEntry(null);

    log('info', 'malti', 'POST /api/malti', trimmed);
    const startedAt = Date.now();

    try {
      const res = await fetch('/api/malti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: trimmed }),
      });
      const data = await res.json();
      const elapsed = Date.now() - startedAt;

      if (data.entry) {
        setEntry(data.entry as MaltiEntry);
        log(
          data.entry.recognized ? 'success' : 'warn',
          'malti',
          `Entry for "${trimmed}" in ${elapsed}ms`,
          data.entry.recognized ? `${data.entry.origin} · ${data.entry.partOfSpeech}` : 'not recognized',
        );
      } else {
        setError(data.error ?? 'Lookup failed.');
        log('error', 'malti', `HTTP ${res.status} in ${elapsed}ms`, data.error ?? 'no entry field');
      }
    } catch (err) {
      setError('Could not reach the server. Check your connection and try again.');
      log('error', 'malti', 'Request failed', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    if (!(await requestMicrophone())) {
      setError('Microphone access was denied.');
      log('error', 'malti', 'Microphone access denied');
      return;
    }

    detachAndAbort(recognitionRef);
    const recognition = new Ctor();
    // Browsers ship no Maltese acoustic model; this is a best-effort hint and
    // will usually fall back to the engine's default language.
    recognition.lang = 'mt-MT';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    setListening(true);
    log('info', 'malti', 'Listening for a spoken word');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const heard = event.results[0]?.[0]?.transcript?.trim() ?? '';
      log('success', 'malti', 'Heard', heard);
      if (heard) void lookup(heard);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      log('warn', 'malti', `Recognition error: ${event.error}`);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.start();
  }, [lookup]);

  return (
    <div className="w-full max-w-xl flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-display font-semibold text-xl">Malti</h2>
        <p className="text-sm text-muted mt-1">
          A context-aware Maltese dictionary — roots, plurals, conjugation and how the word is
          actually used, not just a translation.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(query);
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="A Maltese word — or an English one…"
          aria-label="Word to look up"
          className="min-w-0 flex-1 rounded-full border border-edge bg-ink-2 px-4 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-edge-2"
        />
        {speechSupported && (
          <button
            type="button"
            onClick={startListening}
            aria-label="Speak a word"
            className={`rounded-full border px-3 py-2 text-sm transition ${
              listening ? 'border-crimson text-crimson' : 'border-edge text-muted hover:border-edge-2'
            }`}
          >
            {listening ? '● ' : ''}Speak
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full border border-edge-2 bg-ink-3 px-4 py-2 text-sm text-text hover:border-gold transition disabled:opacity-50"
        >
          {loading ? '…' : 'Look up'}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 justify-center">
        {SEED_WORDS.map((word) => (
          <button
            key={word}
            onClick={() => void lookup(word)}
            className="font-mono text-xs rounded-full border border-edge bg-ink-2 px-3 py-1.5 text-muted hover:text-text hover:border-edge-2 transition"
          >
            {word}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-center font-mono text-xs tracking-widest uppercase text-muted" role="status">
          Looking up {query}…
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-crimson/40 bg-crimson-soft p-4">
          <p className="text-sm text-text">{error}</p>
        </div>
      )}

      {entry && !entry.recognized && (
        <div className="rounded-xl border border-edge bg-ink-2 p-5 space-y-2">
          <p className="font-display text-lg">Not a word I know</p>
          <p className="text-sm text-muted">{entry.usageNote || `No Maltese entry found for "${query}".`}</p>
        </div>
      )}

      {entry && entry.recognized && (
        <article className="rounded-xl border border-edge bg-ink-2 p-5 space-y-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h3 className="font-display font-bold text-2xl text-text">{entry.headword}</h3>
            <button
              onClick={() => void speak(entry.headword, 'mt-MT')}
              aria-label={`Hear ${entry.headword}`}
              className="font-mono text-[10px] tracking-widest uppercase rounded-full border border-edge px-2 py-1 text-muted hover:text-text hover:border-edge-2 transition"
            >
              Hear
            </button>
            {entry.partOfSpeech && (
              <span className="font-mono text-xs text-muted italic">{entry.partOfSpeech}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`font-mono text-[10px] tracking-widest uppercase rounded border px-2 py-1 ${ORIGIN_STYLE[entry.origin] ?? ORIGIN_STYLE.Unknown}`}
            >
              {entry.origin}
            </span>
            {entry.root && (
              <span className="font-mono text-[10px] tracking-widest uppercase rounded border border-edge-2 bg-ink-3 px-2 py-1 text-muted">
                root {entry.root}
              </span>
            )}
            {entry.pronunciation && (
              <span className="font-mono text-[10px] rounded border border-edge bg-ink-3 px-2 py-1 text-muted">
                {entry.pronunciation}
              </span>
            )}
          </div>

          {entry.senses.length > 0 && (
            <section>
              <h4 className="font-mono text-[10px] tracking-widest uppercase text-faint mb-2">Meaning</h4>
              <ol className="space-y-1.5">
                {entry.senses.map((sense, i) => (
                  <li key={i} className="text-sm text-text flex gap-2">
                    <span className="text-faint font-mono text-xs pt-0.5">{i + 1}</span>
                    <span>
                      {sense.english}
                      {sense.note && <span className="text-muted"> — {sense.note}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {entry.inflection.length > 0 && (
            <section>
              <h4 className="font-mono text-[10px] tracking-widest uppercase text-faint mb-2">Forms</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {entry.inflection.map((row, i) => (
                      <tr key={i} className="border-b border-edge last:border-0">
                        <td className="py-1.5 pr-3 font-mono text-xs text-muted whitespace-nowrap align-top">
                          {row.label}
                        </td>
                        <td className="py-1.5 pr-3 text-gold whitespace-nowrap align-top">{row.form}</td>
                        <td className="py-1.5 text-muted align-top">{row.english}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {entry.examples.length > 0 && (
            <section>
              <h4 className="font-mono text-[10px] tracking-widest uppercase text-faint mb-2">In use</h4>
              <ul className="space-y-3">
                {entry.examples.map((example, i) => (
                  <li key={i}>
                    <button
                      onClick={() => void speak(example.mt, 'mt-MT')}
                      className="text-left text-sm text-gold hover:underline"
                      aria-label={`Hear: ${example.mt}`}
                    >
                      {example.mt}
                    </button>
                    <p className="text-sm text-muted">{example.en}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entry.usageNote && (
            <p className="text-xs text-muted font-mono leading-relaxed border-l-2 border-gold pl-3 py-1">
              {entry.usageNote}
            </p>
          )}

          {entry.related.length > 0 && (
            <section>
              <h4 className="font-mono text-[10px] tracking-widest uppercase text-faint mb-2">Related</h4>
              <div className="flex flex-wrap gap-2">
                {entry.related.map((word) => (
                  <button
                    key={word}
                    onClick={() => void lookup(word)}
                    className="font-mono text-xs rounded-full border border-edge bg-ink-3 px-3 py-1 text-muted hover:text-text hover:border-gold transition"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </section>
          )}
        </article>
      )}

      <p className="text-center text-xs text-faint">
        Browsers ship no Maltese voice or speech model, so &ldquo;Hear&rdquo; and &ldquo;Speak&rdquo; fall
        back to your device&rsquo;s default language and will approximate the pronunciation. Typing is
        the reliable path.
      </p>
    </div>
  );
}
