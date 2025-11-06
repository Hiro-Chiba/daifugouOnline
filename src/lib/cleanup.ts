import type { PrismaClient } from '@prisma/client';

const STALE_ROOM_THRESHOLD_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

let lastCleanupTime = 0;

export const cleanupStaleRooms = async (prisma: PrismaClient): Promise<void> => {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }

  const cutoff = new Date(now - STALE_ROOM_THRESHOLD_MS);
  const staleRooms = await prisma.room.findMany({
    where: {
      updatedAt: { lt: cutoff }
    },
    select: { id: true }
  });

  if (staleRooms.length === 0) {
    lastCleanupTime = now;
    return;
  }

  const roomIds = staleRooms.map((room) => room.id);

  await prisma.matchPlayer.deleteMany({
    where: {
      match: {
        roomId: { in: roomIds }
      }
    }
  });

  await prisma.match.deleteMany({
    where: {
      roomId: { in: roomIds }
    }
  });

  await prisma.room.deleteMany({
    where: {
      id: { in: roomIds }
    }
  });

  lastCleanupTime = now;
};
