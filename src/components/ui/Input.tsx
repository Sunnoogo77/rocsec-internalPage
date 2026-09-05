import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";
import styles from "./Input.module.css";

interface FieldShellProps {
  id: string;
  label?: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
}

function FieldShell({ id, label, required, help, error, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      {label ? (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required ? (
            <span className={styles.req} aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {help && !error ? <span className={styles.help}>{help}</span> : null}
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  help?: ReactNode;
  error?: string | null;
}

export function Input({ id, label, required, help, error, className, ...rest }: InputProps) {
  const reactId = useId();
  const inputId = id ?? `i-${reactId}`;
  return (
    <FieldShell id={inputId} label={label} required={required} help={help} error={error}>
      <input
        {...rest}
        id={inputId}
        required={required}
        className={[styles.input, error ? styles.invalid : "", className].filter(Boolean).join(" ")}
      />
    </FieldShell>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  help?: ReactNode;
  error?: string | null;
}

export function Textarea({ id, label, required, help, error, className, ...rest }: TextareaProps) {
  const reactId = useId();
  const inputId = id ?? `t-${reactId}`;
  return (
    <FieldShell id={inputId} label={label} required={required} help={help} error={error}>
      <textarea
        {...rest}
        id={inputId}
        required={required}
        className={[styles.textarea, error ? styles.invalid : "", className]
          .filter(Boolean)
          .join(" ")}
      />
    </FieldShell>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
}

export function Select({
  id,
  label,
  required,
  help,
  error,
  className,
  children,
  ...rest
}: SelectProps) {
  const reactId = useId();
  const inputId = id ?? `s-${reactId}`;
  return (
    <FieldShell id={inputId} label={label} required={required} help={help} error={error}>
      <select
        {...rest}
        id={inputId}
        required={required}
        className={[styles.select, error ? styles.invalid : "", className]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </select>
    </FieldShell>
  );
}
