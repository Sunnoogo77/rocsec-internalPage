import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import styles from "./Kebab.module.css";

export interface KebabAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface KebabMenuProps {
  actions: (KebabAction | "divider")[];
  ariaLabel?: string;
}

export function KebabMenu({ actions, ariaLabel = "Plus d'actions" }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={16} />
      </button>
      {open ? (
        <div role="menu" className={styles.menu}>
          {actions.map((action, idx) => {
            if (action === "divider") {
              return <div key={`divider-${idx}`} className={styles.divider} />;
            }
            return (
              <button
                key={`${action.label}-${idx}`}
                type="button"
                role="menuitem"
                className={[styles.item, action.danger ? styles.danger : ""].join(" ")}
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
