/**
 * A tiny in-memory event log for Jarvis.
 *
 * Jarvis runs on a phone, where there is no practical way to open devtools —
 * and its voice loop is driven by Web Speech callbacks that fail silently
 * (a recognition that stops re-arming looks identical to nobody talking).
 * The /debug console reads this log so those failures become visible.
 *
 * Client-side only, capped, and never persisted.
 */

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export type LogEntry = {
  id: number;
  at: number;
  level: LogLevel;
  source: string;
  message: string;
  detail?: string;
};

const MAX_ENTRIES = 200;

let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<(entries: LogEntry[]) => void>();

function emit() {
  for (const listener of listeners) listener(entries);
}

export function log(level: LogLevel, source: string, message: string, detail?: unknown) {
  const entry: LogEntry = {
    id: nextId++,
    at: Date.now(),
    level,
    source,
    message,
    detail: detail === undefined ? undefined : safeStringify(detail),
  };
  // New array each time so subscribers relying on identity re-render.
  entries = [...entries, entry].slice(-MAX_ENTRIES);
  emit();
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function getEntries(): LogEntry[] {
  return entries;
}

export function clearEntries() {
  entries = [];
  emit();
}

export function subscribe(listener: (entries: LogEntry[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Formats the log as plain text so it can be copied off a phone. */
export function formatEntries(list: LogEntry[] = entries): string {
  return list
    .map((entry) => {
      const time = new Date(entry.at).toISOString().slice(11, 23);
      const detail = entry.detail ? ` — ${entry.detail}` : '';
      return `${time} [${entry.level.toUpperCase()}] ${entry.source}: ${entry.message}${detail}`;
    })
    .join('\n');
}
