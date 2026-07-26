import type { Metadata } from 'next';
import BrandHeader from '@/components/BrandHeader';
import MaltiDictionary from '@/components/MaltiDictionary';

export const metadata: Metadata = {
  title: 'Malti — Jarvis',
  description: 'Context-aware Maltese dictionary: roots, plurals, conjugation and real usage.',
};

export default function MaltiPage() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-10 px-6 py-12">
      <BrandHeader active="malti" />
      <MaltiDictionary />
    </main>
  );
}
