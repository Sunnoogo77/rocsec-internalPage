import type { RequestOptions } from "@/api/client";

export interface PublicationState {
  statut: string;
  statut_public?: string | null;
  revision_version?: number;
  revision?: {
    id: string;
    version: number;
    statut: string;
    can_discard?: boolean;
    conflict?: boolean;
  } | null;
}

export const hasLivePublication = (item?: PublicationState | null) =>
  item?.statut === "publie" || item?.statut_public === "publie";

export const revisionOptions = (item?: PublicationState | null): RequestOptions => ({
  headers: { "X-Revision-Version": String(item?.revision_version ?? item?.revision?.version ?? 0) },
});

export function publicationNotice(
  item: PublicationState | null | undefined,
  dirty: boolean,
  saved: boolean,
) {
  if (item?.revision?.conflict)
    return "La version en ligne a changé depuis cette correction. Conservez le texte à reprendre, puis abandonnez la correction pour repartir de la publication actuelle.";
  if (hasLivePublication(item)) {
    if (dirty)
      return "Correction en cours. Enregistrez-la, puis publiez-la ou soumettez-la à validation. La version actuellement publiée reste visible.";
    if (item?.revision)
      return item.statut === "en_revue"
        ? "Correction soumise à validation. La version actuellement publiée reste visible jusqu’à son approbation."
        : "Correction enregistrée. Publiez-la ou soumettez-la à validation pour remplacer la version visible sur le site.";
    return "Vous pouvez corriger cette publication. Les changements remplaceront la version visible après validation.";
  }
  if (dirty)
    return "Modifications non enregistrées. Enregistrez avant de publier ou de soumettre à validation.";
  return saved
    ? "Modifications enregistrées."
    : "Préparez le contenu et enregistrez-le avant de le publier ou de le soumettre à validation.";
}
