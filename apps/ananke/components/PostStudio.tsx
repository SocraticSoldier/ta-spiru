'use client';

import { useEffect, useRef, useState } from 'react';

type TemplateId = 'quote' | 'statement' | 'sign';

const FORMATS: Record<TemplateId, { w: number; h: number; label: string }> = {
  quote: { w: 1080, h: 1350, label: 'Portrait · 4:5 · feed' },
  statement: { w: 1080, h: 1080, label: 'Square · 1:1 · feed' },
  sign: { w: 1080, h: 1920, label: 'Story · 9:16' },
};

/**
 * Renders the card at true export dimensions and scales it down to fit, so the
 * preview is pixel-accurate rather than an approximation that shifts on export.
 */
function Stage({ w, h, children }: { w: number; h: number; children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setScale(box.clientWidth / w);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [w]);

  return (
    // overflow-hidden matters: the child keeps its full 1080px layout box
    // (transforms don't affect layout), so without it the card spills out.
    <div ref={boxRef} className="w-full overflow-hidden" style={{ height: h * scale }}>
      <div
        style={{
          width: w,
          height: h,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function PostStudio() {
  const [template, setTemplate] = useState<TemplateId>('quote');
  const [quote, setQuote] = useState('The delay was the route.');
  const [attribution, setAttribution] = useState('Book IX');
  const [greek, setGreek] = useState('ΑΝΑΠΟΦΕΥΚΤΟ');
  const [caption, setCaption] = useState(
    'Ten years to cross a sea he could see from the shore. The delay was not an interruption of the journey. It was the journey.\n\n#anapofefktos #odyssey #stoic',
  );
  const [copied, setCopied] = useState(false);

  const format = FORMATS[template];

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-gilt mb-4">Post studio</p>
      <h1 className="font-display text-4xl mb-3">Templates</h1>
      <p className="text-ivory/70 text-[15px] max-w-2xl mb-10">
        Each card renders at full export size and is scaled to fit, so what you see is what you get.
        Screenshot the frame at 1&times; or hand the values to the designer — the type scale and margins
        are the spec.
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {(Object.keys(FORMATS) as TemplateId[]).map((id) => (
          <button
            key={id}
            onClick={() => setTemplate(id)}
            className={`font-mono text-[11px] tracking-[0.2em] uppercase rounded-full border px-4 py-2 transition ${
              template === id
                ? 'border-gilt text-gilt bg-gilt/10'
                : 'border-ivory/20 text-ivory/60 hover:text-ivory hover:border-ivory/40'
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-10 items-start">
        {/* min-w-0: a 1fr track has auto min-width, so the 1080px card would
            otherwise force the column wider instead of scaling down into it. */}
        <div className="min-w-0">
          <div className="border border-ivory/15 rounded-lg overflow-hidden">
            <Stage w={format.w} h={format.h}>
              {template === 'quote' && (
                <div className="dusk w-full h-full flex flex-col justify-between p-[90px]">
                  <p
                    className="font-display text-obsidian/60 uppercase"
                    style={{ fontSize: 30, letterSpacing: '0.35em' }}
                  >
                    ΑΝΑΠΟΦΕΥΚΤΟΣ
                  </p>
                  <p
                    className="font-display text-obsidian"
                    style={{ fontSize: 96, lineHeight: 1.12 }}
                  >
                    {quote}
                  </p>
                  <p className="font-mono text-obsidian/60" style={{ fontSize: 28, letterSpacing: '0.2em' }}>
                    {attribution}
                  </p>
                </div>
              )}

              {template === 'statement' && (
                <div className="w-full h-full bg-obsidian flex flex-col items-center justify-center p-[90px] text-center">
                  <p
                    className="font-display text-ivory"
                    style={{ fontSize: 88, letterSpacing: '0.14em', lineHeight: 1.15 }}
                  >
                    {greek}
                  </p>
                  <div className="bg-gilt" style={{ width: 120, height: 2, margin: '54px 0' }} />
                  <p className="font-display text-ivory/85" style={{ fontSize: 52, lineHeight: 1.3 }}>
                    {quote}
                  </p>
                </div>
              )}

              {template === 'sign' && (
                <div className="w-full h-full bg-obsidian flex flex-col justify-between p-[90px]">
                  <p
                    className="font-display text-gilt uppercase"
                    style={{ fontSize: 32, letterSpacing: '0.35em' }}
                  >
                    ΑΝΑΠΟΦΕΥΚΤΟΣ
                  </p>
                  <div>
                    <p
                      className="font-display text-ivory"
                      style={{ fontSize: 110, lineHeight: 1.05, marginBottom: 40 }}
                    >
                      {greek}
                    </p>
                    <div className="bg-gilt" style={{ width: 160, height: 2, marginBottom: 40 }} />
                    <p className="font-display text-ivory/80" style={{ fontSize: 54, lineHeight: 1.3 }}>
                      {quote}
                    </p>
                  </div>
                  <p className="font-mono text-ivory/40" style={{ fontSize: 26, letterSpacing: '0.2em' }}>
                    {attribution}
                  </p>
                </div>
              )}
            </Stage>
          </div>
          <p className="font-mono text-[11px] text-ivory/40 mt-3">
            {format.label} · {format.w}&times;{format.h}px
          </p>
        </div>

        <div className="space-y-5">
          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-gilt">Line</span>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-ivory/20 bg-ivory/5 px-3 py-2 text-sm text-ivory focus:outline-none focus:border-gilt resize-y"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-gilt">Greek word</span>
            <input
              value={greek}
              onChange={(e) => setGreek(e.target.value)}
              className="w-full rounded-lg border border-ivory/20 bg-ivory/5 px-3 py-2 text-sm text-ivory font-display tracking-widest focus:outline-none focus:border-gilt"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-gilt">Attribution</span>
            <input
              value={attribution}
              onChange={(e) => setAttribution(e.target.value)}
              className="w-full rounded-lg border border-ivory/20 bg-ivory/5 px-3 py-2 text-sm text-ivory focus:outline-none focus:border-gilt"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-gilt">Caption</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={7}
              className="w-full rounded-lg border border-ivory/20 bg-ivory/5 px-3 py-2 text-sm text-ivory focus:outline-none focus:border-gilt resize-y"
            />
          </label>

          <button
            onClick={copyCaption}
            className="w-full font-mono text-[11px] tracking-[0.2em] uppercase border border-gilt text-gilt rounded-full px-4 py-2.5 hover:bg-gilt hover:text-obsidian transition"
          >
            {copied ? 'Copied' : 'Copy caption'}
          </button>
        </div>
      </div>
    </div>
  );
}
