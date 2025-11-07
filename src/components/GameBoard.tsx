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
  const nonJokerRanks = new Set(
    selectionCards.filter((card) => card.rank !== 'Joker').map((card) => card.rank)
  );
  const hasUniformRank = nonJokerRanks.size <= 1;
  const effectLock =
    state?.pendingEffects.some((effect) => {
      if (!effect.payload || effect.payload.playerId !== selfPlayerId) {
        return false;
      }
      if (effect.type === 'sevenGive' || effect.type === 'tenDiscard') {
        return true;
      }
      if (effect.type === 'queenPurge') {
        const remaining =
          typeof effect.payload.remaining === 'number'
            ? effect.payload.remaining
            : typeof effect.payload.count === 'number'
            ? effect.payload.count
            : 0;
        return remaining > 0;
      }
      return false;
    }) ?? false;
  const canPlay =
    selectionCards.length === selected.length &&
    selectionCards.length > 0 &&
    hasUniformRank &&
    !effectLock;
  const canPass = !effectLock;
  const statusMessage = state?.finished
    ? '対局は終了しました'
    : connectionStatus === 'reconnecting'
    ? '再接続中…'
    : undefined;
  const connectionLabel = connectionStatus === 'connected' ? '良好' : '再接続中';
  return (
    <div className="game-board">
      <div className="board-header">
        <div className="board-status">
          <span className="badge">参加者: {players.length}人</span>
          <span className={`badge badge-${connectionStatus}`}>接続: {connectionLabel}</span>
        </div>
      </div>
      <div className="round-table-section">
        <div className="round-table-wrapper">
          <div className="round-table-surface" />
          <div className="round-table-center">
            <Table state={state} />
          </div>
          <PlayerList players={players} currentTurn={state?.currentTurn ?? null} />
        </div>
      </div>
      <section className="hand-panel">
        <div className="hand-header">
          <h3>あなたの手札</h3>
          {selfPlayer ? <span className="hand-count">残り {selfPlayer.handCount}枚</span> : null}
        </div>
        <Hand cards={hand} selected={selected} onToggle={onToggle} />
        <Controls
          isMyTurn={Boolean(isMyTurn && selfPlayer && !selfPlayer.finished)}
          canPlay={canPlay}
          onPlay={onPlay}
          onPass={onPass}
          loading={loading}
          statusMessage={statusMessage}
          canPass={canPass}
        />
      </section>
    </div>
  );
};

export default GameBoard;
