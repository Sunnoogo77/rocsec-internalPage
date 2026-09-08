import type { ReactNode } from "react";
import styles from "./Badge.module.css";
import type { StatutTemoignage, StatutTemporel, StatutWorkflow, Lang } from "@/types";

interface BadgeProps {
  variant?:
    | "brouillon"
    | "en_revue"
    | "publie"
    | "rejete"
    | "archive"
    | "recu"
    | "avenir"
    | "aujourdhui"
    | "passee"
    | "soft"
    | "vedette"
    | "phare";
  withDot?: boolean;
  children: ReactNode;
}

export function Badge({ variant = "soft", withDot = true, children }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[variant]].join(" ")}>
      {withDot ? <span className={styles.dot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

const STATUT_WORKFLOW_LABELS: Record<StatutWorkflow, string> = {
  brouillon: "Brouillon",
  en_revue: "En relecture",
  publie: "Publié",
  rejete: "Rejeté",
  archive: "Archivé",
};

const STATUT_TEMOIGNAGE_LABELS: Record<StatutTemoignage, string> = {
  recu: "Reçu",
  en_revue: "En relecture",
  publie: "Publié",
  rejete: "Rejeté",
};

const STATUT_TEMPOREL_LABELS: Record<StatutTemporel, string> = {
  "a-venir": "À venir",
  "aujourd-hui": "Aujourd'hui",
  passee: "Passée",
};

interface StatusBadgeProps {
  statut: StatutWorkflow | StatutTemoignage;
}

export function StatusBadge({ statut }: StatusBadgeProps) {
  if (statut === "recu") {
    return <Badge variant="recu">{STATUT_TEMOIGNAGE_LABELS.recu}</Badge>;
  }
  return (
    <Badge variant={statut as StatutWorkflow}>
      {STATUT_WORKFLOW_LABELS[statut as StatutWorkflow] ?? statut}
    </Badge>
  );
}

interface TemporalBadgeProps {
  statut: StatutTemporel;
}

export function TemporalBadge({ statut }: TemporalBadgeProps) {
  const variantMap: Record<StatutTemporel, "avenir" | "aujourdhui" | "passee"> = {
    "a-venir": "avenir",
    "aujourd-hui": "aujourdhui",
    passee: "passee",
  };
  return <Badge variant={variantMap[statut]}>{STATUT_TEMPOREL_LABELS[statut]}</Badge>;
}

interface LangBadgeProps {
  langues: Lang[];
}

export function LangBadge({ langues }: LangBadgeProps) {
  if (langues.length === 0) return null;
  if (langues.length === 2) {
    return <span className={[styles.lang, styles.langBoth].join(" ")}>FR/EN</span>;
  }
  if (langues.includes("fr")) {
    return <span className={[styles.lang, styles.langFr].join(" ")}>FR</span>;
  }
  return <span className={[styles.lang, styles.langEn].join(" ")}>EN</span>;
}
