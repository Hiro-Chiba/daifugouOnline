import type { PublicPlayerState } from '@/lib/game/types';

interface PlayerListProps {
  players: PublicPlayerState[];
  currentTurn: string | null;
}

const PlayerList = ({ players, currentTurn }: PlayerListProps) => (
  <div className="player-list">
    {players.map((player) => (
      <div className="player-card" key={player.id}>
        <div>
          <div>
            席{player.seat}: {player.name}
            {player.isSelf ? '（あなた）' : ''}
          </div>
          <small>手札: {player.handCount}枚</small>
        </div>
        <div>
          {player.finished ? (
            <span className="badge">{player.result ?? '上がり'}</span>
          ) : currentTurn === player.id ? (
            <span className="badge">手番</span>
          ) : null}
        </div>
      </div>
    ))}
  </div>
);

export default PlayerList;
