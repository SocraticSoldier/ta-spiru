'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type Note = { id: string; at: number; body: string };

const STORAGE_KEY = 'jarvis.vault.notes';

export default function VaultContent() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setNotes(JSON.parse(raw) as Note[]);
    } catch {
      // Corrupt or unavailable storage: start empty rather than crash.
    }
    setLoaded(true);
  }, []);

  const persist = useCallback((next: Note[]) => {
    setNotes(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing can refuse writes; the note stays for this session.
    }
  }, []);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    persist([{ id: crypto.randomUUID(), at: Date.now(), body }, ...notes]);
    setDraft('');
  };

  const remove = (id: string) => persist(notes.filter((note) => note.id !== id));

  const lock = async () => {
    await fetch('/api/vault', { method: 'DELETE' });
    router.refresh();
  };

  return (
    <div className="w-full max-w-xl flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-xl">Vault</h2>
          <p className="text-sm text-muted mt-1">Open. Private notes, kept on this device.</p>
        </div>
        <button
          onClick={lock}
          className="font-mono text-[10px] tracking-widest uppercase rounded-full border border-edge px-3 py-1.5 text-muted hover:text-text hover:border-gold transition whitespace-nowrap"
        >
          Lock
        </button>
      </div>

      <form onSubmit={add} className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Something you don't want on the main screen…"
          aria-label="New private note"
          className="w-full rounded-xl border border-edge bg-ink-2 px-4 py-3 text-sm text-text placeholder:text-faint focus:outline-none focus:border-edge-2 resize-y"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="self-end rounded-full border border-edge-2 bg-ink-3 px-4 py-2 text-sm text-text hover:border-gold transition disabled:opacity-50"
        >
          Save note
        </button>
      </form>

      {loaded && notes.length === 0 && (
        <p className="text-center text-sm text-faint py-6">Nothing saved yet.</p>
      )}

      <ul className="space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="rounded-xl border border-edge bg-ink-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-text whitespace-pre-wrap flex-1">{note.body}</p>
              <button
                onClick={() => remove(note.id)}
                aria-label="Delete note"
                className="font-mono text-[10px] tracking-widest uppercase text-faint hover:text-crimson transition"
              >
                Del
              </button>
            </div>
            <p className="font-mono text-[10px] text-faint mt-2">
              {new Date(note.at).toLocaleString('en-GB')}
            </p>
          </li>
        ))}
      </ul>

      <p className="text-xs text-faint border-l-2 border-gold pl-3 py-1 leading-relaxed">
        Straight with you about what this is: the password stops the page being served, so nobody
        reaches it from the URL alone. The notes themselves sit in this browser&rsquo;s storage
        unencrypted, so anyone who can already unlock your phone and open developer tools could read
        them. It is a locked door, not a safe — don&rsquo;t put anything here you could not afford to
        lose with the device.
      </p>
    </div>
  );
}
