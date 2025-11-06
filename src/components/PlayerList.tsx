'use client';

import clsx from 'clsx';
import type { PublicPlayerState } from '@/lib/game/types';

interface PlayerListProps {
  players: PublicPlayerState[];
  currentTurn: string | null;
}

const PlayerList = ({ players, currentTurn }: PlayerListProps) => {
  return (
    <ul className="player-list">
      {players.map((player) => {
        const isActive = currentTurn === player.id && !player.finished;
        return (
          <li
            key={player.id}
            className={clsx(
              'player-list-item',
              isActive && 'player-list-item-active',
              player.isSelf && 'player-list-item-self',
              player.finished && 'player-list-item-finished'
            )}
          >
            <div className="player-list-main">
              <span className="player-list-seat">席{player.seat}</span>
              <span className="player-list-name">
                {player.name}
                {player.isSelf ? '（あなた）' : ''}
              </span>
            </div>
            <div className="player-list-meta">
              {player.finished ? player.result ?? '上がり' : `手札: ${player.handCount}枚`}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default PlayerList;
