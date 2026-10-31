'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

/** 검색·추천 화면의 조건 (backend savedSearches/domain/savedSearch.ts 의 SearchFilters 와 같은 모양) */
export interface SearchFilters {
  keyword: string;
  brands: string[];
  includeIngredients: string[];
  excludeIngredients: string[];
  minPrice: number | null;
  maxPrice: number | null;
  priceChannel: 'STORE' | 'DELIVERY';
  maxCalories: number | null;
  variantType: 'SINGLE' | 'SET';
  sortBy: string;
}

interface SavedSearch {
  savedSearchId: string;
  name: string;
  filters: SearchFilters;
}

const errorMessage = async (res: Response, fallback: string) =>
  ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? fallback;

/**
 * "내 조건": 지금 조건을 이름 붙여 저장하고(로그인 필수, 최대 10개) 한 번에 다시 적용한다.
 */
export default function SavedSearchesBar({
  current,
  onApply,
}: {
  current: SearchFilters;
  onApply: (filters: SearchFilters) => void;
}) {
  const { user, goToLogin } = useAuth();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!user) { setItems([]); return; }
    const res = await fetch('/api/saved-searches', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setItems((await res.json()).items);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters: current }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, '조건을 저장하지 못했어요.'));
      setNaming(false);
      setName('');
      setMessage({ type: 'ok', text: '지금 조건을 저장했어요.' });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '조건을 저장하지 못했어요.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: SavedSearch) => {
    const res = await fetch(`/api/saved-searches/${item.savedSearchId}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) setItems((prev) => prev.filter((s) => s.savedSearchId !== item.savedSearchId));
    else setMessage({ type: 'error', text: '조건을 삭제하지 못했어요.' });
  };

  return (
    <div className="rc-saved" role="group" aria-label="내 조건">
      <span className="rc-presets-label">내 조건</span>

      {items.map((item) => (
        <span key={item.savedSearchId} className="rc-saved-chip">
          <button type="button" onClick={() => onApply(item.filters)}>
            ★ {item.name}
          </button>
          <button type="button" className="rc-saved-remove" aria-label={`${item.name} 삭제`} onClick={() => void remove(item)}>
            ×
          </button>
        </span>
      ))}

      {naming ? (
        <form className="rc-saved-form" onSubmit={save}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="조건 이름 (예: 점심 치킨버거)"
            aria-label="조건 이름"
            autoFocus
          />
          <button type="submit" disabled={busy || name.trim() === ''}>
            {busy ? '저장 중...' : '저장'}
          </button>
          <button type="button" className="rc-text-button" onClick={() => { setNaming(false); setName(''); }}>
            취소
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="rc-chip rc-chip-sm"
          onClick={() => (user ? setNaming(true) : goToLogin())}
        >
          + 지금 조건 저장{!user && ' (로그인)'}
        </button>
      )}

      {items.length === 0 && user && !naming && (
        <span className="rc-saved-hint">자주 쓰는 조건을 저장해 두면 한 번에 불러올 수 있어요.</span>
      )}
      {message && (
        <span className={`rc-saved-message ${message.type}`} role="status">{message.text}</span>
      )}
    </div>
  );
}
