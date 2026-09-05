import DOMPurify from 'dompurify';
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageBody, PageHead } from "@/components/layout/MainLayout";
import { Button, Input, Tabs } from "@/components/ui";
import { RichTextEditor } from "@/components/forms/RichTextEditor";
import { motDuPasteurApi } from "@/api";
import { HttpError } from "@/api/client";
import type { MotDuPasteur } from "@/types";
import common from "./common.module.css";

const EMPTY: MotDuPasteur = {
  texte_html_fr: "",
  texte_html_en: "",
  signature_fr: "Rev. Robert Ndaye M.",
  signature_en: "",
  modifie_le: "",
};

export function MotDuPasteurPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<MotDuPasteur>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  const query = useQuery({
    queryKey: ["mot-du-pasteur"],
    queryFn: () => motDuPasteurApi.get(),
  });

  if (query.data && !hydrated) {
    setDraft(query.data);
    setHydrated(true);
  }

  const save = useMutation({
    mutationFn: () => motDuPasteurApi.update(draft),
    onSuccess: (saved) => {
      queryClient.setQueryData(["mot-du-pasteur"], saved);
      setDraft(saved);
    },
  });

  const serverError = save.error instanceof HttpError ? save.error : null;

  const update = <K extends keyof MotDuPasteur>(key: K, value: MotDuPasteur[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <Breadcrumb items={[{ label: "Mot du pasteur" }]} />
      <PageHead
        title="Mot du pasteur"
        lede="Texte éditorial affiché sur la page d'accueil de la vitrine. Modifications en direct dès l'enregistrement."
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        }
      />
      <PageBody>
        <div className={common.editor}>
          {serverError ? (
            <div className={common.errorBox} role="alert">
              <strong>Erreur :</strong> {serverError.message}
            </div>
          ) : null}

          {save.isSuccess && !save.isPending ? (
            <p className={common.notice} role="status">
              ✓ Modifications enregistrées avec succès.
            </p>
          ) : null}

          <section className={common.section}>
            <span className={common.sectionTitle}>§1 Contenu</span>
            <Tabs
              items={[
                {
                  value: "fr",
                  label: "Français",
                  content: (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <p style={{ fontSize: 13, color: "var(--gray-600, #6b7280)", margin: 0 }}>
                        Utilise la barre d'outils pour mettre en gras, italique, souligner,
                        insérer une liste à puces ou un lien. Le rendu côté vitrine reprend
                        exactement le formatage saisi.
                      </p>
                      <RichTextEditor
                        value={draft.texte_html_fr}
                        onChange={(html) => update("texte_html_fr", html)}
                        placeholder="Écrire le mot du pasteur en français…"
                      />
                      <Input
                        label="Signature (FR)"
                        value={draft.signature_fr}
                        onChange={(event) => update("signature_fr", event.target.value)}
                        help='ex. "Rev. Robert Ndaye M."'
                      />
                    </div>
                  ),
                },
                {
                  value: "en",
                  label: "English",
                  content: (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <p style={{ fontSize: 13, color: "var(--gray-600, #6b7280)", margin: 0 }}>
                        Optional. If empty, the vitrine displays the French text.
                      </p>
                      <RichTextEditor
                        value={draft.texte_html_en}
                        onChange={(html) => update("texte_html_en", html)}
                        placeholder="English pastor's word…"
                      />
                      <Input
                        label="Signature (EN)"
                        value={draft.signature_en}
                        onChange={(event) => update("signature_en", event.target.value)}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </section>

          <section className={common.section}>
            <span className={common.sectionTitle}>Aperçu (HTML rendu)</span>
            <div
              className={common.notice}
              style={{ fontFamily: "ui-serif, 'Cormorant Garamond', Georgia, serif", fontSize: 17, lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(draft.texte_html_fr || "<em>(rien à afficher pour le moment)</em>"),
              }}
            />
            <p style={{ fontSize: 13, color: "var(--gray-500, #6b7280)", marginTop: 8 }}>
              — {draft.signature_fr || "(signature vide)"}
            </p>
          </section>
        </div>
      </PageBody>
    </>
  );
}
