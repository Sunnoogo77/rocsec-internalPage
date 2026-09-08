import DOMPurify from "dompurify";
/**
 * Éditeur de texte riche minimal pour le « Mot du pasteur ».
 *
 * MVP basé sur `contentEditable` + `document.execCommand` (déprécié mais
 * encore parfaitement supporté dans les navigateurs en 2026 et zéro
 * dépendance ajoutée). À remplacer par TipTap quand la complexité le
 * justifiera (tables, mentions, embed YouTube, etc.).
 *
 * Boutons : Gras, Italique, Souligné, Liste à puces, Liste numérotée, Lien.
 */

import { useEffect, useRef, type CSSProperties } from "react";

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const toolbarStyle: CSSProperties = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
  background: "var(--gray-50, #f9fafb)",
  borderTop: "1px solid var(--gray-300, #d1d5db)",
  borderLeft: "1px solid var(--gray-300, #d1d5db)",
  borderRight: "1px solid var(--gray-300, #d1d5db)",
  borderTopLeftRadius: 6,
  borderTopRightRadius: 6,
  padding: 6,
};

const btnStyle: CSSProperties = {
  border: "1px solid var(--gray-300, #d1d5db)",
  background: "var(--surface)",
  borderRadius: 4,
  padding: "4px 10px",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

const editorStyle: CSSProperties = {
  border: "1px solid var(--gray-300, #d1d5db)",
  borderTop: "none",
  borderBottomLeftRadius: 6,
  borderBottomRightRadius: 6,
  background: "var(--surface)",
  padding: "12px 14px",
  minHeight: 220,
  fontSize: 15,
  lineHeight: 1.6,
  outline: "none",
};

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Hydratation initiale + re-hydratation si `value` change depuis l'extérieur.
  // Évite la boucle infinie : on ne réécrit le innerHTML que si la valeur
  // entrante diffère vraiment du contenu courant.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = DOMPurify.sanitize(value);
    }
  }, [value]);

  const exec = (command: string, arg?: string) => {
    // execCommand est déprécié mais reste fonctionnel ; pour un MVP c'est OK.
    document.execCommand(command, false, arg);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const handleLink = () => {
    const url = window.prompt("URL du lien (https://…) :");
    if (!url) return;
    exec("createLink", url);
  };

  return (
    <div>
      <div style={toolbarStyle} role="toolbar" aria-label="Mise en forme">
        <button
          type="button"
          style={btnStyle}
          title="Gras (Ctrl+B)"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("bold");
          }}
        >
          <strong>G</strong>
        </button>
        <button
          type="button"
          style={btnStyle}
          title="Italique (Ctrl+I)"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("italic");
          }}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          style={btnStyle}
          title="Souligné (Ctrl+U)"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("underline");
          }}
        >
          <span style={{ textDecoration: "underline" }}>S</span>
        </button>
        <span style={{ width: 1, background: "var(--gray-300, #d1d5db)", margin: "2px 4px" }} />
        <button
          type="button"
          style={btnStyle}
          title="Liste à puces"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("insertUnorderedList");
          }}
        >
          • Liste
        </button>
        <button
          type="button"
          style={btnStyle}
          title="Liste numérotée"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("insertOrderedList");
          }}
        >
          1. Liste
        </button>
        <span style={{ width: 1, background: "var(--gray-300, #d1d5db)", margin: "2px 4px" }} />
        <button
          type="button"
          style={btnStyle}
          title="Insérer un lien"
          onMouseDown={(e) => {
            e.preventDefault();
            handleLink();
          }}
        >
          🔗 Lien
        </button>
        <button
          type="button"
          style={btnStyle}
          title="Retirer le formatage"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("removeFormat");
          }}
        >
          ↺ Nettoyer
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? "Mot du pasteur"}
        style={editorStyle}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
      />
    </div>
  );
}
