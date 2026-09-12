import { expect, test, type Page } from "@playwright/test";

type Kind = "sermons" | "cantiques" | "annonces" | "temoignages";
type Item = Record<string, unknown> & {
  statut: string;
  revision_version: number;
  traductions: { langue: string; titre: string; [key: string]: unknown }[];
};
type Write = { method: string; path: string; version?: string; body: Record<string, unknown> };

const kinds: Kind[] = ["sermons", "cantiques", "annonces", "temoignages"];
const slug = "publication-a-corriger";
const initialTitle = "Le contenu actuellement publié";
const correctedTitle = "Le contenu corrigé par son auteur";
const actor = {
  id: "reviewer",
  username: "equipe.marie",
  first_name: "Marie",
  last_name: "Martin",
  is_staff: true,
  is_superuser: false,
  role: "validateur",
  has_2fa: false,
  mfa_required: false,
  mfa_setup_required: false,
  must_change_password: false,
};
const role = {
  id: "pasteur",
  code: "pasteur",
  libelle_fr: "Pasteur",
  libelle_en: "Pastor",
  actif: true,
  ordre: 0,
};
const person = {
  id: "pastor",
  prenom: "Samuel",
  nom: "Berger",
  libelle: "Samuel Berger",
  civilite: "Fr.",
  nom_affichage: "",
  roles: ["pasteur"],
  roles_detail: [role],
  role_principal: "autre",
  actif: true,
  bio_courte_fr: "",
  bio_courte_en: "",
};
const types = [
  { id: "sunday", code: "culte-dimanche", libelle_fr: "Culte du dimanche", actif: true },
  { id: "wednesday", code: "culte-mercredi", libelle_fr: "Culte du mercredi", actif: true },
];
const family = { id: "special", code: "special", libelle_fr: "Cantique spécial", actif: true };
const paginated = (results: unknown[]) => ({
  count: results.length,
  results,
  next: null,
  previous: null,
});

function fixture(kind: Kind): Item {
  const common = {
    id: slug,
    slug,
    statut: "publie",
    statut_public: "publie",
    revision_version: 7,
    revision: null,
    cree_par: actor.id,
    modifie_par: actor.id,
    cree_le: "2026-09-05T10:00:00Z",
    modifie_le: "2026-09-07T10:00:00Z",
  };
  if (kind === "sermons")
    return {
      ...common,
      date_culte: "2026-09-06T09:00:00Z",
      predicateur: person.id,
      predicateur_detail: person,
      type_culte: types[0].id,
      type_culte_detail: types[0],
      traductions: [
        {
          langue: "fr",
          titre: initialTitle,
          titre_em: "",
          description_courte: "",
          youtube_url: "",
        },
      ],
      passages: [{ id: 1, ordre: 0, reference: "Jean 3:16", texte: "Passage initial." }],
      citations_branham: [
        { id: 2, ordre: 0, source: "Référence initiale", texte: "Citation initiale." },
      ],
      plan: [
        {
          id: 3,
          ordre: 0,
          numero_romain: "I",
          titre: "Introduction",
          description: "Plan initial.",
        },
      ],
      serie: null,
      thumbnail_url: "",
      audio_url: "",
      duree_minutes: null,
      numero_dans_serie: null,
    };
  if (kind === "cantiques")
    return {
      ...common,
      famille: family.id,
      famille_detail: family,
      evenement: null,
      interpretes: [],
      groupes_interpretes: [],
      interprete_lead: null,
      numero_recueil: null,
      est_medley: false,
      passages: [],
      duration: "03:00",
      recording_type: "culte",
      date_enregistrement: "2026-09-06",
      audio_url: "",
      est_vedette: false,
      traductions: [
        {
          langue: "fr",
          titre: initialTitle,
          titre_em: "",
          detail_by: "",
          youtube_url: "",
          lyrics: [],
        },
      ],
    };
  if (kind === "annonces")
    return {
      ...common,
      type: "reunion",
      sous_type: "",
      date_debut: "2026-09-16T17:00:00Z",
      date_fin: null,
      lieu: "Salle principale",
      cta_url: "",
      est_phare: false,
      featured_eyebrow: "",
      traductions: [
        {
          langue: "fr",
          titre: initialTitle,
          titre_em: "",
          sous_type_label: "",
          description: "Le texte de la réunion.",
          date_display: "",
          dl: "",
          content_blocks: [],
        },
      ],
    };
  return {
    ...common,
    type: "recit",
    source: "admin",
    date_recue: "2026-09-07T12:00:00Z",
    publie_le: "2026-09-07T12:00:00Z",
    prenom_contact: "Anne",
    nom_contact: "Martin",
    email_contact: "",
    telephone_contact: "",
    ville_contact: "",
    texte_soumis: "",
    has_detail: false,
    accent_rouge: false,
    image_publique: true,
    image: null,
    photos: [],
    motif_rejet: "",
    traductions: [
      {
        langue: "fr",
        titre: initialTitle,
        auteur: "Anne M.",
        cite: "",
        quote_text: "",
        eyebrow: "",
        corps: "Merci à toute l’assemblée.",
        paragraphs: [],
        byline: "",
        reading_minutes: null,
        tag: "",
        verset_ref: "",
        verset_text: "",
      },
    ],
  };
}

async function setup(
  page: Page,
  kind: Kind,
  options: {
    editor?: boolean;
    conflict?: boolean;
    nestedValidation?: boolean;
    rejectDiscardOnce?: boolean;
  } = {},
) {
  let working = fixture(kind);
  let publicTitle = initialTitle;
  let reads = 0;
  let discardAttempts = 0;
  const writes: Write[] = [];
  const endpoint = `/${kind}/admin/${slug}/`;
  const submitAction = kind === "temoignages" ? "marquer_en_revue" : "soumettre";
  const publishAction = kind === "temoignages" ? "approuver" : "publier";
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const method = request.method();
    if (path === "/auth/me/")
      return route.fulfill({ json: { ...actor, role: options.editor ? "editeur" : "validateur" } });
    if (path === "/auth/csrf/") return route.fulfill({ json: { csrf: "synthetic" } });
    if (path === "/auth/2fa/step-up/")
      return route.fulfill({ json: { is_recent: true, seconds_remaining: 3600 } });
    if (method !== "GET") {
      const body = request.postData() ? (request.postDataJSON() as Record<string, unknown>) : {};
      writes.push({ method, path, version: request.headers()["x-revision-version"], body });
      if (method === "PATCH" && path === endpoint) {
        if (options.nestedValidation)
          return route.fulfill({
            status: 400,
            json: { traductions: [{ titre: ["Ce champ est obligatoire."] }] },
          });
        if (
          options.conflict ||
          request.headers()["x-revision-version"] !== String(working.revision_version)
        )
          return route.fulfill({
            status: 409,
            json: {
              error: {
                code: "revision_conflict",
                message: "Une autre personne a modifié ce contenu. Votre saisie est conservée.",
              },
            },
          });
        const version = working.revision_version + 1;
        const statut = kind === "temoignages" ? "recu" : "brouillon";
        working = {
          ...working,
          ...body,
          statut,
          revision_version: version,
          revision: { id: "revision-test", version, statut, can_discard: true },
        };
        return route.fulfill({ json: working });
      }
      if (path === `${endpoint}${submitAction}/`) {
        const version = working.revision_version + 1;
        working = {
          ...working,
          statut: "en_revue",
          revision_version: version,
          revision: { id: "revision-test", version, statut: "en_revue" },
        };
        return route.fulfill({ json: working });
      }
      if (path === `${endpoint}${publishAction}/`) {
        if (options.editor)
          return route.fulfill({
            status: 403,
            json: { error: { code: "permission_denied", message: "Validation requise." } },
          });
        publicTitle =
          working.traductions.find((translation) => translation.langue === "fr")?.titre ?? "";
        working = {
          ...working,
          statut: "publie",
          revision: null,
          revision_version: working.revision_version + 1,
        };
        return route.fulfill({ json: working });
      }
      if (path === `${endpoint}annuler-revision/`) {
        discardAttempts += 1;
        if (options.rejectDiscardOnce && discardAttempts === 1)
          return route.fulfill({
            status: 409,
            json: {
              error: {
                code: "revision_conflict",
                message: "La correction n’a pas pu être abandonnée. Réessayez.",
              },
            },
          });
        working = { ...fixture(kind), revision_version: working.revision_version + 1 };
        return route.fulfill({ json: working });
      }
      if (path === `/${kind}/admin/` && method === "POST") {
        working = {
          ...working,
          ...body,
          statut: "brouillon",
          statut_public: null,
          revision_version: 1,
        };
        return route.fulfill({ status: 201, json: working });
      }
      return route.fulfill({
        status: 404,
        json: { error: { message: `Écriture inattendue : ${path}` } },
      });
    }
    if (path === endpoint) {
      reads += 1;
      return route.fulfill({ json: working });
    }
    if (path === "/personnes/roles/") return route.fulfill({ json: [role] });
    if (path === "/personnes/") return route.fulfill({ json: paginated([person]) });
    if (path === `/personnes/${person.id}/`) return route.fulfill({ json: person });
    if (path === "/sermons/types/") return route.fulfill({ json: types });
    if (path === "/cantiques/familles/") return route.fulfill({ json: [family] });
    if (path.endsWith("/occurrences/")) return route.fulfill({ json: [] });
    return route.fulfill({ json: paginated([]) });
  });
  return {
    writes,
    current: () => working,
    publicTitle: () => publicTitle,
    reads: () => reads,
    reviseRemotely: () => {
      const version = working.revision_version + 1;
      const statut = kind === "temoignages" ? "recu" : "brouillon";
      working = {
        ...working,
        statut,
        revision_version: version,
        traductions: working.traductions.map((translation) => ({
          ...translation,
          titre: "La correction d’un autre membre",
        })),
        revision: { id: "correction-distante", version, statut, can_discard: true },
      };
    },
    submitAction,
    publishAction,
  };
}

const titleField = (page: Page) => page.getByRole("textbox", { name: "Titre", exact: true });
const saveButton = (page: Page) =>
  page.getByRole("button", { name: "Enregistrer les modifications", exact: true });
const publishButton = (page: Page, kind: Kind) =>
  page.getByRole("button", {
    name: kind === "temoignages" ? /^Approuver et publier$/ : /^Publier(?: la correction)?$/,
  });
async function saveCorrection(page: Page, kind: Kind) {
  await page.goto(`/${kind}/${slug}`);
  await expect(titleField(page)).toHaveValue(initialTitle);
  await expect(titleField(page)).toBeEditable();
  await titleField(page).fill(correctedTitle);
  await saveButton(page).click();
}

for (const kind of kinds) {
  test(`${kind} : corriger une publication et publier sa propre correction avec un compte validateur`, async ({
    page,
  }) => {
    const state = await setup(page, kind);
    await saveCorrection(page, kind);
    await expect.poll(() => state.current().revision_version).toBe(8);
    expect(state.publicTitle()).toBe(initialTitle);
    expect(state.current().statut_public).toBe("publie");
    expect(state.current().statut).toBe(kind === "temoignages" ? "recu" : "brouillon");
    expect(state.writes[0]).toMatchObject({
      method: "PATCH",
      path: `/${kind}/admin/${slug}/`,
      version: "7",
    });
    await expect(publishButton(page, kind)).toBeEnabled();
    await publishButton(page, kind).click();
    if (kind === "temoignages")
      await page.getByRole("button", { name: "Confirmer la publication" }).click();
    await expect.poll(() => state.publicTitle()).toBe(correctedTitle);
    expect(state.current().revision_version).toBe(9);
    expect(state.writes).toHaveLength(2);
    expect(state.writes[1]).toMatchObject({
      path: `/${kind}/admin/${slug}/${state.publishAction}/`,
      version: "8",
    });
    expect(state.writes.some((write) => write.path.endsWith(`/${state.submitAction}/`))).toBe(
      false,
    );
  });

  test(`${kind} : un éditeur soumet la correction, sans pouvoir publier`, async ({ page }) => {
    const state = await setup(page, kind, { editor: true });
    await saveCorrection(page, kind);
    await expect.poll(() => state.current().revision_version).toBe(8);
    await expect(
      page.getByRole("button", { name: /^Soumettre à validation$|^Passer en revue$/ }),
    ).toBeEnabled();
    await page.getByRole("button", { name: /^Soumettre à validation$|^Passer en revue$/ }).click();
    await expect.poll(() => state.current().statut).toBe("en_revue");
    expect(state.current().revision_version).toBe(9);
    expect(state.publicTitle()).toBe(initialTitle);
    expect(state.writes).toHaveLength(2);
    expect(state.writes[0].version).toBe("7");
    expect(state.writes[1]).toMatchObject({
      path: `/${kind}/admin/${slug}/${state.submitAction}/`,
      version: "8",
    });
    await expect(publishButton(page, kind).filter({ visible: true })).toHaveCount(0);
    expect(state.writes.some((write) => write.path.endsWith(`/${state.publishAction}/`))).toBe(
      false,
    );
  });

  test(`${kind} : un conflit de version conserve la saisie et affiche l’erreur`, async ({
    page,
  }) => {
    const state = await setup(page, kind, { conflict: true });
    await saveCorrection(page, kind);
    await expect(page.getByRole("alert").first()).toContainText(
      "Une autre personne a modifié ce contenu",
    );
    await expect(titleField(page)).toHaveValue(correctedTitle);
    await expect(saveButton(page)).toBeEnabled();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].version).toBe("7");
    expect(state.current().revision_version).toBe(7);
    expect(state.publicTitle()).toBe(initialTitle);
  });
}

test("nouveau culte : date et heure séparées, horaires proposés et heure personnalisée préservée", async ({
  page,
}, info) => {
  const state = await setup(page, "sermons");
  await page.goto("/sermons/nouveau");
  const date = page.getByRole("textbox", { name: "Date du culte", exact: true });
  const time = page.getByRole("textbox", { name: "Heure", exact: true });
  await expect(date).toHaveAttribute("type", "date");
  await expect(time).toHaveAttribute("type", "time");
  await page.getByRole("combobox", { name: "Type de culte" }).selectOption("wednesday");
  await expect(time).toHaveValue("19:00");
  await page.getByRole("combobox", { name: "Type de culte" }).selectOption("sunday");
  await expect(time).toHaveValue("09:00");
  await time.fill("18:45");
  await page.getByRole("combobox", { name: "Type de culte" }).selectOption("wednesday");
  await expect(time).toHaveValue("18:45");
  await date.fill("2026-09-16");
  await date.locator("xpath=ancestor::section[1]").screenshot({
    path: `test-results/date-time-${info.project.name}.png`,
  });
  await titleField(page).fill("Culte du mercredi");
  await page.getByRole("combobox", { name: "Prédicateur" }).fill("Samuel");
  await page.getByRole("option", { name: /Samuel Berger/ }).click();
  await saveButton(page).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toMatchObject({
    method: "POST",
    path: "/sermons/admin/",
    body: {
      date_culte: "2026-09-16T16:45:00.000Z",
      type_culte: "wednesday",
      predicateur: "pastor",
    },
  });
});

test("un culte existant conserve son heure personnalisée quand son type change", async ({
  page,
}) => {
  await setup(page, "sermons");
  await page.goto(`/sermons/${slug}`);
  const time = page.getByRole("textbox", { name: "Heure", exact: true });
  await expect(time).toHaveValue("11:00");
  await page.getByRole("combobox", { name: "Type de culte" }).selectOption("wednesday");
  await expect(time).toHaveValue("11:00");
  await page.getByRole("combobox", { name: "Type de culte" }).selectOption("sunday");
  await expect(time).toHaveValue("11:00");
});

test("un culte incomplet indique les champs manquants avant toute écriture réseau", async ({
  page,
}) => {
  const state = await setup(page, "sermons");
  await page.goto("/sermons/nouveau");
  await page.getByRole("textbox", { name: "Date du culte", exact: true }).fill("");
  await saveButton(page).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Renseignez le titre du culte");
  await expect(alert).toContainText("Choisissez le type de culte");
  await expect(alert).toContainText("Choisissez la date et l’heure du culte");
  expect(state.writes).toHaveLength(0);
});

test("la correction d’un sermon conserve et enregistre passages, citations et plan", async ({
  page,
}) => {
  const state = await setup(page, "sermons");
  await page.goto(`/sermons/${slug}`);
  await page.getByRole("textbox", { name: "Référence", exact: true }).fill("Psaume 23:1");
  await page
    .getByRole("textbox", { name: "Texte", exact: true })
    .nth(0)
    .fill("Le Seigneur est mon berger.");
  await page.getByRole("textbox", { name: "Source", exact: true }).fill("Source corrigée");
  await page.getByRole("textbox", { name: "Texte", exact: true }).nth(1).fill("Citation corrigée.");
  await page.getByRole("textbox", { name: "I Titre", exact: true }).fill("La confiance");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Application du passage.");
  await saveButton(page).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].body).toMatchObject({
    passages: [{ ordre: 0, reference: "Psaume 23:1", texte: "Le Seigneur est mon berger." }],
    citations_branham: [{ ordre: 0, source: "Source corrigée", texte: "Citation corrigée." }],
    plan: [{ ordre: 0, titre: "La confiance", description: "Application du passage." }],
  });
  expect(state.writes[0].version).toBe("7");
  expect(state.publicTitle()).toBe(initialTitle);
});

test("un rechargement en arrière-plan ne remplace pas la version du formulaire en cours", async ({
  page,
}) => {
  await page.clock.install();
  const state = await setup(page, "sermons");
  await page.goto(`/sermons/${slug}`);
  await expect(titleField(page)).toHaveValue(initialTitle);
  await titleField(page).fill(correctedTitle);
  const readsBefore = state.reads();
  state.reviseRemotely();
  // Simulate reconnecting after the cache freshness interval, while keeping the editor mounted.
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => state.reads()).toBeGreaterThan(readsBefore);
  await expect(
    page.getByRole("heading", { name: "La correction d’un autre membre", exact: true }),
  ).toBeVisible();
  await expect(titleField(page)).toHaveValue(correctedTitle);
  expect(state.writes).toHaveLength(0);
  await saveButton(page).click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Une autre personne a modifié ce contenu",
  );
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({ method: "PATCH", version: "7" });
  await expect(titleField(page)).toHaveValue(correctedTitle);
  expect(state.current().revision_version).toBe(8);
  expect(state.current().traductions[0].titre).toBe("La correction d’un autre membre");
  expect(state.publicTitle()).toBe(initialTitle);
});

test("abandonner une correction demande confirmation, garde les erreurs visibles et préserve le contenu public", async ({
  page,
}) => {
  const state = await setup(page, "sermons", { rejectDiscardOnce: true });
  await saveCorrection(page, "sermons");
  await expect.poll(() => state.current().revision_version).toBe(8);
  await titleField(page).fill("Une modification supplémentaire non enregistrée");
  const abandon = page.getByRole("button", { name: "Abandonner la correction", exact: true });
  await abandon.click();
  const modal = page.getByRole("dialog", { name: "Abandonner cette correction ?" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Garder la correction" }).click();
  await expect(modal).not.toBeVisible();
  await expect(titleField(page)).toHaveValue("Une modification supplémentaire non enregistrée");
  expect(state.writes).toHaveLength(1);
  await abandon.click();
  await modal.getByRole("button", { name: "Abandonner et revenir à la liste" }).click();
  await expect(modal.getByRole("alert")).toContainText("La correction n’a pas pu être abandonnée");
  await expect(modal).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/sermons/${slug}$`));
  await modal.getByRole("button", { name: "Abandonner et revenir à la liste" }).click();
  await expect(page).toHaveURL(/\/sermons$/);
  await expect(modal).not.toBeVisible();
  const requests = state.writes.filter((write) => write.path.endsWith("/annuler-revision/"));
  expect(requests).toHaveLength(2);
  expect(requests.map((write) => ({ method: write.method, version: write.version }))).toEqual([
    { method: "POST", version: "8" },
    { method: "POST", version: "8" },
  ]);
  expect(state.current().revision).toBeNull();
  expect(state.current().traductions[0].titre).toBe(initialTitle);
  expect(state.publicTitle()).toBe(initialTitle);
});

test("les erreurs de validation des traductions imbriquées indiquent le champ concerné", async ({
  page,
}) => {
  const state = await setup(page, "sermons", { nestedValidation: true });
  await saveCorrection(page, "sermons");
  const alert = page.getByRole("alert").first();
  await expect(alert).toContainText("Contenu : Élément 1 · Titre : Ce champ est obligatoire.");
  await expect(titleField(page)).toHaveValue(correctedTitle);
  await expect(saveButton(page)).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  expect(state.publicTitle()).toBe(initialTitle);
});
