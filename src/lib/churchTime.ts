import dayjs from "@/lib/dayjs";
import { FormValidationError } from "./formValidation";

export const CHURCH_TIME_ZONE = "Europe/Paris";
export const churchNow = () => dayjs().tz(CHURCH_TIME_ZONE);
export const toChurchDateTime = (value: string) =>
  dayjs(value).tz(CHURCH_TIME_ZONE).format("YYYY-MM-DDTHH:mm");

export function churchDateTimeToISO(value: string, field = "date_culte"): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    const parsed = dayjs.tz(value, CHURCH_TIME_ZONE);
    if (parsed.isValid() && parsed.format("YYYY-MM-DDTHH:mm") === value)
      return parsed.toISOString();
  }
  throw new FormValidationError({
    [field]: "Choisissez une date et une heure valides (heure de Paris).",
  });
}

export function serviceDefaultTime(code: string): string | null {
  if (code === "culte-mercredi") return "19:00";
  if (code === "culte-dimanche") return "09:00";
  return null;
}
