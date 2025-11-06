import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db';
import { parseState, serializeState } from '@/lib/game/state';
import { syncForClient } from '@/lib/game/engine';
import { pusherServer } from '@/lib/pusher-server';

interface SyncRequestBody {
  code?: string;
  userId?: string;
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  const body = (await request.json()) as SyncRequestBody;
  if (!body.code || !body.userId) {
    return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code: body.code } });
  if (!room) {
    return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 });
  }

  const state = parseState(room.stateJson, room.code);
  const playerIndex = state.players.findIndex((player) => player.id === body.userId);
  if (playerIndex >= 0) {
    state.players[playerIndex].connected = true;
  }

  await prisma.room.update({
    where: { id: room.id },
    data: {
      stateJson: serializeState(state)
    }
  });

  const publicState = syncForClient(state, '');
  await pusherServer.trigger(`presence-room-${room.code}`, 'sync-state', { state: publicState });

  return NextResponse.json({ state: syncForClient(state, body.userId) });
}
