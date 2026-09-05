import { useState } from "react";
import type { ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function Tabs({ items, defaultValue, value, onChange }: TabsProps) {
  const [internal, setInternal] = useState(value ?? defaultValue ?? items[0]?.value);
  const current = value ?? internal;

  const setActive = (next: string) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  const active = items.find((it) => it.value === current) ?? items[0];

  return (
    <div>
      <div role="tablist" className={styles.tabs}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={item.value === current}
            className={[styles.tab, item.value === current ? styles.active : ""].join(" ")}
            onClick={() => setActive(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.panel} role="tabpanel">
        {active?.content}
      </div>
    </div>
  );
}
