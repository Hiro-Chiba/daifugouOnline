import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db';
import { cleanupStaleRooms } from '@/lib/cleanup';
import { parseState, serializeState } from '@/lib/game/state';
import { removePlayer, syncForClient } from '@/lib/game/engine';
import { pusherServer } from '@/lib/pusher-server';

interface LeaveRequestBody {
  code?: string;
  userId?: string;
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  await cleanupStaleRooms(prisma);
  const body = (await request.json()) as LeaveRequestBody;

  if (!body.code || !body.userId) {
    return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code: body.code } });
  if (!room) {
    return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 });
  }

  const state = parseState(room.stateJson, room.code);
  const playerIndex = state.players.findIndex((item) => item.id === body.userId);
  if (playerIndex === -1) {
    return NextResponse.json({ error: 'プレイヤーが見つかりません' }, { status: 404 });
  }

  const leavingPlayer = state.players[playerIndex];
  const hadDealt = state.players.some((item) => item.hand.length > 0);

  removePlayer(state, leavingPlayer.id, { resultLabel: '退室' });

  await prisma.room.update({
    where: { id: room.id },
    data: {
      stateJson: serializeState(state)
    }
  });

  if (hadDealt && state.matchId) {
    await prisma.matchPlayer.updateMany({
      where: {
        matchId: state.matchId,
        userId: leavingPlayer.id
      },
      data: {
        result: '退室'
      }
    });
  }

  const publicState = syncForClient(state, '');
  await pusherServer.trigger(`presence-room-${room.code}`, 'player-left', {
    name: leavingPlayer.name,
    state: publicState
  });

  return NextResponse.json({ state: syncForClient(state, body.userId) });
}
