import { NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db';
import { pusherServer } from '@/lib/pusher-server';
import { startGameIfReady, syncForClient } from '@/lib/game/engine';
import { MAX_PLAYERS } from '@/lib/game/constants';
import { parseState, serializeState } from '@/lib/game/state';

interface JoinRequestBody {
  code?: string;
  name?: string;
}

const findOrCreateMatch = async (prisma: PrismaClient, roomId: string) => {
  const existing = await prisma.match.findFirst({
    where: { roomId, finished: false },
    orderBy: { createdAt: 'desc' }
  });
  if (existing) {
    return existing;
  }
  return prisma.match.create({ data: { roomId } });
};

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  const body = (await request.json()) as JoinRequestBody;
  if (!body.code || !body.name) {
    return NextResponse.json({ error: 'コードと名前は必須です' }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code: body.code } });
  if (!room) {
    return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 });
  }

  const match = await findOrCreateMatch(prisma, room.id);
  const state = parseState(room.stateJson, room.code);
  state.matchId = match.id;

  if (state.players.length >= MAX_PLAYERS) {
    return NextResponse.json(
      { error: `これ以上参加できません（最大${MAX_PLAYERS}人まで）` },
      { status: 400 }
    );
  }

  const user = await prisma.user.create({
    data: { name: body.name }
  });

  const seatNumbers = state.players.map((player) => player.seat);
  let seat = 1;
  while (seatNumbers.includes(seat)) {
    seat += 1;
  }

  const existingPlayer = state.players.find((player) => player.id === user.id);
  if (!existingPlayer) {
    state.players.push({
      id: user.id,
      name: body.name,
      seat,
      hand: [],
      connected: true,
      finished: false,
      result: null,
      hasPassed: false
    });
  }

  const updatedState = startGameIfReady(state);
  const publicState = syncForClient(updatedState, user.id);

  await prisma.room.update({
    where: { id: room.id },
    data: {
      stateJson: serializeState(updatedState)
    }
  });

  await prisma.matchPlayer.upsert({
    where: {
      matchId_userId: {
        matchId: match.id,
        userId: user.id
      }
    },
    update: {
      seat
    },
    create: {
      matchId: match.id,
      userId: user.id,
      seat
    }
  });

  await pusherServer.trigger(`presence-room-${room.code}`, 'player-joined', {
    playerId: user.id,
    name: body.name,
    state: syncForClient(updatedState, '')
  });

  return NextResponse.json({ userId: user.id, matchId: match.id, state: publicState });
}
