import { expect, test, type Page } from "@playwright/test";

const id = "weekly-vlog";
const publicTitle = "Le message de la semaine";
const correctedTitle = "Le message de la semaine corrigé";
const translation = {
  langue: "fr",
  titre_message: publicTitle,
  titre_suffix: "",
  pitch_message: "Présentation du culte.",
  serie: "Marcher dans la foi",
  predicateur_libelle: "Samuel Berger",
  verset_reference: "Jean 3:16",
  verset_texte: "Le verset de la semaine.",
  fil_paragraphe1: "Le fil conducteur du message.",
  fil_paragraphe2: "",
  fil_versets: ["Jean 3:16"],
  temoignage_auteur: "",
  temoignage_texte: "",
};
const initial = {
  id,
  date_culte: "2026-09-06",
  heure_culte: "09:00:00",
  sermon: "existing-sermon",
  cantique_semaine: "existing-song",
  poster: null,
  replay_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  statut: "publie",
  statut_public: "publie",
  publie_le: "2026-09-06T12:00:00Z",
  revision_version: 4,
  revision: null as null | { id: string; version: number; statut: string; can_discard: boolean },
  traductions: [translation],
};

async function setup(
  page: Page,
  options: { editor?: boolean; revision?: boolean; publicationValidation?: boolean } = {},
) {
  let item = structuredClone(initial);
  let liveTitle = publicTitle;
  let reads = 0;
  const writes: { path: string; version?: string; body: Record<string, unknown> }[] = [];
  if (options.revision)
    item = {
      ...item,
      statut: "brouillon",
      revision: { id: "draft-revision", version: 4, statut: "brouillon", can_discard: true },
      traductions: [{ ...translation, titre_message: correctedTitle }],
    };
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const endpoint = `/vlog-semaine/admin/${id}/`;
    if (path === "/auth/me/")
      return route.fulfill({
        json: {
          id: "reviewer",
          username: "equipe.test",
          first_name: "Marie",
          last_name: "Équipe",
          role: options.editor ? "editeur" : "validateur",
          is_superuser: false,
          is_staff: true,
          mfa_required: false,
          mfa_setup_required: false,
          has_2fa: false,
          must_change_password: false,
        },
      });
    if (path === "/auth/csrf/") return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (request.method() !== "GET") {
      const body = request.postData() ? request.postDataJSON() : {};
      const version = request.headers()["x-revision-version"];
      writes.push({ path, version, body });
      if (version !== String(item.revision_version))
        return route.fulfill({
          status: 409,
          json: {
            error: {
              code: "revision_conflict",
              message: "Un autre membre a modifié le vlog. Votre saisie est conservée.",
            },
          },
        });
      const next = item.revision_version + 1;
      if (path === endpoint && request.method() === "PATCH")
        item = {
          ...item,
          ...body,
          statut: "brouillon",
          revision_version: next,
          revision: { id: "draft-revision", version: next, statut: "brouillon", can_discard: true },
        };
      else if (path === `${endpoint}publier/`) {
        if (options.editor)
          return route.fulfill({ status: 403, json: { error: { code: "permission_denied" } } });
        if (options.publicationValidation)
          return route.fulfill({
            status: 400,
            json: {
              traductions: { fr: { predicateur_libelle: ["Ce champ ne peut pas être vide."] } },
            },
          });
        liveTitle = item.traductions[0].titre_message;
        item = { ...item, statut: "publie", revision: null, revision_version: next };
      } else if (path === `${endpoint}soumettre/`)
        item = {
          ...item,
          statut: "en_revue",
          revision_version: next,
          revision: { id: "draft-revision", version: next, statut: "en_revue", can_discard: true },
        };
      else if (path === `${endpoint}annuler-revision/`)
        item = { ...structuredClone(initial), revision_version: next };
      else return route.fulfill({ status: 404, json: {} });
      return route.fulfill({ json: item });
    }
    if (path === endpoint) {
      reads += 1;
      return route.fulfill({ json: item });
    }
    if (path === "/vlog-semaine/admin/")
      return route.fulfill({ json: { count: 1, results: [item], next: null, previous: null } });
    return route.fulfill({ json: { count: 0, results: [], next: null, previous: null } });
  });
  return {
    writes,
    current: () => item,
    live: () => liveTitle,
    reads: () => reads,
    reviseRemotely: () => {
      const version = item.revision_version + 1;
      item = {
        ...item,
        statut: "brouillon",
        revision_version: version,
        revision: { id: "remote-revision", version, statut: "brouillon", can_discard: true },
        traductions: [{ ...translation, titre_message: "Correction d’un autre membre" }],
      };
    },
  };
}

const title = (page: Page) => page.getByRole("textbox", { name: "Titre du vlog", exact: true });
const save = (page: Page) => page.getByRole("button", { name: "Enregistrer le vlog", exact: true });

test("la correction du vlog publié reste active et peut être reprise puis publiée", async ({
  page,
}) => {
  const state = await setup(page, { revision: true });
  await page.goto("/cette-semaine");
  await expect(page.getByText(/^Vlog actif — Semaine du/)).toBeVisible();
  await expect(page.getByText("Aucun vlog actif", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reprendre la correction" }).click();
  await expect(title(page)).toHaveValue(correctedTitle);
  await title(page).fill("Une correction relue et complétée");
  await save(page).click();
  await expect.poll(() => state.current().revision_version).toBe(5);
  expect(state.live()).toBe(publicTitle);
  await expect(
    page.getByRole("button", { name: "Publier la correction", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Publier la correction", exact: true }).click();
  await expect.poll(() => state.live()).toBe("Une correction relue et complétée");
  expect(state.writes.map((write) => write.version)).toEqual(["4", "5"]);
  expect(state.current().sermon).toBe("existing-sermon");
  expect(state.current().cantique_semaine).toBe("existing-song");
  expect(state.current().traductions[0].fil_versets).toEqual(["Jean 3:16"]);
});

test("un éditeur enregistre et soumet le vlog sans modifier la version publique", async ({
  page,
}) => {
  const state = await setup(page, { editor: true });
  await page.goto("/cette-semaine");
  await page.getByRole("button", { name: "Modifier le vlog", exact: true }).click();
  await title(page).fill(correctedTitle);
  await save(page).click();
  await expect.poll(() => state.current().statut).toBe("brouillon");
  await expect(page.getByText(/^Vlog actif — Semaine du/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Publier/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Soumettre à validation", exact: true }).click();
  await expect.poll(() => state.current().statut).toBe("en_revue");
  await page.reload();
  await expect(title(page)).toHaveValue(correctedTitle);
  await expect(
    page.getByRole("status").filter({ hasText: "Correction soumise à validation" }),
  ).toBeVisible();
  expect(state.live()).toBe(publicTitle);
  expect(state.writes.map((write) => write.version)).toEqual(["4", "5"]);
});

test("un rafraîchissement concurrent du vlog conserve la saisie et sa version initiale", async ({
  page,
}) => {
  await page.clock.install();
  const state = await setup(page);
  await page.goto(`/cette-semaine?vlog=${id}`);
  await expect(title(page)).toHaveValue(publicTitle);
  await title(page).fill(correctedTitle);
  const readsBefore = state.reads();
  state.reviseRemotely();
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => state.reads()).toBeGreaterThan(readsBefore);
  await expect(page.getByText("Correction d’un autre membre", { exact: true })).toBeVisible();
  await expect(title(page)).toHaveValue(correctedTitle);
  await save(page).click();
  await expect(page.getByRole("alert")).toContainText("Un autre membre a modifié le vlog");
  await expect(title(page)).toHaveValue(correctedTitle);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].version).toBe("4");
  expect(state.live()).toBe(publicTitle);
});

test("abandonner la correction du vlog ferme son édition et conserve le vlog public", async ({
  page,
}) => {
  const state = await setup(page, { revision: true });
  await page.goto(`/cette-semaine?vlog=${id}`);
  await expect(title(page)).toHaveValue(correctedTitle);
  await page.getByRole("button", { name: "Abandonner la correction", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Garder la correction" }).click();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Abandonner la correction", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Abandonner et revenir à la liste" })
    .click();
  await expect(page).toHaveURL(/\/cette-semaine$/);
  await expect(title(page)).toHaveCount(0);
  await expect(page.getByText(/^Vlog actif — Semaine du/)).toBeVisible();
  expect(state.writes[0]).toMatchObject({
    path: `/vlog-semaine/admin/${id}/annuler-revision/`,
    version: "4",
  });
  expect(state.live()).toBe(publicTitle);
  expect(state.current().revision).toBeNull();
});

test("une publication refusée identifie le champ obligatoire du vlog et conserve la saisie", async ({
  page,
}) => {
  const state = await setup(page, { revision: true, publicationValidation: true });
  await page.goto(`/cette-semaine?vlog=${id}`);
  await expect(title(page)).toHaveValue(correctedTitle);
  await title(page).fill("La correction préparée par l’équipe");
  await save(page).click();
  await expect.poll(() => state.current().revision_version).toBe(5);
  await page.getByRole("button", { name: "Publier la correction", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Nom du prédicateur affiché : Ce champ ne peut pas être vide.",
  );
  await expect(title(page)).toHaveValue("La correction préparée par l’équipe");
  await expect(save(page)).toBeEnabled();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toMatchObject({
    path: `/vlog-semaine/admin/${id}/publier/`,
    version: "5",
  });
  expect(state.current().statut).toBe("brouillon");
  expect(state.current().revision_version).toBe(5);
  expect(state.live()).toBe(publicTitle);
});
