import { Button } from "@/components/ui";
import styles from "@/routes/common.module.css";
export function SaveFooter({
  onSave,
  pending,
  disabled,
}: {
  onSave: () => void;
  pending: boolean;
  disabled?: boolean;
}) {
  if (disabled && !pending) return null;
  return (
    <div className={styles.saveFooter}>
      <Button variant="primary" disabled={pending || disabled} onClick={onSave}>
        {pending ? "Enregistrement…" : "Enregistrer les modifications"}
      </Button>
    </div>
  );
}
