import Image from 'next/image';
import Link from 'next/link';
import { Rule, Section, Swatch } from '@/components/BrandSection';

const PILLARS = [
  {
    name: 'The Odyssey',
    line: 'The long way home. Delay, endurance, and the cost of getting back — read as something you are living, not something you studied.',
  },
  {
    name: 'The Stoics',
    line: 'What is up to you and what is not. Marcus, Epictetus, Seneca, used plainly and quoted accurately.',
  },
  {
    name: 'The Signs',
    line: 'Astrology as character writing — disposition and archetype, never prediction. It is a mirror, not a forecast.',
  },
  {
    name: 'Necessity',
    line: 'Ananke herself. The things that were always going to happen, and what it takes to meet them upright.',
  },
];

const CHANNELS = [
  { label: 'Instagram', handle: '@anapofefktos', note: 'Primary. Portrait posts and carousels.' },
  { label: 'TikTok', handle: '@anapofefktos', note: 'Narrated myth, 30–60s.' },
  { label: 'Threads', handle: '@anapofefktos', note: 'Single lines. Text only.' },
  { label: 'Web', handle: 'anapofefktos.com', note: 'This site. Archive and links.' },
];

export default function HomePage() {
  return (
    <main>
      {/* The key art already carries the wordmark, so no type is set over it —
          the heading is present for semantics and screen readers only. */}
      <section className="relative min-h-[92vh] overflow-hidden">
        <Image
          src="/brand/anapofefktos.png"
          alt="ΑΝΑΠΟΦΕΥΚΤΟΣ — a figure in a Corinthian helmet seen from behind against a coral dusk, a gilded spine running down the neck"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <h1 className="sr-only">ΑΝΑΠΟΦΕΥΚΤΟΣ — Anapófefktos, Inevitable</h1>
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-b from-transparent via-obsidian/80 to-obsidian pt-24 pb-10 text-center">
          <p className="font-mono text-[10px] sm:text-xs tracking-[0.4em] uppercase text-ivory/70">
            Anapófefktos · Inevitable
          </p>
        </div>
      </section>

      <Section eyebrow="The name" title="Ananke — necessity, and what follows from it">
        <p>
          <strong className="text-ivory">Ἀνάγκη</strong> (Ananke) is the Greek personification of
          necessity: the force even the gods do not argue with. She is the reason the Odyssey takes ten
          years and the reason it ends anyway.
        </p>
        <p>
          <strong className="text-ivory">ΑΝΑΠΟΦΕΥΚΤΟΣ</strong> is the adjective that falls out of her —
          <em> anapófefktos</em>, inevitable, the thing that cannot be sidestepped. The brand carries the
          adjective and not the goddess, because the adjective is the part the audience already feels.
        </p>
        <p>
          One brand, three doors: myth, philosophy, astrology. They are not three topics. They are three
          ways of saying the same thing — that some of this was always coming, and the only open question
          is what you are like when it arrives.
        </p>
      </Section>

      <Section eyebrow="The marks" title="Three symbols, and what each is doing" tone="light">
        <p>
          <strong>The helmet, from behind.</strong> You never see the face. The viewer is not watching a
          hero — the viewer is standing where he stands, looking at what he is looking at. Every piece of
          key art should keep the face turned away or absent.
        </p>
        <p>
          <strong>The gilded spine.</strong> The backbone, exposed and gold-leafed. What holds you up,
          made valuable by being seen. It is the brand&rsquo;s one anatomical motif and it does the heavy
          lifting — endurance rendered as a physical object rather than a slogan.
        </p>
        <p>
          <strong>The coral dusk.</strong> Not sunrise and not night: the hour in between, when the thing
          is already decided but has not landed yet. It is the emotional temperature of the whole brand,
          and it is why the palette runs warm when the subject matter is hard.
        </p>
      </Section>

      <section className="bg-obsidian text-ivory">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-gilt mb-4">Palette</p>
          <h2 className="font-display text-3xl sm:text-4xl leading-tight mb-8">Taken from the artwork</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <Swatch name="Dusk deep" hex="#ED9774" note="Top of the sky. Headers and large fills." />
            <Swatch name="Coral" hex="#FFA489" note="The brand's centre of gravity." />
            <Swatch name="Coral light" hex="#FEB8AB" note="Mid gradient. Section washes." />
            <Swatch name="Blush" hex="#FECDC6" note="Horizon. Light-mode backgrounds." />
            <Swatch name="Obsidian" hex="#0B0B14" note="The figure. Primary dark and body text." />
            <Swatch name="Navy lift" hex="#181830" note="The cold light inside the black. Never flat." />
            <Swatch name="Gilt" hex="#C9A66B" note="The spine. Accent only — never a background." />
            <Swatch name="Ivory" hex="#FFF6F1" note="Type on dark. Warm, never pure white." />
          </div>
          <p className="text-sm text-ivory/60 mt-8 border-l-2 border-gilt pl-4 py-1">
            The black is never pure black. It carries the navy lift, which is what stops the coral looking
            like a filter and makes it look like light.
          </p>
        </div>
      </section>

      <Section eyebrow="Typography" title="A Greek Didone, and nothing decorative">
        <p>
          The wordmark is set in <strong className="text-ivory">GFS Didot</strong> — a Didone drawn for
          Greek, so the letterforms keep their thick-to-thin contrast instead of being stretched out of a
          Latin face. Wide tracking, always uppercase, always given room.
        </p>
        <p>
          Latin headings use <strong className="text-ivory">Bodoni Moda</strong>, which shares the same
          high-contrast logic. Body copy is <strong className="text-ivory">Inter</strong>: the writing is
          doing the work, so the body face should be invisible.
        </p>
        <div className="pt-4 space-y-4">
          <p className="font-display text-4xl tracking-wordmark">ΑΝΑΠΟΦΕΥΚΤΟΣ</p>
          <p className="font-display text-3xl">The long way home</p>
          <p className="text-[15px] text-ivory/70">
            Body copy sits quiet underneath. Short paragraphs, plain words, no ornament.
          </p>
        </div>
      </Section>

      <section className="bg-obsidian text-ivory border-t border-ivory/10">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-gilt mb-4">Voice</p>
          <h2 className="font-display text-3xl sm:text-4xl leading-tight mb-8">
            Certain, unhurried, never motivational-poster
          </h2>
          <div className="space-y-4">
            <Rule
              good="State the thing and stop. 'The delay was the route.'"
              bad="Stack three clauses and a rhetorical question to fill the frame."
            />
            <Rule
              good="Quote accurately, name the source, and link the translation."
              bad="Paraphrase a Stoic, attribute it to Marcus Aurelius, and hope."
            />
            <Rule
              good="Let astrology describe character — what a Scorpio is like under pressure."
              bad="Predict events, or imply someone should act on a horoscope."
            />
            <Rule
              good="Address one person, in the second person, as an equal."
              bad="Address 'you guys', 'kings', or an audience of followers."
            />
            <Rule
              good="Sit with difficulty. The brand is about what is unavoidable."
              bad="Resolve every post with an uplift line. Not everything resolves."
            />
          </div>
        </div>
      </section>

      <Section eyebrow="Content pillars" title="Four, rotating" tone="light">
        <div className="grid sm:grid-cols-2 gap-5 not-prose">
          {PILLARS.map((pillar) => (
            <div key={pillar.name} className="rounded-lg border border-obsidian/15 bg-ivory/40 p-5">
              <h3 className="font-display text-xl mb-2">{pillar.name}</h3>
              <p className="text-sm text-obsidian/75 leading-relaxed">{pillar.line}</p>
            </div>
          ))}
        </div>
        <p className="pt-2">
          Rotate them rather than batching. A week that runs myth, Stoic, sign, necessity reads as one
          mind with four moods; a week of four horoscopes reads as an astrology account.
        </p>
      </Section>

      <section className="bg-obsidian text-ivory border-t border-ivory/10">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-gilt mb-4">Channels</p>
          <h2 className="font-display text-3xl sm:text-4xl leading-tight mb-8">Where it lives</h2>
          <ul className="divide-y divide-ivory/10">
            {CHANNELS.map((channel) => (
              <li key={channel.label} className="py-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-display text-lg w-28">{channel.label}</span>
                <span className="font-mono text-sm text-gilt">{channel.handle}</span>
                <span className="text-sm text-ivory/55">{channel.note}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ivory/50 mt-6">
            Handles are the proposal, not a reservation — availability still needs checking on each
            platform before anything is printed or announced.
          </p>

          <Link
            href="/studio"
            className="inline-block mt-10 font-mono text-[11px] tracking-[0.25em] uppercase border border-gilt text-gilt rounded-full px-6 py-3 hover:bg-gilt hover:text-obsidian transition"
          >
            Open the post studio
          </Link>
        </div>
      </section>

      <footer className="bg-obsidian text-ivory/40 border-t border-ivory/10">
        <div className="mx-auto max-w-3xl px-6 py-10 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase">
            ΑΝΑΠΟΦΕΥΚΤΟΣ · a Gemini Ltd brand
          </p>
        </div>
      </footer>
    </main>
  );
}
