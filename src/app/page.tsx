'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import JoinForm from '@/components/JoinForm';
import Toast from '@/components/Toast';
import { saveSession } from '@/lib/session';

const HomePage = () => {
  const router = useRouter();
  const [messages, setMessages] = useState<string[]>([]);

  const pushMessage = useCallback((message: string) => {
    setMessages((prev) => [...prev.slice(-2), message]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((item) => item !== message));
    }, 4000);
  }, []);

  const joinRoom = useCallback(
    async ({ code, name }: { code: string; name: string }) => {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name })
      });
      const data = (await response.json()) as { userId?: string; error?: string };
      if (!response.ok || !data.userId) {
        throw new Error(data.error ?? '入室に失敗しました');
      }
      saveSession({ roomCode: code, userId: data.userId, name });
      router.push(`/room/${code}`);
    },
    [router]
  );

  const handleCreate = useCallback(
    async ({ name }: { name: string }) => {
      try {
        const response = await fetch('/api/rooms/create', { method: 'POST' });
        if (!response.ok) {
          throw new Error('ルーム作成に失敗しました');
        }
        const { code } = (await response.json()) as { code: string };
        await joinRoom({ code, name });
      } catch (error) {
        pushMessage(error instanceof Error ? error.message : 'エラーが発生しました');
      }
    },
    [joinRoom, pushMessage]
  );

  const handleJoin = useCallback(
    async ({ name, code }: { name: string; code?: string }) => {
      if (!code) {
        pushMessage('ルームコードを入力してください');
        return;
      }
      try {
        await joinRoom({ code, name });
      } catch (error) {
        pushMessage(error instanceof Error ? error.message : '入室に失敗しました');
      }
    },
    [joinRoom, pushMessage]
  );

  return (
    <div className="flex-column">
      <section className="form-card">
        <h1>大富豪オンライン</h1>
        <p>友だちとリアルタイムで大富豪を楽しもう。Pusher と Prisma が同期を支えます。</p>
      </section>
      <JoinForm mode="create" onSubmit={handleCreate} />
      <JoinForm mode="join" onSubmit={handleJoin} />
      <Toast messages={messages} />
    </div>
  );
};

export default HomePage;
