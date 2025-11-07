'use client';

import PlayerList from './PlayerList';
import Table from './Table';
import Hand from './Hand';
import Controls, { type EffectControlsProps } from './Controls';
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
  effectControls?: EffectControlsProps;
  statusMessageOverride?: string;
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
  connectionStatus,
  effectControls,
  statusMessageOverride
}: GameBoardProps) => {
  const players = state?.players ?? [];
  const selfPlayer = players.find((player) => player.id === selfPlayerId);
  const isMyTurn = state?.currentTurn === selfPlayerId;
  const isEffectExecutor = Boolean(effectControls && state?.activeEffect?.playerId === selfPlayerId);
  const cardMap = new Map(hand.map((card) => [card.id, card]));
  const selectionCards = selected
    .map((cardId) => cardMap.get(cardId))
    .filter((card): card is Card => Boolean(card));
  const nonJokerRanks = selectionCards
    .filter((card) => card.rank !== 'Joker')
    .map((card) => card.rank);
  const uniqueNonJokerRanks = new Set(nonJokerRanks);
  const hasUniformCombination =
    selectionCards.length > 0 &&
    (uniqueNonJokerRanks.size <= 1 || (selectionCards.length === 1 && selectionCards[0]?.rank === 'Joker'));
  const canPlay =
    !effectControls &&
    selectionCards.length === selected.length &&
    hasUniformCombination;
  const statusMessage =
    statusMessageOverride ??
    (state?.finished
      ? '対局は終了しました'
      : connectionStatus === 'reconnecting'
      ? '再接続中…'
      : undefined);
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
            isMyTurn={Boolean((isMyTurn && selfPlayer && !selfPlayer.finished) || isEffectExecutor)}
            canPlay={canPlay}
            onPlay={onPlay}
            onPass={onPass}
            loading={loading}
            statusMessage={statusMessage}
            effectControls={effectControls}
          />
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
