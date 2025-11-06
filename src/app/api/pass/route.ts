import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db';
import { cleanupStaleRooms } from '@/lib/cleanup';
import { pusherServer } from '@/lib/pusher-server';
import { applyPass, syncForClient } from '@/lib/game/engine';
import { parseState, serializeState } from '@/lib/game/state';

interface PassRequestBody {
  code?: string;
  userId?: string;
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  await cleanupStaleRooms(prisma);
  const body = (await request.json()) as PassRequestBody;
  if (!body.code || !body.userId) {
    return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code: body.code } });
  if (!room) {
    return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 });
  }

  const state = parseState(room.stateJson, room.code);
  if (state.currentTurn !== body.userId) {
    return NextResponse.json({ error: '現在はあなたの手番ではありません' }, { status: 400 });
  }

  const updatedState = applyPass(state, body.userId);
  const serialized = serializeState(updatedState);

  await prisma.room.update({
    where: { id: room.id },
    data: {
      stateJson: serialized
    }
  });

  await pusherServer.trigger(`presence-room-${room.code}`, 'pass', {
    state: syncForClient(updatedState, ''),
    playerId: body.userId
  });

  return NextResponse.json({ state: syncForClient(updatedState, body.userId) });
}
