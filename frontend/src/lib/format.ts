export function formatPrice(price?: number): string {
  if (price === undefined) return '-';
  return `${price.toLocaleString('ko-KR')}원`;
}

export function formatCalories(calories?: number): string {
  if (calories === undefined) return '-';
  return `${calories.toLocaleString('ko-KR')} kcal`;
}

export function formatProtein(protein?: number): string {
  if (protein === undefined) return '-';
  return `${protein}g`;
}

/** 1,000원당 단백질(g) 계산 */
export function calcProteinPerPrice(protein?: number, price?: number): number | null {
  if (!protein || !price || protein <= 0 || price <= 0) return null;
  return (protein / price) * 1000;
}

/** 1,000원당 단백질(g) 포맷 (예: 1,000원당 4.9g) */
export function formatProteinPerThousand(protein?: number, price?: number): string | null {
  const eff = calcProteinPerPrice(protein, price);
  if (eff === null) return null;
  return `1,000원당 ${eff.toFixed(1)}g`;
}

/** 단백질 가성비 상세 포맷 (예: 1,000원당 4.9g · 1g당 204원) */
export function formatProteinEfficiency(protein?: number, price?: number): string {
  const eff = calcProteinPerPrice(protein, price);
  if (eff === null) return '-';
  const pricePerGram = Math.round(price! / protein!);
  return `1,000원당 ${eff.toFixed(1)}g (1g당 ${pricePerGram.toLocaleString('ko-KR')}원)`;
}
