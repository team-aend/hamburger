import { SORT_OPTIONS, type SortType } from '@/types/product';
import styles from './ProductSort.module.css';

interface ProductSortProps {
  value: SortType;
  onChange: (value: SortType) => void;
}

export default function ProductSort({ value, onChange }: ProductSortProps) {
  return (
    <select
      className={styles.select}
      aria-label="정렬 기준"
      value={value}
      onChange={(event) => onChange(event.target.value as SortType)}
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
