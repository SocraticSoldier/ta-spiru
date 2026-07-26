import JarvisVoice from '@/components/JarvisVoice';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg border border-edge-2 bg-ink-3 grid place-items-center">
          <div
            className="w-4 h-4 rotate-45 rounded-sm"
            style={{ background: 'linear-gradient(135deg, #E7B24C 0 50%, #E01A2B 50% 100%)' }}
          />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg tracking-wide">JARVIS</h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-faint uppercase">Gemini Ltd &middot; Jake</p>
        </div>
      </div>

      <JarvisVoice />
    </main>
  );
}
