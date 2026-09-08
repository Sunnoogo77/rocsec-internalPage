import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Layers, Plus, Search } from "lucide-react";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import {
  Button,
  Input,
  Segmented,
  StatusBadge,
  Table,
  TableEmpty,
  TablePager,
  TableWrap,
  tableClasses,
} from "@/components/ui";
import { sermonsApi } from "@/api";
import type { StatutWorkflow } from "@/types";
import common from "../common.module.css";
import { SeriesPanel } from "./SeriesPage";

const STATUT_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "brouillon", label: "Brouillon" },
  { value: "en_revue", label: "En revue" },
  { value: "publie", label: "Publié" },
  { value: "rejete", label: "À reprendre" },
  { value: "archive", label: "Archivés" },
] as const;

type StatutFilter = (typeof STATUT_OPTIONS)[number]["value"];

export function SermonsListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<StatutFilter>(
    () => STATUT_OPTIONS.find((s) => s.value === params.get("statut"))?.value || "all",
  );
  const [page, setPage] = useState(1);
  const [seriesOpen, setSeriesOpen] = useState(false);

  const sermonsQuery = useQuery({
    queryKey: ["sermons-list", search, statut, page],
    queryFn: () =>
      sermonsApi.listAdmin({
        q: search || undefined,
        statut: statut === "all" ? undefined : statut,
        page,
        page_size: 25,
        ordering: "-date_culte",
      }),
  });

  const data = sermonsQuery.data;
  const results = data?.results ?? [];

  return (
    <>
      <Breadcrumb items={[{ label: "Cultes" }]} />
      <PageHead
        title="Cultes"
        lede="Retrouvez les cultes, filtrez leur état et ouvrez une fiche pour préparer ou valider son contenu."
        actions={
          <>
            <Button
              variant="ghost"
              leftIcon={<Layers size={14} />}
              onClick={() => setSeriesOpen(true)}
              title="Créer, renommer ou supprimer des séries de prédications"
            >
              Gérer les séries
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus size={14} />}
              onClick={() => navigate("/sermons/nouveau")}
            >
              Nouveau sermon
            </Button>
          </>
        }
      />

      {seriesOpen && <SeriesPanel onClose={() => setSeriesOpen(false)} />}
      <PageBody>
        <div className={common.filters}>
          <div className={common.search}>
            <Input
              aria-label="Rechercher dans la liste"
              placeholder="Recherche par titre, slug…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Segmented
            ariaLabel="Statut"
            items={STATUT_OPTIONS as unknown as { value: StatutFilter; label: string }[]}
            value={statut}
            onChange={(next) => {
              setStatut(next as StatutFilter);
              setPage(1);
            }}
          />
          <div className={common.spacer} />
          <span style={{ fontSize: 12, color: "var(--gray-500)" }}>
            <Search size={12} aria-hidden />
            {data ? ` ${data.count} résultat${data.count > 1 ? "s" : ""}` : ""}
          </span>
        </div>

        <QueryFeedback
          loading={sermonsQuery.isLoading}
          error={sermonsQuery.error}
          retry={() => void sermonsQuery.refetch()}
        />
        {sermonsQuery.isSuccess && (
          <TableWrap>
            {results.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <th>Date du culte</th>
                    <th>Titre</th>
                    <th>Série</th>
                    <th>Prédicateur</th>
                    <th>Type</th>
                    <th>Statut</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((sermon) => {
                    const traduction = sermon.traductions?.find((t) => t.langue === "fr");
                    // Le backend expose les FK en UUID brut (`predicateur`, `serie`)
                    // et des copies nested en `predicateur_detail` / `serie_detail`
                    // pour l'affichage. On lit d'abord les versions detail.
                    const predicateur =
                      sermon.predicateur_detail ??
                      (typeof sermon.predicateur === "object" ? sermon.predicateur : null);
                    const serie =
                      sermon.serie_detail ??
                      (typeof sermon.serie === "object" ? sermon.serie : null);
                    return (
                      <tr key={sermon.id}>
                        <td className={tableClasses.date}>
                          {dayjs(sermon.date_culte).format("DD MMM YYYY")}
                        </td>
                        <td className={tableClasses.title}>
                          <Link to={`/sermons/${sermon.slug}`}>
                            {traduction?.titre ?? sermon.slug}
                          </Link>
                        </td>
                        <td>{serie?.titre_fr ?? "—"}</td>
                        <td>{predicateur?.libelle ?? "—"}</td>
                        <td>{sermon.type_culte_detail?.libelle_fr ?? "—"}</td>
                        <td>
                          <StatusBadge statut={sermon.statut as StatutWorkflow} />
                        </td>
                        <td>
                          <Link
                            to={`/sermons/${sermon.slug}`}
                            aria-label={`Ouvrir ${traduction?.titre || sermon.slug}`}
                          >
                            Ouvrir
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <TableEmpty
                message={
                  sermonsQuery.isLoading
                    ? "Chargement…"
                    : "Aucun sermon. Cliquez sur « Nouveau sermon » pour en créer un."
                }
              />
            )}
            {data && data.count > 25 ? (
              <TablePager>
                <span>
                  Page {page} sur {Math.ceil(data.count / 25)}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!data.previous}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!data.next}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </TablePager>
            ) : null}
          </TableWrap>
        )}
      </PageBody>
    </>
  );
}
