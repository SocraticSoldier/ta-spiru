import Link from 'next/link';

type Section = 'assistant' | 'malti' | 'debug';

const LINKS: { href: string; label: string; key: Section }[] = [
  { href: '/', label: 'Assistant', key: 'assistant' },
  { href: '/malti', label: 'Malti', key: 'malti' },
  { href: '/debug', label: 'Debug', key: 'debug' },
];

export default function BrandHeader({ active }: { active: Section }) {
  return (
    <header className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg border border-edge-2 bg-ink-3 grid place-items-center">
          <div
            className="w-4 h-4 rotate-45 rounded-sm"
            style={{ background: 'linear-gradient(135deg, #E7B24C 0 50%, #E01A2B 50% 100%)' }}
          />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg tracking-wide">JARVIS</h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-faint uppercase">
            Gemini Ltd &middot; Jake
          </p>
        </div>
      </div>

      <nav className="flex gap-2">
        {LINKS.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            aria-current={link.key === active ? 'page' : undefined}
            className={`font-mono text-[11px] tracking-widest uppercase rounded-full border px-3 py-1.5 transition ${
              link.key === active
                ? 'border-gold text-gold bg-gold-soft'
                : 'border-edge text-muted hover:text-text hover:border-edge-2'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
