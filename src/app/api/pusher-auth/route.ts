import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher-server';

interface AuthBody {
  socket_id?: string;
  channel_name?: string;
  user_id?: string;
  name?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as AuthBody;
  if (!body.socket_id || !body.channel_name || !body.user_id || !body.name) {
    return NextResponse.json({ error: '認証情報が不足しています' }, { status: 400 });
  }

  const authResponse = pusherServer.authenticate(body.socket_id, body.channel_name, {
    user_id: body.user_id,
    user_info: {
      name: body.name
    }
  });

  return NextResponse.json(authResponse);
}
