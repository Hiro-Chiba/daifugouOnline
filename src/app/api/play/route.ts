import { NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db';
import { cleanupStaleRooms } from '@/lib/cleanup';
import { pusherServer } from '@/lib/pusher-server';
import { applyPlay, syncForClient } from '@/lib/game/engine';
import { parseState, serializeState } from '@/lib/game/state';
import type { Card, GameState } from '@/lib/game/types';

interface PlayRequestBody {
  code?: string;
  userId?: string;
  cards?: string[];
  name?: string;
}

const findPlayerCards = (hand: Card[], cardIds: string[]): Card[] => {
  const map = new Map(hand.map((card) => [card.id, card]));
  return cardIds
    .map((id) => map.get(id))
    .filter((card): card is Card => Boolean(card));
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
        data: { result: player.result ?? null },
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
  const body = (await request.json()) as PlayRequestBody;
  if (!body.code || !body.userId || !body.cards) {
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

  const cards = findPlayerCards(player.hand, body.cards);
  const { state: updatedState, result } = applyPlay(state, body.userId, cards);
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

  if (updatedState.matchId) {
    await prisma.match.update({
      where: { id: updatedState.matchId },
      data: {
        turns: { increment: 1 }
      }
    });
  }

  if (updatedState.finished) {
    await persistResultsIfFinished(prisma, updatedState);
  }

  const publicState = syncForClient(updatedState, '');
  await pusherServer.trigger(`presence-room-${room.code}`, 'play-card', {
    state: publicState,
    playerId: body.userId
  });

  return NextResponse.json({ state: syncForClient(updatedState, body.userId) });
}
