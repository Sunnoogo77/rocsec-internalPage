import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Megaphone, Music, Wallet } from "lucide-react";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import {
  cantiquesApi,
  annoncesApi,
  nehemieApi,
  sermonsApi,
  temoignagesApi,
} from "@/api";
import styles from "./Dashboard.module.css";

function formatEuro(value: string | number | undefined): string {
  if (value === undefined) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("fr-FR").format(n) + " €";
}

export function DashboardPage() {
  const sermonsQuery = useQuery({
    queryKey: ["dashboard", "sermons"],
    queryFn: () => sermonsApi.listAdmin({ ordering: "-modifie_le", page_size: 10 }),
  });
  const moderationQuery = useQuery({
    queryKey: ["dashboard", "moderation"],
    queryFn: () => temoignagesApi.list({ statut: "recu", page_size: 1 }),
  });
  const enRevueQuery = useQuery({
    queryKey: ["dashboard", "en_revue"],
    queryFn: () => sermonsApi.listAdmin({ statut: "en_revue", page_size: 1 }),
  });
  const cantiquesQuery = useQuery({
    queryKey: ["dashboard", "cantiques"],
    queryFn: () => cantiquesApi.list({ statut: "publie", page_size: 1 }),
  });
  const annoncesQuery = useQuery({
    queryKey: ["dashboard", "annonces"],
    queryFn: () => annoncesApi.list({ statut: "publie", page_size: 1 }),
  });
  const nehemieQuery = useQuery({
    queryKey: ["dashboard", "nehemie"],
    queryFn: () => nehemieApi.get(),
  });

  const moderationCount =
    (moderationQuery.data?.count ?? 0) + (enRevueQuery.data?.count ?? 0);

  return (
    <>
      <Breadcrumb items={[{ label: "Tableau de bord" }]} />
      <PageHead
        title="Tableau de bord"
        lede="Vue d'ensemble de l'activité et des actions à mener cette semaine."
      />
      <PageBody>
        <div className={`${styles.row} ${styles.cols4}`}>
          <div className={styles.cardLarge}>
            <span className={styles.cardEyebrow}>Cette semaine</span>
            <span className={styles.cardValue}>
              {sermonsQuery.data?.results?.[0]
                ? dayjs(sermonsQuery.data.results[0].date_culte).format("DD MMM")
                : "—"}
            </span>
            <span className={styles.cardSub}>
              {sermonsQuery.data?.results?.[0]
                ? `${sermonsQuery.data.results[0].traductions?.[0]?.titre ?? "Sermon sans titre"} — ${
                    typeof sermonsQuery.data.results[0].predicateur === "object"
                      ? sermonsQuery.data.results[0].predicateur.libelle
                      : ""
                  }`
                : "Aucun sermon planifié."}
            </span>
          </div>
          <div className={styles.cardLarge}>
            <span className={styles.cardEyebrow}>File de modération</span>
            <span className={styles.cardValue}>{moderationCount}</span>
            <span className={styles.cardSub}>
              <Link to="/temoignages">Témoignages reçus + sermons en revue →</Link>
            </span>
          </div>
          <div className={styles.cardLarge}>
            <span className={styles.cardEyebrow}>Projet Néhémie</span>
            <span className={styles.cardValue}>
              {nehemieQuery.data
                ? `${Math.round(nehemieQuery.data.pourcentage * 10) / 10} %`
                : "—"}
            </span>
            <span className={styles.cardSub}>
              {nehemieQuery.data
                ? `${formatEuro(nehemieQuery.data.collecte)} / ${formatEuro(
                    nehemieQuery.data.objectif,
                  )}`
                : "Données indisponibles."}
            </span>
          </div>
          <div className={styles.cardLarge}>
            <span className={styles.cardEyebrow}>Volumes publiés</span>
            <span className={styles.cardValue}>
              {(sermonsQuery.data?.count ?? 0) +
                (cantiquesQuery.data?.count ?? 0) +
                (annoncesQuery.data?.count ?? 0)}
            </span>
            <span className={styles.cardSub}>
              {sermonsQuery.data?.count ?? 0} sermons · {cantiquesQuery.data?.count ?? 0}{" "}
              cantiques · {annoncesQuery.data?.count ?? 0} annonces
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Activité récente</h2>
          <div className={styles.activity}>
            {(sermonsQuery.data?.results ?? []).slice(0, 8).map((sermon) => (
              <div key={sermon.id} className={styles.activityRow}>
                <span className={styles.activityType}>SERMON</span>
                <Link to={`/sermons/${sermon.slug}`} className={styles.activityTitle}>
                  {sermon.traductions?.[0]?.titre ?? sermon.slug}
                </Link>
                <span className={styles.activityMeta}>
                  {dayjs(sermon.modifie_le).fromNow()}
                </span>
              </div>
            ))}
            {(sermonsQuery.data?.results ?? []).length === 0 ? (
              <div className={styles.activityRow}>
                <span className={styles.activityMeta}>Aucune activité récente.</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Actions rapides</h2>
          <div className={styles.quickActions}>
            <Link to="/sermons/nouveau" className={styles.quickAction}>
              <span className={styles.quickActionIcon}>
                <BookOpen size={16} />
              </span>
              <span>+ Nouveau sermon</span>
            </Link>
            <Link to="/annonces/nouvelle" className={styles.quickAction}>
              <span className={styles.quickActionIcon}>
                <Megaphone size={16} />
              </span>
              <span>+ Nouvelle annonce</span>
            </Link>
            <Link to="/cantiques/nouveau" className={styles.quickAction}>
              <span className={styles.quickActionIcon}>
                <Music size={16} />
              </span>
              <span>+ Nouveau cantique</span>
            </Link>
            <Link to="/nehemie" className={styles.quickAction}>
              <span className={styles.quickActionIcon}>
                <Wallet size={16} />
              </span>
              <span>MAJ Néhémie</span>
            </Link>
          </div>
        </div>
      </PageBody>
    </>
  );
}
