'use client';

import { useState } from 'react';

interface JoinFormProps {
  mode: 'create' | 'join';
  onSubmit: (payload: { name: string; code?: string }) => Promise<void>;
}

const labels = {
  create: {
    title: 'ルームを作成',
    description: 'あなたがホストとなり、新しい対局ルームを作成します。',
    button: 'ルームを作る'
  },
  join: {
    title: 'ルームに参加',
    description: '既存のルームコードを入力して参加します。',
    button: 'ルームに入る'
  }
} as const;

const JoinForm = ({ mode, onSubmit }: JoinFormProps) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      alert('名前を入力してください');
      return;
    }
    if (mode === 'join' && !code.trim()) {
      alert('ルームコードを入力してください');
      return;
    }
    try {
      setLoading(true);
      await onSubmit({ name: name.trim(), code: code.trim() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-card flex-column" onSubmit={handleSubmit}>
      <div>
        <h2>{labels[mode].title}</h2>
        <p>{labels[mode].description}</p>
      </div>
      <div className="flex-column">
        <label>
          <span>表示名</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: たろう"
            maxLength={16}
          />
        </label>
        {mode === 'join' ? (
          <label>
            <span>ルームコード</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="000000"
              maxLength={6}
            />
          </label>
        ) : null}
      </div>
      <button type="submit" disabled={loading}>
        {loading ? '処理中…' : labels[mode].button}
      </button>
    </form>
  );
};

export default JoinForm;
