import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.logo}>
          <span aria-hidden>🍔</span> Hamburger
        </span>
      </div>
    </header>
  );
}
