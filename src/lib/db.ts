import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let prisma: PrismaClient | undefined;

const createClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error']
  });

export const getPrismaClient = (): PrismaClient => {
  if (prisma) {
    return prisma;
  }
  if (globalForPrisma.prisma) {
    prisma = globalForPrisma.prisma;
    return prisma;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('環境変数 DATABASE_URL が設定されていません');
  }
  prisma = createClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }
  return prisma;
};
