'use client';

import { useCallback, useEffect, useState } from 'react';
import { log } from '@/lib/jarvisLog';
import { speak } from '@/lib/speech';

type Brief = {
  greeting: string;
  motivation: { quote: string; author: string; why: string };
  tips: { title: string; body: string }[];
  astrology: { sign: string; headline: string; body: string };
  fitness: {
    title: string;
    isRestDay: boolean;
    blocks: { movement: string; prescription: string }[];
    note: string;
  };
};

type Profile = { sign: string; focus: string; split: string; constraints: string };

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const STORAGE_KEY = 'jarvis.dashboard.profile';

const DEFAULT_PROFILE: Profile = {
  sign: 'Capricorn',
  focus: '',
  split: 'Push / pull / legs, four days a week',
  constraints: '',
};

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-edge bg-ink-2 p-5">
      <h3 className="font-mono text-[10px] tracking-widest uppercase text-faint mb-3">{label}</h3>
      {children}
    </section>
  );
}

export default function DailyDashboard() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile({ ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) });
    } catch {
      // Fall back to defaults if storage is unreadable.
    }
    setLoaded(true);
  }, []);

  const saveProfile = useCallback((next: Profile) => {
    setProfile(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing can refuse writes; keep it for this session only.
    }
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setError('');
    log('info', 'daily', 'POST /api/dashboard', profile.sign);
    const startedAt = Date.now();

    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      const elapsed = Date.now() - startedAt;

      if (data.brief) {
        setBrief(data.brief as Brief);
        log('success', 'daily', `Brief in ${elapsed}ms`);
      } else {
        setError(data.error ?? 'Could not build the brief.');
        log('error', 'daily', `HTTP ${res.status} in ${elapsed}ms`, data.error);
      }
    } catch (err) {
      setError('Could not reach the server.');
      log('error', 'daily', 'Request failed', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const readAloud = () => {
    if (!brief) return;
    const script = [
      brief.greeting,
      `${brief.motivation.quote} — ${brief.motivation.author}.`,
      brief.motivation.why,
      ...brief.tips.map((tip) => `${tip.title}. ${tip.body}`),
      `Training: ${brief.fitness.title}.`,
      ...brief.fitness.blocks.map((b) => `${b.movement}, ${b.prescription}.`),
    ].join(' ');
    void speak(script);
  };

  return (
    <div className="w-full max-w-xl flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-display font-semibold text-xl">Daily</h2>
        <p className="text-sm text-muted mt-1">
          Motivation, practical tips, your sign, and today&rsquo;s session — written around what you
          tell it, not guessed.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={generate}
          disabled={loading || !loaded}
          className="rounded-full border border-edge-2 bg-ink-3 px-5 py-2 text-sm text-text hover:border-gold transition disabled:opacity-50"
        >
          {loading ? 'Writing your brief…' : brief ? "Refresh today's brief" : "Build today's brief"}
        </button>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="font-mono text-[11px] tracking-widest uppercase rounded-full border border-edge px-4 py-2 text-muted hover:text-text hover:border-edge-2 transition"
        >
          {showSettings ? 'Hide setup' : 'Setup'}
        </button>
        {brief && (
          <button
            onClick={readAloud}
            className="font-mono text-[11px] tracking-widest uppercase rounded-full border border-edge px-4 py-2 text-muted hover:text-text hover:border-edge-2 transition"
          >
            Read aloud
          </button>
        )}
      </div>

      {showSettings && (
        <section className="rounded-xl border border-edge bg-ink-2 p-5 space-y-4">
          <p className="text-xs text-muted">
            Kept on this device and sent with each request. Nothing here is stored on a server.
          </p>

          <label className="block space-y-1">
            <span className="font-mono text-[10px] tracking-widest uppercase text-faint">Star sign</span>
            <select
              value={profile.sign}
              onChange={(e) => saveProfile({ ...profile, sign: e.target.value })}
              className="w-full rounded-full border border-edge bg-ink-3 px-4 py-2 text-sm text-text focus:outline-none focus:border-gold"
            >
              {SIGNS.map((sign) => (
                <option key={sign} value={sign}>
                  {sign}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="font-mono text-[10px] tracking-widest uppercase text-faint">
              What&rsquo;s on today
            </span>
            <textarea
              value={profile.focus}
              onChange={(e) => saveProfile({ ...profile, focus: e.target.value })}
              rows={2}
              placeholder="Katana Crust demo, chase the tenant, Alma reels…"
              className="w-full rounded-xl border border-edge bg-ink-3 px-4 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-gold resize-y"
            />
          </label>

          <label className="block space-y-1">
            <span className="font-mono text-[10px] tracking-widest uppercase text-faint">Training split</span>
            <input
              value={profile.split}
              onChange={(e) => saveProfile({ ...profile, split: e.target.value })}
              className="w-full rounded-full border border-edge bg-ink-3 px-4 py-2 text-sm text-text focus:outline-none focus:border-gold"
            />
          </label>

          <label className="block space-y-1">
            <span className="font-mono text-[10px] tracking-widest uppercase text-faint">
              Constraints or niggles
            </span>
            <input
              value={profile.constraints}
              onChange={(e) => saveProfile({ ...profile, constraints: e.target.value })}
              placeholder="Dodgy left shoulder, 45 minutes max…"
              className="w-full rounded-full border border-edge bg-ink-3 px-4 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-gold"
            />
          </label>
        </section>
      )}

      {error && (
        <div className="rounded-xl border border-crimson/40 bg-crimson-soft p-4">
          <p className="text-sm text-text">{error}</p>
        </div>
      )}

      {!brief && !loading && !error && (
        <p className="text-center text-sm text-faint py-6">
          Tap <span className="text-muted">Build today&rsquo;s brief</span>. Fill in Setup first and it
          will be written around your actual day.
        </p>
      )}

      {brief && (
        <div className="flex flex-col gap-4">
          <p className="text-center text-base text-text font-display">{brief.greeting}</p>

          <Card label="Motivation">
            <blockquote className="text-base text-text leading-relaxed">
              &ldquo;{brief.motivation.quote}&rdquo;
            </blockquote>
            <p className="text-sm text-gold mt-2">— {brief.motivation.author}</p>
            <p className="text-sm text-muted mt-3">{brief.motivation.why}</p>
          </Card>

          <Card label="Today's tips">
            <ul className="space-y-3">
              {brief.tips.map((tip, i) => (
                <li key={i}>
                  <p className="text-sm text-text font-medium">{tip.title}</p>
                  <p className="text-sm text-muted mt-0.5">{tip.body}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card label={`Astrology · ${brief.astrology.sign}`}>
            <p className="text-sm text-text font-medium">{brief.astrology.headline}</p>
            <p className="text-sm text-muted mt-2">{brief.astrology.body}</p>
            <p className="text-[11px] text-faint mt-3 font-mono">
              For entertainment. Not a forecast, and not a basis for decisions.
            </p>
          </Card>

          <Card label={`Training · ${brief.fitness.title}`}>
            {brief.fitness.blocks.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {brief.fitness.blocks.map((block, i) => (
                    <tr key={i} className="border-b border-edge last:border-0">
                      <td className="py-1.5 pr-3 text-text align-top">{block.movement}</td>
                      <td className="py-1.5 text-gold font-mono text-xs whitespace-nowrap align-top text-right">
                        {block.prescription}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">Rest day.</p>
            )}
            {brief.fitness.note && (
              <p className="text-xs text-muted font-mono mt-3 border-l-2 border-gold pl-3 py-1 leading-relaxed">
                {brief.fitness.note}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
