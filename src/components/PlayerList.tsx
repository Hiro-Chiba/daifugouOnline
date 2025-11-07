'use client';

import clsx from 'clsx';
import type { CSSProperties } from 'react';
import type { PublicPlayerState } from '@/lib/game/types';

interface PlayerListProps {
  players: PublicPlayerState[];
  currentTurn: string | null;
}

const PlayerList = ({ players, currentTurn }: PlayerListProps) => {
  const count = players.length || 1;
  const hasGameStarted = players.some((player) => player.handCount > 0);
  return (
    <div className="player-circle">
      {players.map((player, index) => {
        const isActive = currentTurn === player.id && !player.finished;
        const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
        const radius = 42;
        const position: CSSProperties = {
          left: `${50 + radius * Math.cos(angle)}%`,
          top: `${50 + radius * Math.sin(angle)}%`
        };
        return (
          <div
            key={player.id}
            className={clsx(
              'player-seat',
              isActive && 'player-seat-active',
              player.isSelf && 'player-seat-self',
              player.finished && 'player-seat-finished'
            )}
            style={position}
          >
            <span className="player-seat-badge">席{player.seat}</span>
            <span className="player-seat-name">
              {player.name}
              {player.isSelf ? '（あなた）' : ''}
            </span>
            <span className="player-seat-meta">
              {player.finished
                ? player.result ?? '上がり'
                : hasGameStarted
                ? `手札: ${player.handCount}枚`
                : player.ready
                ? '準備完了'
                : '準備待ち'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default PlayerList;
