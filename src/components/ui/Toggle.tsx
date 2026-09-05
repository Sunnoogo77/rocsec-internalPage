import type { ReactNode } from "react";
import styles from "./Toggle.module.css";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, ariaLabel, disabled }: ToggleProps) {
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      className={[styles.toggle, checked ? styles.on : ""].filter(Boolean).join(" ")}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
    />
  );

  if (!label) return button;

  return (
    <label className={styles.row}>
      {button}
      <span className={styles.label}>{label}</span>
    </label>
  );
}
