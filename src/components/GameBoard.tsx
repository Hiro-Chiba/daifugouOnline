'use client';

import PlayerList from './PlayerList';
import Table from './Table';
import Hand from './Hand';
import Controls from './Controls';
import type { Card, PublicState } from '@/lib/game/types';

interface GameBoardProps {
  state: PublicState | null;
  selfPlayerId: string;
  hand: Card[];
  selected: string[];
  onToggle: (cardId: string) => void;
  onPlay: () => void;
  onPass: () => void;
  loading: boolean;
  connectionStatus: 'connected' | 'reconnecting';
}

const GameBoard = ({
  state,
  selfPlayerId,
  hand,
  selected,
  onToggle,
  onPlay,
  onPass,
  loading,
  connectionStatus
}: GameBoardProps) => {
  const players = state?.players ?? [];
  const selfPlayer = players.find((player) => player.id === selfPlayerId);
  const isMyTurn = state?.currentTurn === selfPlayerId;
  const cardMap = new Map(hand.map((card) => [card.id, card]));
  const selectionCards = selected
    .map((cardId) => cardMap.get(cardId))
    .filter((card): card is Card => Boolean(card));
  const uniqueRanks = new Set(selectionCards.map((card) => card.rank));
  const canPlay =
    selectionCards.length === selected.length &&
    selectionCards.length > 0 &&
    (uniqueRanks.size === 1 || (selectionCards.length === 1 && selectionCards[0]?.rank === 'Joker'));
  const statusMessage = state?.finished
    ? '対局は終了しました'
    : connectionStatus === 'reconnecting'
    ? '再接続中…'
    : undefined;
  return (
    <div className="game-board">
      <div className="game-info-bar">
        <span className="badge">
          参加者: {players.length}人 / 接続: {connectionStatus === 'connected' ? '良好' : '再接続中'}
        </span>
      </div>
      <div className="game-stage">
        <div className="table-arena">
          <div className="table-arena-inner">
            <PlayerList players={players} currentTurn={state?.currentTurn ?? null} />
            <div className="table-center-display">
              <Table state={state} />
            </div>
          </div>
        </div>
        <div className="hand-section">
          <Hand cards={hand} selected={selected} onToggle={onToggle} />
          <Controls
            isMyTurn={Boolean(isMyTurn && selfPlayer && !selfPlayer.finished)}
            canPlay={canPlay}
            onPlay={onPlay}
            onPass={onPass}
            loading={loading}
            statusMessage={statusMessage}
          />
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
