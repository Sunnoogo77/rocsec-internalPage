import { Trash2 } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import type { VerseBlock } from "@/types";
import styles from "./LyricsEditor.module.css";

interface LyricsEditorProps {
  blocks: VerseBlock[];
  onChange: (next: VerseBlock[]) => void;
}

export function LyricsEditor({ blocks, onChange }: LyricsEditorProps) {
  const replace = (idx: number, patch: Partial<VerseBlock>) =>
    onChange(blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

  const remove = (idx: number) => onChange(blocks.filter((_, i) => i !== idx));

  const add = (type: VerseBlock["type"]) => {
    const nextNum =
      blocks.filter((b) => b.type === "verse").length + (type === "verse" ? 1 : 0);
    const label = type === "verse" ? `${nextNum}` : type === "refrain" ? "℟" : "Pont";
    onChange([...blocks, { type, label, lines: [""] }]);
  };

  return (
    <div className={styles.editor}>
      {blocks.map((block, idx) => (
        <div key={idx} className={styles.block}>
          <div className={styles.head}>
            <span className={styles.kind}>{block.type}</span>
            <Input
              label="Label"
              className={styles.label}
              value={block.label}
              onChange={(event) => replace(idx, { label: event.target.value })}
            />
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Trash2 size={14} />}
              onClick={() => remove(idx)}
              aria-label="Supprimer le bloc"
            >
              Supprimer
            </Button>
          </div>
          <Textarea
            label="Lignes (une par retour à la ligne)"
            rows={Math.max(3, block.lines.length + 1)}
            value={block.lines.join("\n")}
            onChange={(event) => replace(idx, { lines: event.target.value.split("\n") })}
          />
        </div>
      ))}
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" onClick={() => add("verse")}>
          + Couplet
        </Button>
        <Button size="sm" variant="secondary" onClick={() => add("refrain")}>
          + Refrain
        </Button>
        <Button size="sm" variant="secondary" onClick={() => add("pont")}>
          + Pont
        </Button>
      </div>
    </div>
  );
}
