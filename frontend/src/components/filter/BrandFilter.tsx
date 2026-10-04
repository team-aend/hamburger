import { ALL_BRANDS, BRANDS } from '@/data/brands';
import type { BrandFilterValue } from '@/hooks/useProductFilters';
import type { Brand } from '@/types/product';
import styles from './chips.module.css';

interface BrandFilterProps {
  brands?: Brand[];
  value: BrandFilterValue;
  onChange: (value: BrandFilterValue) => void;
}

export default function BrandFilter({
  brands = BRANDS,
  value,
  onChange,
}: BrandFilterProps) {
  const options: { value: BrandFilterValue; label: string }[] = [
    { value: ALL_BRANDS, label: '전체' },
    ...brands.map((brand) => ({ value: brand.slug, label: brand.name })),
  ];

  return (
    <div className={`${styles.group} scroll-x`} role="group" aria-label="브랜드 필터">
      {options.map((option) => {
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
