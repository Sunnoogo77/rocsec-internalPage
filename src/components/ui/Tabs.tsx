import { useId, useState } from "react";
import type { ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  readOnly?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function Tabs({ items, defaultValue, value, onChange, readOnly }: TabsProps) {
  const id = useId();
  const [internal, setInternal] = useState(value ?? defaultValue ?? items[0]?.value);
  const current = value ?? internal;

  const setActive = (next: string) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  const active = items.find((it) => it.value === current) ?? items[0];

  if (readOnly)
    return (
      <div>
        {items.map((item) => (
          <section key={item.value} className={styles.panel}>
            <h3>{item.label}</h3>
            <div className={styles.panel}>{item.content}</div>
          </section>
        ))}
      </div>
    );

  return (
    <div>
      <div role="tablist" className={styles.tabs}>
        {items.map((item, index) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${id}-${item.value}`}
            aria-controls={`${id}-panel`}
            tabIndex={item.value === current ? 0 : -1}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
              setActive(items[next].value);
              document.getElementById(`${id}-${items[next].value}`)?.focus();
            }}
            aria-selected={item.value === current}
            className={[styles.tab, item.value === current ? styles.active : ""].join(" ")}
            onClick={() => setActive(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        aria-labelledby={`${id}-${active?.value}`}
        className={styles.panel}
        role="tabpanel"
      >
        {active?.content}
      </div>
    </div>
  );
}
