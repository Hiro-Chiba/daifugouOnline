import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db';
import { cleanupStaleRooms } from '@/lib/cleanup';
import { createEmptyState } from '@/lib/game/engine';
import { serializeState } from '@/lib/game/state';

const generateCode = (): string => {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
};

export async function POST() {
  const prisma = getPrismaClient();
  await cleanupStaleRooms(prisma);
  let code = '';
  let isUnique = false;
  while (!isUnique) {
    code = generateCode();
    const existing = await prisma.room.findUnique({ where: { code } });
    isUnique = existing === null;
  }
  const room = await prisma.room.create({
    data: {
      code,
      isOpen: true
    }
  });

  const match = await prisma.match.create({
    data: {
      roomId: room.id
    }
  });

  const state = createEmptyState(code);
  state.matchId = match.id;

  await prisma.room.update({
    where: { id: room.id },
    data: {
      stateJson: serializeState(state)
    }
  });

  return NextResponse.json({ code });
}
