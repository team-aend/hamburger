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
