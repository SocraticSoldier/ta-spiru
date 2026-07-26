export function Section({
  eyebrow,
  title,
  children,
  tone = 'dark',
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  tone?: 'dark' | 'light';
}) {
  const dark = tone === 'dark';
  return (
    <section className={dark ? 'bg-obsidian text-ivory' : 'bg-coral-blush text-obsidian'}>
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p
          className={`font-mono text-[10px] tracking-[0.3em] uppercase mb-4 ${
            dark ? 'text-gilt' : 'text-gilt-deep'
          }`}
        >
          {eyebrow}
        </p>
        <h2 className="font-display text-3xl sm:text-4xl leading-tight mb-8">{title}</h2>
        <div className={`space-y-5 text-[15px] leading-relaxed ${dark ? 'text-ivory/80' : 'text-obsidian/80'}`}>
          {children}
        </div>
      </div>
    </section>
  );
}

export function Swatch({ name, hex, note }: { name: string; hex: string; note: string }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="w-14 h-14 rounded-md border border-ivory/15 flex-none"
        style={{ background: hex }}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm text-ivory">{name}</p>
        <p className="font-mono text-xs text-gilt">{hex}</p>
        <p className="text-xs text-ivory/60 mt-0.5">{note}</p>
      </div>
    </div>
  );
}

export function Rule({ good, bad }: { good: string; bad: string }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="rounded-lg border border-gilt/30 bg-gilt/5 p-4">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-gilt mb-2">Do</p>
        <p className="text-sm text-ivory/85">{good}</p>
      </div>
      <div className="rounded-lg border border-ivory/10 bg-ivory/[0.03] p-4">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-ivory/40 mb-2">Not</p>
        <p className="text-sm text-ivory/60">{bad}</p>
      </div>
    </div>
  );
}
