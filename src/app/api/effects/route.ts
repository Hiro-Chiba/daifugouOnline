import { NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db';
import { cleanupStaleRooms } from '@/lib/cleanup';
import { pusherServer } from '@/lib/pusher-server';
import { applyEffectAction, syncForClient } from '@/lib/game/engine';
import { parseState, serializeState } from '@/lib/game/state';
import type { EffectAction, GameState, Rank } from '@/lib/game/types';

interface EffectRequestBody {
  code?: string;
  userId?: string;
  type?: EffectAction['type'];
  cards?: string[];
  rank?: Rank;
}

const validRanks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const buildAction = (body: EffectRequestBody): EffectAction | null => {
  if (!body.type || !body.userId) {
    return null;
  }
  if (body.type === 'sevenGive' || body.type === 'tenDiscard') {
    return { type: body.type, playerId: body.userId, cards: body.cards ?? [] };
  }
  if (body.type === 'queenPurge') {
    const rank = body.rank;
    if (!rank || !validRanks.includes(rank)) {
      return null;
    }
    return { type: 'queenPurge', playerId: body.userId, rank };
  }
  return null;
};

const persistResultsIfFinished = async (prisma: PrismaClient, state: GameState) => {
  if (!state.matchId || !state.finished) {
    return;
  }
  await prisma.match.update({
    where: { id: state.matchId },
    data: { finished: true }
  });
  for (const player of state.players) {
    if (player.id) {
      await prisma.matchPlayer.updateMany({
        where: { matchId: state.matchId, userId: player.id },
        data: { result: player.result ?? null }
      });
    }
  }
  await prisma.room.update({
    where: { code: state.roomCode },
    data: { isOpen: false }
  });
};

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  await cleanupStaleRooms(prisma);
  const body = (await request.json()) as EffectRequestBody;
  if (!body.code || !body.userId) {
    return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
  }

  const action = buildAction(body);
  if (!action) {
    return NextResponse.json({ error: '効果の内容が不正です' }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code: body.code } });
  if (!room) {
    return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 });
  }

  const state = parseState(room.stateJson, room.code);
  const { state: updatedState, result } = applyEffectAction(state, action);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  const serialized = serializeState(updatedState);
  await prisma.room.update({
    where: { id: room.id },
    data: {
      stateJson: serialized
    }
  });

  if (updatedState.finished) {
    await persistResultsIfFinished(prisma, updatedState);
  }

  const publicState = syncForClient(updatedState, '');
  await pusherServer.trigger(`presence-room-${room.code}`, 'effect', {
    state: publicState,
    playerId: body.userId,
    effectType: action.type
  });

  return NextResponse.json({ state: syncForClient(updatedState, body.userId) });
}
