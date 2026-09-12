import { useId, useRef } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import dayjs from "@/lib/dayjs";
import { churchNow } from "@/lib/churchTime";
import styles from "./DateTimeField.module.css";

type DateProps = {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  required?: boolean;
  readOnly?: boolean;
  help?: string;
};

export function DateField({ label, value, onChange, required, readOnly, help }: DateProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <div className={styles.inputWrap}>
        <CalendarDays size={18} aria-hidden="true" />
        <input
          id={id}
          ref={input}
          type="date"
          value={value}
          required={required}
          readOnly={readOnly}
          onChange={(event) => onChange?.(event.target.value)}
          aria-describedby={help ? `${id}-help` : undefined}
        />
        {!readOnly && (
          <button
            type="button"
            aria-label={`Ouvrir le calendrier — ${label}`}
            onClick={() => {
              try {
                input.current?.showPicker();
              } catch {
                input.current?.focus();
              }
            }}
          >
            Calendrier
          </button>
        )}
      </div>
      {help && (
        <p id={`${id}-help`} className={styles.help}>
          {help}
        </p>
      )}
    </div>
  );
}

export function DateTimeField({
  label,
  value,
  onChange,
  required,
  shortcuts = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  shortcuts?: boolean;
}) {
  const id = useId();
  const [date = "", time = ""] = value.split("T");
  const changeDate = (next: string) => onChange(next ? `${next}T${time || "09:00"}` : "");
  const weekday = (day: number) =>
    churchNow()
      .startOf("week")
      .add(day - 1, "day")
      .format("YYYY-MM-DD");
  return (
    <div className={styles.dateTime}>
      <div className={styles.row}>
        <DateField label={label} value={date} onChange={changeDate} required={required} />
        <div className={styles.field}>
          <label htmlFor={id}>Heure{required && <span aria-hidden="true"> *</span>}</label>
          <div className={styles.inputWrap}>
            <Clock3 size={18} aria-hidden="true" />
            <input
              id={id}
              type="time"
              value={time}
              required={required}
              step={60}
              onChange={(event) =>
                onChange(`${date || churchNow().format("YYYY-MM-DD")}T${event.target.value}`)
              }
            />
          </div>
        </div>
      </div>
      {shortcuts && (
        <div className={styles.shortcuts} aria-label="Dates habituelles des cultes">
          <button type="button" onClick={() => changeDate(weekday(3))}>
            Ce mercredi
          </button>
          <button type="button" onClick={() => changeDate(weekday(7))}>
            Ce dimanche
          </button>
          <button type="button" onClick={() => changeDate(churchNow().format("YYYY-MM-DD"))}>
            Aujourd’hui
          </button>
        </div>
      )}
      <p className={styles.help}>
        {date && dayjs(date).isValid()
          ? `${dayjs(date).format("dddd D MMMM YYYY")}${time ? ` à ${time.replace(":", " h ")}` : ""} · `
          : ""}
        Heure de Paris
      </p>
    </div>
  );
}
