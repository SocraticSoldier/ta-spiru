import type { Metadata } from 'next';
import BrandHeader from '@/components/BrandHeader';
import DebugConsole from '@/components/DebugConsole';

export const metadata: Metadata = {
  title: 'Debug — Jarvis',
  description: "Live trace of Jarvis's microphone, wake word and API activity.",
};

export default function DebugPage() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-10 px-6 py-12">
      <BrandHeader active="debug" />
      <DebugConsole />
    </main>
  );
}
