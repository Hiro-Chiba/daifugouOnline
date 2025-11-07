'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GameBoard from '@/components/GameBoard';
import Toast from '@/components/Toast';
import EffectModal from '@/components/EffectModal';
import { getPusherClient } from '@/lib/pusher-client';
import { MIN_PLAYERS, MAX_PLAYERS } from '@/lib/game/constants';
import type { Card, PublicState, Rank, Effect } from '@/lib/game/types';
import { clearSession, loadSession, saveSession } from '@/lib/session';

interface SyncResponse {
  state: PublicState;
}

interface PlayResponse {
  state: PublicState;
}

interface StartResponse {
  state: PublicState;
}

interface LeaveResponse {
  state: PublicState;
}

const hydrateState = (state: PublicState, userId: string, handOverride?: Card[]): PublicState => ({
  ...state,
  players: state.players.map((player) => {
    if (player.id === userId) {
      const hand = handOverride ?? player.hand ?? [];
      return {
        ...player,
        isSelf: true,
        hand,
        handCount: hand.length
      };
    }
    return {
      ...player,
      isSelf: false,
      hand: undefined
    };
  })
});

const queenRankOptions: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const getEffectSelectableCount = (effect: Effect | null): number => {
  if (!effect?.payload) {
    return 0;
  }
  if (typeof effect.payload.remaining === 'number') {
    return effect.payload.remaining;
  }
  if (typeof effect.payload.count === 'number') {
    return effect.payload.count;
  }
  return 0;
};

const RoomPage = () => {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const [state, setState] = useState<PublicState | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [effectSelection, setEffectSelection] = useState<string[]>([]);
  const [effectRank, setEffectRank] = useState<Rank>('3');
  const [effectLoading, setEffectLoading] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting'>('connected');
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(true);
  const queenEffectSignatureRef = useRef<string | null>(null);

  const roomCode = useMemo(() => (typeof params.code === 'string' ? params.code : params.code?.[0] ?? ''), [params.code]);

  const activeEffect = useMemo<Effect | null>(() => {
    if (!state || !session) {
      return null;
    }
    return (
      state.pendingEffects.find((effect) => {
        if (!effect.payload || effect.payload.playerId !== session.userId) {
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
      }) ?? null
    );
  }, [session, state]);

  const effectLimit = useMemo(() => getEffectSelectableCount(activeEffect), [activeEffect]);

  useEffect(() => {
    if (!session || session.roomCode !== roomCode) {
      const stored = loadSession();
      if (!stored || stored.roomCode !== roomCode) {
        router.replace('/');
        return;
      }
      setSession(stored);
    }
  }, [roomCode, router, session]);

  useEffect(() => {
    if (!activeEffect) {
      setEffectSelection([]);
      setEffectLoading(false);
      queenEffectSignatureRef.current = null;
      return;
    }
    setEffectSelection([]);
    setEffectLoading(false);
    if (activeEffect.type === 'queenPurge') {
      const declared = new Set(activeEffect.payload?.declaredRanks ?? []);
      const signature = JSON.stringify({
        type: activeEffect.type,
        declared: activeEffect.payload?.declaredRanks ?? [],
        remaining:
          typeof activeEffect.payload?.remaining === 'number'
            ? activeEffect.payload?.remaining
            : typeof activeEffect.payload?.count === 'number'
            ? activeEffect.payload?.count
            : null
      });
      const currentValid = effectRank ? !declared.has(effectRank) : false;
      if (!currentValid || queenEffectSignatureRef.current !== signature) {
        const nextRank = queenRankOptions.find((option) => !declared.has(option)) ?? '3';
        setEffectRank(nextRank);
      }
      queenEffectSignatureRef.current = signature;
    } else {
      queenEffectSignatureRef.current = null;
    }
  }, [activeEffect, effectRank]);

  useEffect(() => {
    setEffectSelection((prev) => prev.filter((id) => hand.some((card) => card.id === id)));
  }, [hand]);

  const pushMessage = useCallback((message: string) => {
    setMessages((prev) => [...prev.slice(-2), message]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((item) => item !== message));
    }, 4000);
  }, []);

  const updateState = useCallback(
    (incoming: PublicState, handOverride?: Card[]) => {
      if (!session) {
        return;
      }
      const next = hydrateState(incoming, session.userId, handOverride ?? hand);
      setState(next);
    },
    [hand, session]
  );

  const applyIncomingState = useCallback(
    (incoming: PublicState) => {
      if (!session) {
        return;
      }
      const selfPlayer = incoming.players.find((player) => player.id === session.userId);
      const nextHand = (selfPlayer?.hand ?? []) as Card[];
      setHand(nextHand);
      setSelected((prev) => prev.filter((id) => nextHand.some((card) => card.id === id)));
      setEffectSelection((prev) => prev.filter((id) => nextHand.some((card) => card.id === id)));
      updateState(incoming, nextHand);
    },
    [session, updateState]
  );

  const syncState = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, userId: session.userId })
      });
      if (!response.ok) {
        pushMessage('状態の取得に失敗しました');
        return;
      }
      const data = (await response.json()) as SyncResponse;
      applyIncomingState(data.state);
    } catch (error) {
      pushMessage('通信エラーが発生しました');
    }
  }, [applyIncomingState, pushMessage, roomCode, session]);

  useEffect(() => {
    if (!session) {
      return;
    }
    syncState().catch(() => {
      pushMessage('同期に失敗しました');
    });
  }, [session, syncState, pushMessage]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const pusher = getPusherClient();
    const channelName = `presence-room-${roomCode}`;
    const channel = pusher.subscribe(channelName);

    const handleStateEvent = (payload: { state: PublicState; message?: string }) => {
      applyIncomingState(payload.state);
      if (payload.message) {
        pushMessage(payload.message);
      }
    };

    channel.bind('play-card', handleStateEvent);
    channel.bind('pass', handleStateEvent);
    channel.bind('effect', handleStateEvent);
    channel.bind('player-joined', (payload: { name: string; state: PublicState }) => {
      applyIncomingState(payload.state);
      pushMessage(`${payload.name} さんが入室しました`);
    });
    channel.bind('player-left', (payload: { name: string; state?: PublicState }) => {
      if (payload.state) {
        applyIncomingState(payload.state);
      }
      pushMessage(`${payload.name} さんが退室しました`);
    });
    channel.bind('system-message', (payload: { message: string; state?: PublicState }) => {
      if (payload.state) {
        applyIncomingState(payload.state);
      }
      pushMessage(payload.message);
    });
    channel.bind('sync-state', (payload: { state: PublicState }) => {
      applyIncomingState(payload.state);
    });

    const connection = pusher.connection;
    const handleConnectionChange = (states: { current: string }) => {
      setConnectionStatus(states.current === 'connected' ? 'connected' : 'reconnecting');
    };
    connection.bind('state_change', handleConnectionChange);

    return () => {
      channel.unbind('play-card', handleStateEvent);
      channel.unbind('pass', handleStateEvent);
      channel.unbind('effect', handleStateEvent);
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      connection.unbind('state_change', handleConnectionChange);
    };
  }, [applyIncomingState, roomCode, session, pushMessage]);

  const toggleCard = useCallback(
    (cardId: string) => {
      setSelected((prev) =>
        prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      );
    },
    []
  );

  const handleEffectCardToggle = useCallback(
    (cardId: string) => {
      if (!activeEffect) {
        return;
      }
      setEffectSelection((prev) => {
        if (prev.includes(cardId)) {
          return prev.filter((id) => id !== cardId);
        }
        if (activeEffect.type === 'queenPurge') {
          return prev;
        }
        if (effectLimit > 0 && prev.length >= effectLimit) {
          pushMessage(`最大${effectLimit}枚まで選べます`);
          return prev;
        }
        if (effectLimit === 0) {
          pushMessage('この効果ではカードを選択できません');
          return prev;
        }
        return [...prev, cardId];
      });
    },
    [activeEffect, effectLimit, pushMessage]
  );

  const handlePlay = useCallback(async () => {
    if (!session || selected.length === 0) {
      return;
    }
    try {
      setLoading(true);
      const response = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, userId: session.userId, cards: selected })
      });
      const data = (await response.json()) as PlayResponse & { error?: string };
      if (!response.ok) {
        pushMessage(data.error ?? '出札に失敗しました');
        return;
      }
      applyIncomingState(data.state);
      setSelected([]);
      setEffectSelection([]);
      saveSession({ ...session, roomCode });
    } catch (error) {
      pushMessage('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [applyIncomingState, pushMessage, roomCode, selected, session]);

  const handlePass = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      setLoading(true);
      const response = await fetch('/api/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, userId: session.userId })
      });
      const data = (await response.json()) as PlayResponse & { error?: string };
      if (!response.ok) {
        pushMessage(data.error ?? 'パスに失敗しました');
        return;
      }
      applyIncomingState(data.state);
      saveSession({ ...session, roomCode });
    } catch (error) {
      pushMessage('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [applyIncomingState, pushMessage, roomCode, session]);

  const handleStartGame = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      setStartLoading(true);
      const response = await fetch('/api/rooms/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, userId: session.userId })
      });
      const data = (await response.json()) as StartResponse & { error?: string };
      if (!response.ok) {
        pushMessage(data.error ?? 'ゲーム開始に失敗しました');
        return;
      }
      applyIncomingState(data.state);
      setSelected([]);
      setEffectSelection([]);
      saveSession({ ...session, roomCode });
    } catch (error) {
      pushMessage('通信エラーが発生しました');
    } finally {
      setStartLoading(false);
    }
  }, [applyIncomingState, pushMessage, roomCode, session]);

  const handleLeaveRoom = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      setLeaveLoading(true);
      const response = await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, userId: session.userId })
      });
      const data = (await response.json()) as LeaveResponse & { error?: string };
      if (!response.ok) {
        pushMessage(data.error ?? '退室に失敗しました');
        return;
      }
      clearSession();
      setSession(null);
      pushMessage('ルームを退出しました');
      router.replace('/');
    } catch (error) {
      pushMessage('通信エラーが発生しました');
    } finally {
      setLeaveLoading(false);
    }
  }, [roomCode, session, pushMessage, router]);

  const handleEffectSubmit = useCallback(
    async (options?: { skip?: boolean }) => {
      if (!session || !activeEffect) {
        return;
      }
      if (
        (activeEffect.type === 'sevenGive' || activeEffect.type === 'tenDiscard') &&
        !options?.skip &&
        effectSelection.length > effectLimit
      ) {
        pushMessage(`最大${effectLimit}枚まで選べます`);
        return;
      }
      try {
        setEffectLoading(true);
        const payload: Record<string, unknown> = {
          code: roomCode,
          userId: session.userId,
          type: activeEffect.type
        };
        if (activeEffect.type === 'sevenGive' || activeEffect.type === 'tenDiscard') {
          const limit = effectLimit > 0 ? effectLimit : effectSelection.length;
          const cards = options?.skip ? [] : effectSelection.slice(0, limit);
          payload.cards = cards;
        } else if (activeEffect.type === 'queenPurge') {
          payload.rank = effectRank;
        }
        const response = await fetch('/api/effects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = (await response.json()) as PlayResponse & { error?: string };
        if (!response.ok) {
          pushMessage(data.error ?? '効果の処理に失敗しました');
          return;
        }
        applyIncomingState(data.state);
        setEffectSelection([]);
      } catch (error) {
        pushMessage('通信エラーが発生しました');
      } finally {
        setEffectLoading(false);
      }
    },
    [
      activeEffect,
      applyIncomingState,
      effectLimit,
      effectRank,
      effectSelection,
      pushMessage,
      roomCode,
      session
    ]
  );

  if (!session) {
    return null;
  }

  const playersCount = state?.players.length ?? 0;
  const hasGameStarted = state?.players.some((player) => player.handCount > 0) ?? false;
  const readyCount = state ? state.players.filter((player) => player.ready).length : 0;
  const selfReady = state?.players.find((player) => player.id === session.userId)?.ready ?? false;
  const canPressReady = !hasGameStarted && playersCount >= MIN_PLAYERS && !selfReady;
  const remainingPlayers = Math.max(0, MIN_PLAYERS - playersCount);
  const isRoomFull = playersCount >= MAX_PLAYERS;
  const waitingReadyCount = Math.max(0, playersCount - readyCount);
  const hints: string[] = [];
  if (!hasGameStarted) {
    if (playersCount < MIN_PLAYERS) {
      hints.push(`ゲーム開始にはあと${remainingPlayers}人必要です`);
    } else if (selfReady) {
      hints.push(`他のプレイヤーの準備を待っています（残り${waitingReadyCount}人）`);
    } else {
      hints.push(`準備完了するとゲームが開始されます（現在${readyCount}/${playersCount}人が準備完了）`);
    }
    if (isRoomFull) {
      hints.push(`ルームは満員です（最大${MAX_PLAYERS}人まで参加できます）`);
    }
  }
  const startButtonLabel = startLoading
    ? '送信中…'
    : selfReady
    ? '準備完了'
    : 'ゲーム開始';

  return (
    <div className="room-page">
      <section className={`room-info ${isInfoCollapsed ? 'room-info-collapsed' : ''}`}>
        <button
          type="button"
          className="room-info-toggle"
          onClick={() => setIsInfoCollapsed((prev) => !prev)}
          aria-expanded={!isInfoCollapsed}
        >
          <span className="room-info-label">ルーム情報</span>
          <span className="room-info-code">#{roomCode}</span>
          <span className="room-info-icon" aria-hidden="true">
            {isInfoCollapsed ? '＋' : '－'}
          </span>
        </button>
        <div className="room-info-body">
          <p>プレイヤー名: {session.name}</p>
          <div className="room-info-actions">
            <button type="button" onClick={handleStartGame} disabled={!canPressReady || startLoading}>
              {startButtonLabel}
            </button>
            <button type="button" onClick={handleLeaveRoom} disabled={leaveLoading}>
              {leaveLoading ? '退室中…' : 'ルームを退出'}
            </button>
          </div>
          {!hasGameStarted
            ? hints.map((hint, index) => (
                <small key={`${hint}-${index}`} className="room-info-hint">
                  {hint}
                </small>
              ))
            : null}
        </div>
      </section>
      <GameBoard
        state={state}
        selfPlayerId={session.userId}
        hand={hand}
        selected={selected}
        onToggle={toggleCard}
        onPlay={handlePlay}
        onPass={handlePass}
        loading={loading}
        connectionStatus={connectionStatus}
      />
      {activeEffect ? (
        <EffectModal
          effect={activeEffect}
          hand={hand}
          selected={effectSelection}
          limit={effectLimit}
          onToggleCard={handleEffectCardToggle}
          onConfirm={() => handleEffectSubmit()}
          onSkip={
            activeEffect.payload?.optional
              ? () => handleEffectSubmit({ skip: true })
              : undefined
          }
          loading={effectLoading}
          rank={effectRank}
          onRankChange={setEffectRank}
        />
      ) : null}
      <Toast messages={messages} />
    </div>
  );
};

export default RoomPage;
