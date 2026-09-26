import { ALL_BRANDS, BRANDS } from '@/data/brands';
import type { BrandFilterValue } from '@/hooks/useProductFilters';
import styles from './chips.module.css';

interface BrandFilterProps {
  value: BrandFilterValue;
  onChange: (value: BrandFilterValue) => void;
}

const OPTIONS: { value: BrandFilterValue; label: string }[] = [
  { value: ALL_BRANDS, label: '전체' },
  ...BRANDS.map((brand) => ({ value: brand.slug, label: brand.name })),
];

export default function BrandFilter({ value, onChange }: BrandFilterProps) {
  return (
    <div className={`${styles.group} scroll-x`} role="group" aria-label="브랜드 필터">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
