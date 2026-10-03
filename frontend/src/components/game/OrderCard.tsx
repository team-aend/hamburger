import type { CSSProperties } from 'react';
import { CUSTOMER_COLORS, DIFFICULTY_LABEL, INGREDIENTS } from '@/data/burgerGame';
import type { BurgerRecipe } from '@/types/burgerGame';
import BurgerStack from './BurgerStack';
import styles from './OrderCard.module.css';

interface OrderCardProps {
  order: BurgerRecipe;
  orderNumber: number;
}

/** 손님이 말풍선으로 주문하는 카드. 부모가 key 를 주문 번호로 주면 주문마다 손님이 새로 들어온다. */
export default function OrderCard({ order, orderNumber }: OrderCardProps) {
  const customerColor = CUSTOMER_COLORS[(orderNumber - 1) % CUSTOMER_COLORS.length];

  return (
    <section className={styles.card} aria-labelledby="order-title">
      <div className={styles.bubble}>
        <header className={styles.heading}>
          <span className={styles.eyebrow}>ORDER #{orderNumber}</span>
          <span className={`${styles.difficulty} ${styles[order.difficulty]}`}>
            {DIFFICULTY_LABEL[order.difficulty]}
          </span>
        </header>
        <h2 id="order-title" className={styles.title}>
          {order.name} <span className={styles.please}>주세요!</span>
        </h2>

        <div className={styles.body}>
          <BurgerStack ingredients={order.ingredients} size="small" label="주문 햄버거 미리보기" />
          {/* 1번이 가장 아래 재료. 화면에서도 아래에서 위로 읽히도록 뒤집어 배치한다. */}
          <ol className={styles.steps} aria-label="쌓는 순서 (아래부터)">
            {order.ingredients.map((type, index) => (
              <li key={index}>
                <b>{index + 1}</b>
                <span>{INGREDIENTS[type].name}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <span
        className={styles.customer}
        style={{ '--customer': customerColor } as CSSProperties}
        aria-hidden="true"
      />
    </section>
  );
}
