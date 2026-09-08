import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
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
  TableWrap,
  TablePager,
  Select,
  TemporalBadge,
  tableClasses,
} from "@/components/ui";
import { annoncesApi } from "@/api";
import type { StatutWorkflow } from "@/types";
import common from "../common.module.css";

const TYPE_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "reunion", label: "Réunion" },
  { value: "voyage", label: "Voyage" },
  { value: "sortie", label: "Sortie" },
  { value: "exceptionnelle", label: "Exceptionnelle" },
] as const;

export function AnnoncesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]["value"]>("all");

  const query = useQuery({
    queryKey: ["annonces-list", search, type, page, status],
    queryFn: () =>
      annoncesApi.list({
        q: search || undefined,
        type: type === "all" ? undefined : type,
        page_size: 25,
        page,
        statut: status || undefined,
      }),
  });

  return (
    <>
      <Breadcrumb items={[{ label: "Annonces" }]} />
      <PageHead
        title="Annonces"
        lede="Réunions, voyages, sorties, événements exceptionnels."
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus size={14} />}
            onClick={() => navigate("/annonces/nouvelle")}
          >
            Nouvelle annonce
          </Button>
        }
      />
      <PageBody>
        <div className={common.filters}>
          <div className={common.search}>
            <Input
              aria-label="Rechercher dans la liste"
              placeholder="Recherche par titre, lieu…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Segmented
            ariaLabel="Type"
            items={
              TYPE_OPTIONS as unknown as {
                value: (typeof TYPE_OPTIONS)[number]["value"];
                label: string;
              }[]
            }
            value={type}
            onChange={(next) => {
              setType(next);
              setPage(1);
            }}
          />
          <Select
            label="État du contenu"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous les états</option>
            <option value="brouillon">Brouillon</option>
            <option value="en_revue">En relecture</option>
            <option value="publie">Publié</option>
            <option value="rejete">À reprendre</option>
            <option value="archive">Archivé</option>
          </Select>
        </div>
        <QueryFeedback
          loading={query.isLoading}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.isSuccess && (
          <TableWrap>
            {query.data?.results.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Date début</th>
                    <th>Titre</th>
                    <th>Type</th>
                    <th>Lieu</th>
                    <th>Statut temporel</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.results.map((annonce) => {
                    const fr = (annonce.traductions ?? []).find((t) => t.langue === "fr");
                    return (
                      <tr key={annonce.id}>
                        <td className={tableClasses.date}>
                          {dayjs(annonce.date_debut).format("DD MMM YYYY")}
                        </td>
                        <td className={tableClasses.title}>
                          <Link to={`/annonces/${annonce.slug}`}>{fr?.titre ?? annonce.slug}</Link>
                        </td>
                        <td>{annonce.type}</td>
                        <td>{annonce.lieu}</td>
                        <td>
                          <TemporalBadge statut={annonce.statut_temporel} />
                        </td>
                        <td>
                          <StatusBadge statut={annonce.statut as StatutWorkflow} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <TableEmpty message={query.isLoading ? "Chargement…" : "Aucune annonce."} />
            )}
            <TablePager>
              <span>
                {query.data.count} résultats · Page {page} sur{" "}
                {Math.max(1, Math.ceil(query.data.count / 25))}
              </span>
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Précédente
              </Button>
              <Button variant="ghost" disabled={!query.data.next} onClick={() => setPage(page + 1)}>
                Suivante
              </Button>
            </TablePager>
          </TableWrap>
        )}
      </PageBody>
    </>
  );
}
