import Pusher from 'pusher';

const appId = process.env.PUSHER_APP_ID ?? '';
const key = process.env.NEXT_PUBLIC_PUSHER_KEY ?? '';
const secret = process.env.PUSHER_SECRET ?? '';
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap3';

if (!appId || !key || !secret) {
  // eslint-disable-next-line no-console
  console.warn('Pusher サーバーキーが設定されていません');
}

export const pusherServer = new Pusher({
  appId,
  key,
  secret,
  cluster,
  useTLS: true
});
