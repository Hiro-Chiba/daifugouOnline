'use client';

import { useMemo, useRef } from 'react';
import type { PublicPlayerState } from '@/lib/game/types';

interface PlayerListProps {
  players: PublicPlayerState[];
  currentTurn: string | null;
}

type LayoutState = {
  key: string;
  order: string[];
  offset: number;
};

const PlayerList = ({ players, currentTurn }: PlayerListProps) => {
  const layoutRef = useRef<LayoutState>({ key: '', order: [], offset: Math.random() * Math.PI * 2 });

  const playerMap = useMemo(() => {
    const map = new Map<string, PublicPlayerState>();
    players.forEach((player) => {
      map.set(player.id, player);
    });
    return map;
  }, [players]);

  const layout = useMemo(() => {
    const ids = players.map((player) => player.id);
    const key = [...ids].sort().join('-');
    if (layoutRef.current.key !== key) {
      const order = [...ids];
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const offset = Math.random() * Math.PI * 2;
      layoutRef.current = { key, order, offset };
    }
    return layoutRef.current;
  }, [players]);

  const { order, offset } = layout;
  const total = order.length;

  return (
    <div className="player-ring">
      {order.map((playerId, index) => {
        const player = playerMap.get(playerId);
        if (!player) {
          return null;
        }
        const angle = offset + ((index / Math.max(total, 1)) * Math.PI * 2);
        const left = 50 + 45 * Math.cos(angle);
        const top = 50 + 45 * Math.sin(angle);
        const isActive = currentTurn === player.id && !player.finished;
        const classes = [
          'player-seat',
          isActive ? 'player-seat-active' : '',
          player.isSelf ? 'player-seat-self' : '',
          player.finished ? 'player-seat-finished' : ''
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div key={player.id} className={classes} style={{ left: `${left}%`, top: `${top}%` }}>
            <div className="player-seat-label">席{player.seat}</div>
            <div className="player-seat-name">
              {player.name}
              {player.isSelf ? '（あなた）' : ''}
            </div>
            <div className="player-seat-meta">
              {player.finished ? player.result ?? '上がり' : `手札: ${player.handCount}枚`}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlayerList;
