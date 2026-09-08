import { useState } from "react";
import { useUnsavedChanges } from "./useUnsavedChanges";
export function useDraftGuard(value: unknown, ready: boolean) {
  const serialized = JSON.stringify(value);
  const [saved, setSaved] = useState<string | null>(null);
  if (ready && saved === null) setSaved(serialized);
  const dirty = ready && saved !== null && serialized !== saved;
  useUnsavedChanges(dirty);
  return { dirty, markSaved: () => setSaved(serialized) };
}
