'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ProductDetail, ProductVariantDetail } from '@/types/productDetail';
import styles from './BurgerSpecDialog.module.css';

const ingredientLabels: Record<string, string> = {
  PATTY: '패티', TOPPING: '토핑', CHEESE_SAUCE: '치즈·소스',
};

export default function BurgerSpecDialog({ productId, name, onClose }: {
  productId: string;
  name: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let disposed = false;
    setLoading(true);
    setError(null);
    setProduct(null);
    void (async () => {
      try {
        const response = await fetch(`/api/products/${productId}`, { cache: 'no-store', signal: controller.signal });
        if (response.status === 404) throw new Error('이 버거의 상세 정보를 찾을 수 없어요.');
        if (!response.ok) throw new Error('상세 정보를 불러오지 못했어요. 다시 시도해 주세요.');
        const { product: detail } = await response.json() as { product: ProductDetail };
        if (!detail || detail.productId !== productId || !Array.isArray(detail.variants) || !Array.isArray(detail.ingredients)) {
          throw new Error('상세 정보를 확인할 수 없어요. 다시 시도해 주세요.');
        }
        if (disposed) return;
        setProduct(detail);
        const initial = detail.variants.find((variant) => variant.variantType === 'SINGLE' && variant.isDefault)
          ?? detail.variants.find((variant) => variant.variantType === 'SINGLE')
          ?? detail.variants.find((variant) => variant.isDefault) ?? detail.variants[0];
        setVariantId(initial?.variantId ?? null);
      } catch (cause) {
        if (!disposed) setError(controller.signal.aborted ? '조회 시간이 초과됐어요. 다시 시도해 주세요.'
          : cause instanceof Error ? cause.message : '상세 정보를 불러오지 못했어요.');
      } finally {
        window.clearTimeout(timeout);
        if (!disposed) setLoading(false);
      }
    })();
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [productId, request]);

  const variant = product?.variants.find((item) => item.variantId === variantId);
  const ingredients = Object.entries((product?.ingredients ?? []).reduce<Record<string, string[]>>((groups, item) => {
    (groups[item.group] ??= []).push(item.name);
    return groups;
  }, {}));

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}>
      <header className={styles.header}>
        <div><p>버거 상세 스펙</p><h2 id={titleId}>{product?.name ?? name}</h2></div>
        <button type="button" autoFocus onClick={onClose} aria-label="상세보기 닫기">✕</button>
      </header>
      <div className={styles.content} aria-busy={loading}>
        {loading && <p role="status">상세 정보를 불러오고 있어요…</p>}
        {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => setRequest((value) => value + 1)}>다시 시도</button></div>}
        {product && <>
          <p className={styles.brand}>{product.brand.name}</p>
          {product.description && <p className={styles.description}>{product.description}</p>}
          {product.variants.length > 1 && <div className={styles.variants} role="group" aria-label="판매 형태">
            {product.variants.map((item) => <button key={item.variantId} type="button" aria-pressed={item.variantId === variantId} onClick={() => setVariantId(item.variantId)}>{item.name}</button>)}
          </div>}
          <section className={styles.section} aria-label="가격">
            <h3>가격{variant && <small>{variant.name} 기준</small>}</h3>
            {variant ? <dl className={styles.stats}><Spec label="매장가" value={variant.prices.store} unit="원" /><Spec label="배달가" value={variant.prices.delivery} unit="원" /></dl>
              : <p>가격 정보가 아직 등록되지 않았어요.</p>}
          </section>
          <section className={styles.section} aria-label="영양 정보">
            <h3>영양 정보{variant && <small>{variant.name} 기준</small>}</h3>
            {variant?.nutrition ? <Nutrition nutrition={variant.nutrition} /> : <p>영양 정보가 아직 등록되지 않았어요.</p>}
          </section>
          <section className={styles.section} aria-label="들어간 재료">
            <h3>들어간 재료</h3>
            {ingredients.length ? <dl className={styles.ingredients}>{ingredients.map(([group, names]) => <div key={group}><dt>{ingredientLabels[group] ?? group}</dt><dd>{names.join(', ')}</dd></div>)}</dl>
              : <p>재료 정보가 아직 등록되지 않았어요.</p>}
          </section>
        </>}
      </div>
    </dialog>
  );
}

function Spec({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return <div><dt>{label}</dt><dd>{value === null ? '정보 없음' : <>{value.toLocaleString('ko-KR')}<small>{unit}</small></>}</dd></div>;
}

function Nutrition({ nutrition }: { nutrition: NonNullable<ProductVariantDetail['nutrition']> }) {
  return <dl className={styles.stats}>
    <Spec label="열량" value={nutrition.caloriesKcal} unit="kcal" />
    <Spec label="단백질" value={nutrition.proteinG} unit="g" />
    <Spec label="당류" value={nutrition.sugarG} unit="g" />
    <Spec label="포화지방" value={nutrition.saturatedFatG} unit="g" />
    <Spec label="나트륨" value={nutrition.sodiumMg} unit="mg" />
    <Spec label="중량" value={nutrition.servingSizeG} unit="g" />
  </dl>;
}
