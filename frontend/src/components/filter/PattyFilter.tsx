import { ALL_PATTY, type PattyFilterValue } from '@/hooks/useProductFilters';
import { PATTY_TYPE_LABEL, type PattyType } from '@/types/product';
import styles from './chips.module.css';

interface PattyFilterProps {
  value: PattyFilterValue;
  onChange: (value: PattyFilterValue) => void;
}

const PATTY_TYPES: PattyType[] = ['BEEF', 'CHICKEN', 'SHRIMP', 'OTHER'];

const OPTIONS: { value: PattyFilterValue; label: string }[] = [
  { value: ALL_PATTY, label: '전체' },
  ...PATTY_TYPES.map((type) => ({ value: type, label: PATTY_TYPE_LABEL[type] })),
];

export default function PattyFilter({ value, onChange }: PattyFilterProps) {
  return (
    <div className={`${styles.group} scroll-x`} role="group" aria-label="햄버거 종류 필터">
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
