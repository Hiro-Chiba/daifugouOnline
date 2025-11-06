export const SESSION_STORAGE_KEY = 'daifugo-session';

export interface StoredSession {
  roomCode: string;
  userId: string;
  name: string;
}

export const loadSession = (): StoredSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredSession;
  } catch (error) {
    return null;
  }
};

export const saveSession = (session: StoredSession) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};
