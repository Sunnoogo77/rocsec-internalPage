import { useQuery, useQueries } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, MessageSquare, Plus } from "lucide-react";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Select, Input, StatusBadge, TablePager } from "@/components/ui";
import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { temoignagesApi } from "@/api";
import type { Temoignage } from "@/types";
import common from "../common.module.css";
import styles from "./TemoignagesQueue.module.css";

const statuses = [
  {
    code: "recu",
    label: "Reçus",
    help: "Commencez par les messages les plus anciens. Ouvrez une fiche pour lire le texte reçu et préparer sa relecture.",
  },
  {
    code: "en_revue",
    label: "En relecture",
    help: "Les textes préparés attendent la décision d’un validateur distinct de leur auteur.",
  },
  { code: "publie", label: "Publiés", help: "Ces témoignages sont visibles sur la vitrine." },
  {
    code: "rejete",
    label: "Non retenus",
    help: "Retrouvez les témoignages non retenus et les motifs de la décision dans leur fiche.",
  },
];
function author(t: Temoignage) {
  return (
    t.traductions.find((tr) => tr.langue === "fr")?.auteur ||
    [t.prenom_contact, t.nom_contact].filter(Boolean).join(" ") ||
    "Auteur non renseigné"
  );
}
function excerpt(t: Temoignage) {
  const fr = t.traductions.find((tr) => tr.langue === "fr");
  return (
    t.texte_soumis ||
    fr?.quote_text ||
    fr?.corps ||
    fr?.titre ||
    "Ouvrir la fiche pour consulter le témoignage."
  );
}
export function TemoignagesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = statuses.find((s) => s.code === params.get("statut")) || statuses[0];
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("q") || "";
  const ordering = params.get("ordre") === "recent" ? "-date_recue" : "date_recue";
  const update = (patch: Record<string, string>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("page");
      Object.entries(patch).forEach(([key, value]) =>
        value ? next.set(key, value) : next.delete(key),
      );
      return next;
    });
  const query = useQuery({
    queryKey: ["temoignages", "inbox", status.code, page, search, ordering],
    queryFn: () =>
      temoignagesApi.list({ statut: status.code, page, page_size: 25, q: search, ordering }),
  });
  const counts = useQueries({
    queries: statuses.map((s) => ({
      queryKey: ["temoignages", "count", s.code],
      queryFn: () => temoignagesApi.list({ statut: s.code, page_size: 1 }),
    })),
  });
  const pages = Math.max(1, Math.ceil((query.data?.count ?? 0) / 25));
  return (
    <>
      <Breadcrumb items={[{ label: "Témoignages" }]} />
      <PageHead
        title="Témoignages"
        lede="Du message reçu au texte publié : une fiche pour chaque témoignage."
        actions={
          <Button onClick={() => navigate("/temoignages/nouveau")} leftIcon={<Plus size={16} />}>
            Saisir un témoignage
          </Button>
        }
      />
      <PageBody>
        <nav className={styles.statuses} aria-label="État des témoignages">
          {statuses.map((s, i) => (
            <button
              type="button"
              key={s.code}
              aria-current={s.code === status.code ? "page" : undefined}
              onClick={() => update({ statut: s.code })}
            >
              {s.label}
              <span>{counts[i].isSuccess ? counts[i].data.count : "—"}</span>
            </button>
          ))}
        </nav>
        <p className={styles.guidance}>{status.help}</p>
        <div className={common.filters}>
          <div className={common.search}>
            <Input
              label="Rechercher dans les fiches"
              placeholder="Titre ou nom affiché"
              value={search}
              onChange={(e) => update({ q: e.target.value })}
              help="La recherche porte sur les informations éditoriales enregistrées."
            />
          </div>
          <Select
            label="Ordre de réception"
            value={ordering}
            onChange={(e) =>
              update({ ordre: e.target.value.startsWith("-") ? "recent" : "ancien" })
            }
          >
            <option value="date_recue">Les plus anciens d’abord</option>
            <option value="-date_recue">Les plus récents d’abord</option>
          </Select>
        </div>
        <QueryFeedback
          loading={query.isLoading}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.isSuccess && (
          <div className={styles.inbox}>
            {query.data.results.length ? (
              query.data.results.map((t) => (
                <article key={t.id} className={styles.item}>
                  <div className={styles.itemTop}>
                    <h2>
                      <Link to={`/temoignages/${t.slug}`}>{author(t)}</Link>
                    </h2>
                    <StatusBadge statut={t.statut} />
                  </div>
                  <p className={styles.meta}>
                    Reçu le {dayjs(t.date_recue).format("D MMM YYYY")} ·{" "}
                    {t.source === "soumission_publique"
                      ? "Formulaire du site"
                      : "Saisie par l’équipe"}
                  </p>
                  <p className={styles.excerpt}>{excerpt(t)}</p>
                  <Link className={styles.open} to={`/temoignages/${t.slug}`}>
                    {status.code === "recu" || status.code === "en_revue"
                      ? "Examiner le témoignage"
                      : "Consulter la fiche"}
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </article>
              ))
            ) : (
              <div className={styles.empty}>
                <MessageSquare size={28} aria-hidden />
                <h2>
                  {search
                    ? "Aucun résultat"
                    : `Aucun témoignage ${status.code === "recu" ? "reçu" : status.code === "en_revue" ? "en relecture" : status.code === "publie" ? "publié" : "non retenu"}`}
                </h2>
                <p>
                  {search
                    ? "Essayez un autre titre ou nom affiché."
                    : "Les témoignages correspondant à cet état apparaîtront ici."}
                </p>
                {search && (
                  <Button variant="ghost" onClick={() => update({ q: "" })}>
                    Effacer la recherche
                  </Button>
                )}
              </div>
            )}
            <TablePager>
              <span>
                {query.data.count} résultat{query.data.count > 1 ? "s" : ""} · Page {page} sur{" "}
                {pages}
              </span>
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) })}
              >
                Précédente
              </Button>
              <Button
                variant="ghost"
                disabled={page >= pages}
                onClick={() => update({ page: String(page + 1) })}
              >
                Suivante
              </Button>
            </TablePager>
          </div>
        )}
      </PageBody>
    </>
  );
}
