import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, StatusBadge } from "@/components/ui";
import { temoignagesApi } from "@/api";
import type { Temoignage } from "@/types";
import styles from "./TemoignagesQueue.module.css";

function extrait(t: Temoignage): string {
  const fr = (t.traductions ?? []).find((tr) => tr.langue === "fr");
  if (!fr) return "(aucune traduction française)";
  return fr.quote_text || fr.corps || fr.titre || fr.auteur || "(vide)";
}

function auteur(t: Temoignage): string {
  const fr = (t.traductions ?? []).find((tr) => tr.langue === "fr");
  return fr?.auteur || fr?.cite || "(anonyme)";
}

export function TemoignagesPage() {
  const navigate = useNavigate();
  const recus = useQuery({
    queryKey: ["temoignages", "recu"],
    queryFn: () => temoignagesApi.list({ statut: "recu", page_size: 50 }),
  });
  const enRevue = useQuery({
    queryKey: ["temoignages", "en_revue"],
    queryFn: () => temoignagesApi.list({ statut: "en_revue", page_size: 50 }),
  });
  const publies = useQuery({
    queryKey: ["temoignages", "publie"],
    queryFn: () => temoignagesApi.list({ statut: "publie", page_size: 25 }),
  });

  const totalAtraiter = (recus.data?.count ?? 0) + (enRevue.data?.count ?? 0);

  return (
    <>
      <Breadcrumb items={[{ label: "Témoignages" }]} />
      <PageHead
        title="Témoignages"
        lede="Modérez les soumissions reçues, validez les témoignages en revue, gérez l'archive. Vous pouvez aussi saisir un témoignage transmis hors-ligne (à l'église, par téléphone, etc.)."
        actions={
          <Button onClick={() => navigate("/temoignages/nouveau")}>
            + Nouveau témoignage
          </Button>
        }
      />
      <PageBody>
        {totalAtraiter > 0 ? (
          <div className={styles.banner}>
            <div className={styles.bannerIcon}>
              <AlertTriangle size={18} />
            </div>
            <div className={styles.bannerBody}>
              <h4 className={styles.bannerTitle}>{totalAtraiter} témoignage(s) à traiter</h4>
              <p className={styles.bannerLede}>
                {recus.data?.count ?? 0} reçu(s) · {enRevue.data?.count ?? 0} en revue
              </p>
            </div>
          </div>
        ) : null}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>À traiter</h2>
            <span className={styles.sectionCount}>{recus.data?.count ?? 0}</span>
          </div>
          {recus.data?.results.length ? (
            <div className={styles.cards}>
              {recus.data.results.map((t) => (
                <article key={t.id} className={styles.card}>
                  <div className={styles.cardMeta}>
                    <StatusBadge statut={t.statut} />
                    <span>{t.source === "soumission_publique" ? "Soumission publique" : "Saisi admin"}</span>
                    <span>· {dayjs(t.date_recue).format("DD/MM/YYYY")}</span>
                  </div>
                  <span className={styles.cardAuteur}>{auteur(t)}</span>
                  <p className={styles.cardExtrait}>{extrait(t)}</p>
                  <div className={styles.cardActions}>
                    <Link to={`/temoignages/${t.slug}`}>
                      <Button size="sm" variant="primary">
                        Examiner
                      </Button>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--gray-500)", fontSize: 13 }}>
              {recus.isLoading ? "Chargement…" : "Aucun témoignage en attente."}
            </p>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>En revue</h2>
            <span className={styles.sectionCount}>{enRevue.data?.count ?? 0}</span>
          </div>
          {enRevue.data?.results.length ? (
            <div className={styles.cards}>
              {enRevue.data.results.map((t) => (
                <article key={t.id} className={styles.card}>
                  <div className={styles.cardMeta}>
                    <StatusBadge statut={t.statut} />
                    <span>· {dayjs(t.date_recue).format("DD/MM/YYYY")}</span>
                  </div>
                  <span className={styles.cardAuteur}>{auteur(t)}</span>
                  <p className={styles.cardExtrait}>{extrait(t)}</p>
                  <div className={styles.cardActions}>
                    <Link to={`/temoignages/${t.slug}`}>
                      <Button size="sm">Voir</Button>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--gray-500)", fontSize: 13 }}>
              Aucun témoignage en revue.
            </p>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Publiés</h2>
            <span className={styles.sectionCount}>{publies.data?.count ?? 0}</span>
          </div>
          {publies.data?.results.length ? (
            <div className={styles.cards}>
              {publies.data.results.map((t) => (
                <article key={t.id} className={styles.card}>
                  <div className={styles.cardMeta}>
                    <StatusBadge statut={t.statut} />
                    <span>
                      · publié{" "}
                      {t.publie_le ? dayjs(t.publie_le).format("DD/MM/YYYY") : "—"}
                    </span>
                  </div>
                  <span className={styles.cardAuteur}>{auteur(t)}</span>
                  <p className={styles.cardExtrait}>{extrait(t)}</p>
                  <div className={styles.cardActions}>
                    <Link to={`/temoignages/${t.slug}`}>
                      <Button size="sm" variant="ghost">
                        Voir
                      </Button>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--gray-500)", fontSize: 13 }}>
              Aucun témoignage publié.
            </p>
          )}
        </section>
      </PageBody>
    </>
  );
}
