'use client';

import { useMemo, useState } from 'react';

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
  const [expanded, setExpanded] = useState(true);

  const formId = useMemo(() => `${mode}-form`, [mode]);

  const toggleExpanded = () => {
    setExpanded((prev) => !prev);
  };

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
    <section className={`form-card join-card ${expanded ? 'expanded' : 'collapsed'}`}>
      <header className="join-card-header">
        <div>
          <h2>{labels[mode].title}</h2>
          <p>{labels[mode].description}</p>
        </div>
        <button
          type="button"
          className="toggle-button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls={formId}
        >
          {expanded ? 'たたむ' : '開く'}
        </button>
      </header>
      {expanded ? (
        <form id={formId} className="flex-column" onSubmit={handleSubmit}>
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
      ) : null}
    </section>
  );
};

export default JoinForm;
