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
    const base = createEmptyState(roomCode);
    const pendingEffects = parsed.pendingEffects ?? [];
    const hasJackReverseEffect = pendingEffects.some((effect) => effect.type === 'jackReverse');
    const flags = {
      ...base.flags,
      ...(parsed.flags ?? {})
    };
    if (typeof parsed.flags?.jackReversalActive !== 'boolean') {
      flags.jackReversalActive = hasJackReverseEffect;
    }
    if (typeof parsed.flags?.revolutionActive !== 'boolean') {
      flags.revolutionActive = false;
    }
    flags.strengthReversed = flags.revolutionActive !== flags.jackReversalActive;
    const table = {
      ...base.table,
      ...(parsed.table ?? {})
    };
    return {
      ...base,
      ...parsed,
      players,
      roomCode,
      flags,
      table
    };
  } catch (error) {
    return createEmptyState(roomCode);
  }
};

export const serializeState = (state: GameState): string => JSON.stringify(state);
