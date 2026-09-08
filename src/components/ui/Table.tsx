import type { ReactNode } from "react";
import styles from "./Table.module.css";

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className={styles.wrap}>{children}</div>;
}

export function TableToolbar({ children }: { children: ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>;
}

export function ToolbarSpacer() {
  return <div className={styles.spacer} />;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className={styles.scroll} role="region" aria-label="Tableau défilant" tabIndex={0}>
      <table className={styles.table}>{children}</table>
    </div>
  );
}

export function TableEmpty({ message }: { message: ReactNode }) {
  return <div className={styles.empty}>{message}</div>;
}

export function TablePager({ children }: { children: ReactNode }) {
  return <div className={styles.pager}>{children}</div>;
}

export const tableClasses = {
  title: styles.title,
  date: styles.date,
};
