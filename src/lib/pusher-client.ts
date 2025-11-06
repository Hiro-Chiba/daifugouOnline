'use client';

import PusherClient from 'pusher-js';

declare global {
  interface Window {
    __pusherClient?: PusherClient;
  }
}

export const getPusherClient = () => {
  if (typeof window === 'undefined') {
    throw new Error('Pusher クライアントはブラウザでのみ利用できます');
  }

  if (!window.__pusherClient) {
    window.__pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY ?? '', {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap3',
      authEndpoint: '/api/pusher-auth',
      auth: {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    });
  }

  return window.__pusherClient;
};
