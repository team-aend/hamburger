import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.icon} aria-hidden>
        🔎
      </span>
      <input
        type="search"
        className={styles.input}
        placeholder="햄버거 또는 브랜드 검색"
        aria-label="햄버거 또는 브랜드 검색"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value !== '' && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange('')}
          aria-label="검색어 지우기"
        >
          ×
        </button>
      )}
    </div>
  );
}
