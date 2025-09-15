import { ChatLayout } from '@/components/chat-layout';
import { Toaster } from '@/components/ui/toaster';

export default function Home() {
  return (
    <main>
      <ChatLayout />
      <Toaster />
    </main>
  );
}
