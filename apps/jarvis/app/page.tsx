import BrandHeader from '@/components/BrandHeader';
import JarvisVoice from '@/components/JarvisVoice';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-10 px-6 py-12">
      <BrandHeader active="assistant" />
      <JarvisVoice />
    </main>
  );
}
