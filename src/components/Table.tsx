import type { Card, PublicState } from '@/lib/game/types';

const suitIcon: Record<string, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠'
};

const describeCards = (cards: Card[]): string =>
  cards
    .map((card) => (card.rank === 'Joker' ? 'ジョーカー' : `${suitIcon[card.suit] ?? ''}${card.rank}`))
    .join(' ');

interface TableProps {
  state: PublicState | null;
}

const Table = ({ state }: TableProps) => {
  const lastPlay = state?.table.lastPlay;
  return (
    <div className="table-area">
      <h3>場の状況</h3>
      {lastPlay ? (
        <p>
          最終プレイ: {lastPlay.cards.length}枚 [{describeCards(lastPlay.cards)}]
        </p>
      ) : (
        <p>現在は場が流れています。</p>
      )}
      <p>
        強さ順: {state?.flags.strengthReversed ? '逆転中' : '通常'} / 順番:{' '}
        {state?.flags.rotationReversed ? '逆回り' : '通常'}
      </p>
      {state?.flags.awaitingSpade3 ? <p>ジョーカー待ち：♠3のみ返せます</p> : null}
      {state?.pendingEffects.length ? (
        <div>
          <p>未解決の効果:</p>
          <ul>
            {state.pendingEffects.map((effect, index) => (
              <li key={`${effect.type}-${index}`}>{effect.type}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <h4>ログ</h4>
      <ul className="log-list">
        {state?.table.logs.map((log) => (
          <li key={log}>{log}</li>
        ))}
      </ul>
    </div>
  );
};

export default Table;
