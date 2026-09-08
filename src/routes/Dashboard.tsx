import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Megaphone, Music, MessageSquare, CalendarDays } from "lucide-react";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { StatusBadge } from "@/components/ui";
import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { sermonsApi, temoignagesApi } from "@/api";
import styles from "./Dashboard.module.css";

export function DashboardPage() {
  const recent = useQuery({
    queryKey: ["dashboard", "sermons"],
    queryFn: () => sermonsApi.listAdmin({ ordering: "-modifie_le", page_size: 6 }),
  });
  const received = useQuery({
    queryKey: ["temoignages", "count", "recu"],
    queryFn: () => temoignagesApi.list({ statut: "recu", page_size: 1 }),
  });
  const reviewing = useQuery({
    queryKey: ["temoignages", "count", "en_revue"],
    queryFn: () => temoignagesApi.list({ statut: "en_revue", page_size: 1 }),
  });
  const sermons = useQuery({
    queryKey: ["dashboard", "en_revue"],
    queryFn: () => sermonsApi.listAdmin({ statut: "en_revue", page_size: 1 }),
  });
  const tasks = [
    {
      title: "Témoignages reçus",
      note: "Lire les nouveaux messages et préparer leur relecture.",
      to: "/temoignages?statut=recu",
      query: received,
    },
    {
      title: "Témoignages en relecture",
      note: "Relire les textes préparés avant leur publication.",
      to: "/temoignages?statut=en_revue",
      query: reviewing,
    },
    {
      title: "Cultes à valider",
      note: "Vérifier les contenus soumis à la validation.",
      to: "/sermons?statut=en_revue",
      query: sermons,
    },
  ];
  return (
    <>
      <Breadcrumb items={[{ label: "Tableau de bord" }]} />
      <PageHead
        title="Tableau de bord"
        lede="Les contenus à suivre et les outils pour préparer la vie de l’église."
      />
      <PageBody>
        <section className={styles.section} aria-labelledby="daily-title">
          <h2 id="daily-title">À suivre</h2>
          <div className={styles.tasks}>
            {tasks.map((task) => (
              <article key={task.title} className={styles.task}>
                <div className={styles.taskTop}>
                  <h3>{task.title}</h3>
                  <span className={styles.count}>
                    {task.query.isSuccess ? task.query.data.count : "—"}
                  </span>
                </div>
                <p>{task.note}</p>
                {task.query.isError ? (
                  <button className={styles.retry} onClick={() => void task.query.refetch()}>
                    Chargement impossible · Réessayer
                  </button>
                ) : (
                  <Link to={task.to}>
                    Ouvrir la liste <ArrowRight size={15} aria-hidden />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
        <section className={styles.section} aria-labelledby="prepare-title">
          <h2 id="prepare-title">Préparer un contenu</h2>
          <div className={styles.shortcuts}>
            <Link to="/sermons/nouveau">
              <BookOpen size={20} aria-hidden />
              <span>Nouveau culte</span>
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/cantiques/nouveau">
              <Music size={20} aria-hidden />
              <span>Nouveau cantique</span>
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/annonces/nouvelle">
              <Megaphone size={20} aria-hidden />
              <span>Nouvelle annonce</span>
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/temoignages/nouveau">
              <MessageSquare size={20} aria-hidden />
              <span>Saisir un témoignage</span>
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
        <div className={styles.lower}>
          <section className={styles.section} aria-labelledby="recent-title">
            <div className={styles.sectionHead}>
              <h2 id="recent-title">Cultes récemment modifiés</h2>
              <Link to="/sermons">Tous les cultes</Link>
            </div>
            <QueryFeedback
              loading={recent.isLoading}
              error={recent.error}
              retry={() => void recent.refetch()}
            />
            {recent.isSuccess && (
              <div className={styles.recent}>
                {recent.data.results.length ? (
                  recent.data.results.map((sermon) => (
                    <div className={styles.recentRow} key={sermon.id}>
                      <div>
                        <Link to={`/sermons/${sermon.slug}`}>
                          {sermon.traductions.find((t) => t.langue === "fr")?.titre || sermon.slug}
                        </Link>
                        <p>Modifié le {dayjs(sermon.modifie_le).format("D MMM YYYY")}</p>
                      </div>
                      <StatusBadge statut={sermon.statut} />
                    </div>
                  ))
                ) : (
                  <p className={styles.empty}>Aucun culte enregistré pour le moment.</p>
                )}
              </div>
            )}
          </section>
          <aside className={styles.week}>
            <CalendarDays size={24} aria-hidden />
            <h2>Cette semaine</h2>
            <p>Retrouvez les rendez-vous, les images et les vidéos de la semaine.</p>
            <Link to="/cette-semaine">
              Préparer la semaine <ArrowRight size={16} aria-hidden />
            </Link>
            <hr />
            <Link to="/personnes">Consulter le répertoire</Link>
            <p>Vérifiez les fiches et les rôles avant de choisir les intervenants.</p>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
