import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { CalendarHeart, Plus } from "lucide-react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import {
  Button,
  Input,
  Segmented,
  StatusBadge,
  Table,
  TableEmpty,
  TableWrap,
  tableClasses,
} from "@/components/ui";
import { cantiquesApi, famillesCantiqueApi } from "@/api";
import type { StatutWorkflow } from "@/types";
import common from "../common.module.css";
import { EvenementsPanel } from "./EvenementsPanel";

export function CantiquesListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  /** Code de la famille filtrée, ou "all". */
  const [famille, setFamille] = useState<string>("all");
  const [evenementsOpen, setEvenementsOpen] = useState(false);

  const famillesQuery = useQuery({
    queryKey: ["familles-cantique"],
    queryFn: () => famillesCantiqueApi.list(),
    staleTime: 5 * 60_000,
  });

  const familleOptions = useMemo(
    () => [
      { value: "all", label: "Tous" },
      ...(famillesQuery.data ?? []).map((f) => ({ value: f.code, label: f.libelle_fr })),
    ],
    [famillesQuery.data],
  );

  const query = useQuery({
    queryKey: ["cantiques-list", search, famille],
    queryFn: () =>
      cantiquesApi.list({
        q: search || undefined,
        famille__code: famille === "all" ? undefined : famille,
        page_size: 50,
      }),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <Breadcrumb items={[{ label: "Cantiques" }]} />
      <PageHead
        title="Cantiques"
        lede="Liste de tous les cantiques. Filtrez par famille."
        actions={
          <>
            <Button
              variant="ghost"
              leftIcon={<CalendarHeart size={14} />}
              onClick={() => setEvenementsOpen(true)}
              title="Créer, renommer ou supprimer des événements liturgiques (Veillée, Pâques…)"
            >
              Gérer les événements
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus size={14} />}
              onClick={() => navigate("/cantiques/nouveau")}
            >
              Nouveau cantique
            </Button>
          </>
        }
      />

      {evenementsOpen && <EvenementsPanel onClose={() => setEvenementsOpen(false)} />}
      <PageBody>
        <div className={common.filters}>
          <div className={common.search}>
            <Input
              placeholder="Recherche par titre, numéro…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Segmented
            ariaLabel="Famille"
            items={familleOptions}
            value={famille}
            onChange={(next) => setFamille(next)}
          />
        </div>

        <TableWrap>
          {query.data?.results.length ? (
            <Table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Titre</th>
                  <th>Famille</th>
                  <th>Interprète(s)</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((cantique) => {
                  const fr = (cantique.traductions ?? []).find((t) => t.langue === "fr");
                  return (
                    <tr key={cantique.id}>
                      <td className={tableClasses.date}>{cantique.numero}</td>
                      <td className={tableClasses.title}>
                        <Link to={`/cantiques/${cantique.slug}`}>
                          {fr?.titre ?? cantique.slug}
                        </Link>
                      </td>
                      <td>{cantique.famille_detail?.libelle_fr ?? "—"}</td>
                      <td>{cantique.interpretes_resolu || cantique.interpretes_libelle || "—"}</td>
                      <td>
                        <StatusBadge statut={cantique.statut as StatutWorkflow} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <TableEmpty
              message={
                query.isLoading
                  ? "Chargement…"
                  : "Aucun cantique. Cliquez sur « Nouveau cantique »."
              }
            />
          )}
        </TableWrap>
      </PageBody>
    </>
  );
}
