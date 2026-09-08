import { QueryFeedback } from "@/components/ui/QueryFeedback";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "@/lib/dayjs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Card, Input } from "@/components/ui";
import { nehemieApi } from "@/api";

export function NehemiePage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["nehemie"], queryFn: () => nehemieApi.get() });
  const historique = useQuery({
    queryKey: ["nehemie", "historique"],
    queryFn: () => nehemieApi.historique(),
  });

  const [objectif, setObjectif] = useState("");
  const [collecte, setCollecte] = useState("");
  const [miseAJour, setMiseAJour] = useState(dayjs().format("YYYY-MM-DD"));
  const [hydrated, setHydrated] = useState(false);

  if (query.data && !hydrated) {
    setObjectif(query.data.objectif);
    setCollecte(query.data.collecte);
    setMiseAJour(query.data.mise_a_jour);
    setHydrated(true);
  }

  const update = useMutation({
    mutationFn: () =>
      nehemieApi.update({
        objectif,
        collecte,
        mise_a_jour: miseAJour,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["nehemie"] });
      void queryClient.invalidateQueries({ queryKey: ["nehemie", "historique"] });
    },
  });

  return (
    <>
      <Breadcrumb items={[{ label: "Néhémie" }]} />
      <PageHead
        title="Projet Néhémie"
        lede="Mettez à jour le montant collecté pour le projet de bâtiment. Consultez les mises à jour précédentes dans l’historique."
      />
      <PageBody>
        <QueryFeedback
          loading={query.isLoading}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {update.error && (
          <p role="alert" className="errorNotice">
            {update.error.message}
          </p>
        )}
        {update.isSuccess && (
          <p role="status" className="securityNotice">
            Mise à jour enregistrée.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Card title="Avancement">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <Input
                label="Objectif (€)"
                type="number"
                step="0.01"
                value={objectif}
                onChange={(event) => setObjectif(event.target.value)}
              />
              <Input
                label="Collecté (€)"
                type="number"
                step="0.01"
                value={collecte}
                onChange={(event) => setCollecte(event.target.value)}
              />
              <Input
                label="Date de mise à jour"
                type="date"
                value={miseAJour}
                onChange={(event) => setMiseAJour(event.target.value)}
              />
            </div>
            <div style={{ fontSize: 14, color: "var(--gray-700)", marginBottom: 16 }}>
              {query.data
                ? `${Math.round(query.data.pourcentage * 10) / 10} % de l'objectif atteint`
                : "—"}
            </div>
            <Button
              variant="primary"
              disabled={!query.isSuccess || update.isPending}
              onClick={() => update.mutate()}
            >
              Enregistrer la mise à jour
            </Button>
          </Card>

          <Card title="Historique des mises à jour">
            <QueryFeedback
              loading={historique.isLoading}
              error={historique.error}
              retry={() => void historique.refetch()}
            />
            {historique.data?.length ? (
              <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {historique.data.map((entry, idx) => (
                  <li key={idx} style={{ fontSize: 13, color: "var(--gray-600)" }}>
                    {dayjs(entry.history_date).format("DD/MM/YYYY HH:mm")} ·{" "}
                    {Number(entry.collecte).toLocaleString("fr-FR")} € ·{" "}
                    {entry.history_user ?? "système"}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                {historique.isSuccess ? "Aucun historique." : ""}
              </p>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
