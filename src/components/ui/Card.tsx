import type { ReactNode } from "react";
import styles from "./Card.module.css";

interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Card({ title, actions, children }: CardProps) {
  return (
    <section className={styles.card}>
      {(title || actions) && (
        <header className={styles.head}>
          {title ? <span className={styles.title}>{title}</span> : <span />}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
