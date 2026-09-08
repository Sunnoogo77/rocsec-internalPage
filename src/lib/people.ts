import { useQuery } from "@tanstack/react-query";
import { personnesApi } from "@/api";
import type { Personne } from "@/types";

export const personName = (p: Personne) =>
  p.libelle || p.nom_affichage || `${p.prenom} ${p.nom}`.trim();
export const normalizeSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
export function roleCodes(p: Personne): string[] {
  return p.roles_detail !== undefined
    ? p.roles_detail.filter((r) => r.actif).map((r) => r.code)
    : p.role_principal && p.role_principal !== "autre"
      ? [p.role_principal]
      : [];
}
export const roleLabel = (p: Personne) =>
  p.roles_detail
    ?.filter((r) => r.actif)
    .map((r) => r.libelle_fr)
    .join(", ") ||
  roleCodes(p).join(", ") ||
  "Rôle à renseigner";
export const isPreacher = (p: Personne) =>
  p.actif && roleCodes(p).some((r) => ["pasteur", "predicateur"].includes(r));
export async function loadPeople(): Promise<Personne[]> {
  const people = new Map<string, Personne>();
  let page = 1;
  for (;;) {
    const result = await personnesApi.list({ page, page_size: 100, ordering: "nom,prenom" });
    const before = people.size;
    result.results.forEach((p) => people.set(p.id, p));
    if (!result.next) break;
    if (people.size === before) throw new Error("La pagination du répertoire est interrompue.");
    page += 1;
  }
  return [...people.values()].sort((a, b) =>
    `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr", {
      sensitivity: "base",
      numeric: true,
    }),
  );
}
export function usePeople() {
  return useQuery({ queryKey: ["personnes-directory"], queryFn: loadPeople });
}
