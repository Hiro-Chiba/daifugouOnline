import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db';
import { cleanupStaleRooms } from '@/lib/cleanup';
import { parseState, serializeState } from '@/lib/game/state';
import { pusherServer } from '@/lib/pusher-server';
import { startGameIfReady, syncForClient } from '@/lib/game/engine';
import { MIN_PLAYERS } from '@/lib/game/constants';

interface StartRequestBody {
  code?: string;
  userId?: string;
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  await cleanupStaleRooms(prisma);
  const body = (await request.json()) as StartRequestBody;

  if (!body.code || !body.userId) {
    return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code: body.code } });
  if (!room) {
    return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 });
  }

  const state = parseState(room.stateJson, room.code);
  const player = state.players.find((item) => item.id === body.userId);
  if (!player) {
    return NextResponse.json({ error: 'プレイヤーが見つかりません' }, { status: 404 });
  }

  const alreadyDealt = state.players.some((item) => item.hand.length > 0);
  if (alreadyDealt) {
    return NextResponse.json({ error: 'すでにゲームが開始されています' }, { status: 400 });
  }

  if (player.ready) {
    return NextResponse.json({ state: syncForClient(state, body.userId) });
  }

  if (state.players.length < MIN_PLAYERS) {
    return NextResponse.json(
      { error: `${MIN_PLAYERS}人以上揃ってから開始してください` },
      { status: 400 }
    );
  }

  player.ready = true;
  const updatedState = startGameIfReady(state);
  const dealt = updatedState.players.some((item) => item.hand.length > 0);
  if (!dealt) {
    await prisma.room.update({
      where: { id: room.id },
      data: {
        stateJson: serializeState(updatedState)
      }
    });

    const publicState = syncForClient(updatedState, '');
    await pusherServer.trigger(`presence-room-${room.code}`, 'system-message', {
      message: `${player.name} さんが開始準備OKです`,
      state: publicState
    });

    return NextResponse.json({ state: syncForClient(updatedState, body.userId) });
  }

  await prisma.room.update({
    where: { id: room.id },
    data: {
      stateJson: serializeState(updatedState)
    }
  });

  const publicState = syncForClient(updatedState, '');
  await pusherServer.trigger(`presence-room-${room.code}`, 'system-message', {
    message: 'ゲームが開始されました',
    state: publicState
  });

  return NextResponse.json({ state: syncForClient(updatedState, body.userId) });
}
