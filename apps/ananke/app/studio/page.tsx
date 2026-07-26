import type { Metadata } from 'next';
import Link from 'next/link';
import PostStudio from '@/components/PostStudio';

export const metadata: Metadata = {
  title: 'Post studio — ΑΝΑΠΟΦΕΥΚΤΟΣ',
  description: 'Social post templates for the Inevitable content brand.',
};

export default function StudioPage() {
  return (
    <main className="min-h-screen bg-obsidian">
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <Link
          href="/"
          className="font-mono text-[10px] tracking-[0.3em] uppercase text-ivory/50 hover:text-gilt transition"
        >
          ← Brand
        </Link>
      </div>
      <PostStudio />
    </main>
  );
}
