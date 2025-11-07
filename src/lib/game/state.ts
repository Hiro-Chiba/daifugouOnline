import { createEmptyState } from './engine';
import type { GameState } from './types';

export const parseState = (input: string | null | undefined, roomCode: string): GameState => {
  if (!input) {
    return createEmptyState(roomCode);
  }
  try {
    const parsed = JSON.parse(input) as GameState;
    const players = (parsed.players ?? []).map((player) => ({
      ...player,
      ready: Boolean(player.ready)
    }));
    return {
      ...createEmptyState(roomCode),
      ...parsed,
      players,
      roomCode
    };
  } catch (error) {
    return createEmptyState(roomCode);
  }
};

export const serializeState = (state: GameState): string => JSON.stringify(state);
