import { expect, test, type Page } from "@playwright/test";
const role = (code: string, name: string) => ({
  id: code,
  code,
  libelle_fr: name,
  libelle_en: name,
  actif: true,
  ordre: 0,
});
const roles = [
  role("predicateur", "Prédicateur"),
  role("pasteur", "Pasteur"),
  role("chantre", "Chantre"),
];
const person = (id: string, prenom: string, nom: string, codes: string[], actif = true) => ({
  id,
  prenom,
  nom,
  libelle: `${prenom} ${nom}`,
  civilite: "Fr.",
  nom_affichage: "",
  roles: codes,
  roles_detail: roles.filter((r) => codes.includes(r.code)),
  role_principal: "autre",
  actif,
  bio_courte_fr: "",
  bio_courte_en: "",
});
const people = [
  person("chorist", "Émilie", "Chorale", ["chantre"]),
  person("pastor", "Samuel", "Berger", ["pasteur"]),
  person("speaker", "Paul", "Martin", ["predicateur"]),
  person("inactive", "Jean", "Retiré", ["predicateur"], false),
  person("unknown", "Anne", "Sans rôle", []),
];
const user = {
  id: "reviewer",
  username: "equipe.marie",
  first_name: "Marie",
  last_name: "Martin",
  is_staff: true,
  is_superuser: false,
  role: "validateur",
  has_2fa: true,
};
const testimony = (slug = "esperance", statut = "recu") => ({
  id: slug,
  slug,
  statut,
  type: "recit",
  source: "soumission_publique",
  date_recue: "2026-09-07T12:00:00Z",
  publie_le: null,
  prenom_contact: "Anne",
  nom_contact: "Martin",
  email_contact: "anne@example.test",
  telephone_contact: "",
  ville_contact: "Paris",
  texte_soumis: "Nous avons retrouvé l’espérance. Merci à toute l’assemblée pour ses prières.",
  traductions: [
    {
      langue: "fr",
      auteur: "Anne M.",
      cite: "",
      quote_text: "",
      eyebrow: "",
      titre: "Un nouveau départ",
      corps: "Merci à toute l’assemblée.",
      paragraphs: [],
      verset_ref: "",
      verset_text: "",
    },
  ],
  has_detail: false,
  accent_rouge: false,
  image_publique: true,
  image: null,
  photos: [],
  cree_par: "other",
  modifie_par: "other",
  motif_rejet: "",
});
const sermon = (slug: string, title: string, statut = "brouillon") => ({
  id: slug,
  slug,
  statut,
  date_culte: "2026-09-06T09:00:00Z",
  cree_le: "2026-09-05T10:00:00Z",
  modifie_le: "2026-09-07T10:00:00Z",
  predicateur: "pastor",
  predicateur_detail: people[1],
  type_culte: "dimanche",
  traductions: [
    { langue: "fr", titre: title, titre_em: "", description_courte: "", youtube_url: "" },
  ],
  passages: [],
  citations: [],
  plan: [],
  serie: null,
  cree_par: "other",
  modifie_par: "other",
  thumbnail_url: "",
  audio_url: "",
});
const paginated = (results: unknown[], count = results.length, next: string | null = null) => ({
  count,
  results,
  next,
  previous: null,
});
async function setup(
  page: Page,
  options: {
    editor?: boolean;
    recent?: boolean;
    own?: boolean;
    published?: boolean;
    longDirectory?: boolean;
  } = {},
) {
  let item = testimony("esperance", options.published ? "publie" : "recu");
  if (options.own) item.cree_par = user.id;
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/me/")
      return route.fulfill({ json: { ...user, role: options.editor ? "editeur" : "validateur" } });
    if (path === "/auth/csrf/") return route.fulfill({ json: { csrf: "synthetic" } });
    if (path === "/auth/2fa/step-up/")
      return route.fulfill({
        json: {
          is_recent: options.recent !== false,
          seconds_remaining: options.recent === false ? 0 : 600,
        },
      });
    if (request.method() !== "GET") {
      const body = request.postData() ? request.postDataJSON() : {};
      writes.push({ path, body });
      if (path === "/temoignages/admin/esperance/")
        item = { ...item, ...body, statut: "recu", modifie_par: user.id };
      if (path.endsWith("/marquer_en_revue/"))
        item = { ...item, statut: "en_revue", modifie_par: user.id };
      if (path.endsWith("/approuver/")) item = { ...item, statut: "publie" };
      if (path.startsWith("/temoignages/")) return route.fulfill({ json: item });
      return route.fulfill({ json: body });
    }
    if (path === "/personnes/roles/") return route.fulfill({ json: roles });
    if (path === "/personnes/") {
      if (options.longDirectory) {
        const first = Array.from({ length: 100 }, (_, i) =>
          person(`c-${i}`, `Chantre ${i}`, "Chorale", ["chantre"]),
        );
        return route.fulfill({
          json:
            url.searchParams.get("page") === "2"
              ? paginated([people[2]], 101)
              : paginated(first, 101, "?page=2"),
        });
      }
      return route.fulfill({ json: paginated(people) });
    }
    if (path === "/personnes/series/" || path === "/personnes/groupes/")
      return route.fulfill({ json: paginated([]) });
    if (path.startsWith("/personnes/"))
      return route.fulfill({ json: people.find((p) => path.includes(p.id)) || people[0] });
    if (path === "/sermons/types/")
      return route.fulfill({
        json: [{ id: "dimanche", code: "dimanche", libelle_fr: "Culte du dimanche", actif: true }],
      });
    if (path === "/cantiques/familles/")
      return route.fulfill({
        json: [{ id: "special", code: "special", libelle_fr: "Cantique spécial", actif: true }],
      });
    if (path === "/temoignages/admin/esperance/") return route.fulfill({ json: item });
    if (path === "/temoignages/admin/") {
      const status = url.searchParams.get("statut") || "recu";
      return route.fulfill({
        json: paginated(status === item.statut ? [item] : [], status === item.statut ? 1 : 0),
      });
    }
    if (path === "/sermons/admin/premier/")
      return route.fulfill({ json: sermon("premier", "Marcher dans la foi") });
    if (path === "/sermons/admin/second/")
      return route.fulfill({ json: sermon("second", "Servir ensemble") });
    if (path === "/sermons/admin/")
      return route.fulfill({
        json: paginated([
          sermon("premier", "Marcher dans la foi"),
          sermon("second", "Servir ensemble", "en_revue"),
        ]),
      });
    if (path.includes("evenements")) return route.fulfill({ json: paginated([]) });
    if (path === "/nehemie/")
      return route.fulfill({
        json: {
          objectif: "10000.00",
          collecte: "1500.00",
          pourcentage: 15,
          mise_a_jour: "2026-09-07",
        },
      });
    if (path === "/nehemie/historique/") return route.fulfill({ json: [] });
    if (path === "/mot-du-pasteur/")
      return route.fulfill({
        json: {
          texte_html_fr: "<p>Bienvenue dans notre assemblée.</p>",
          texte_html_en: "",
          signature_fr: "Le pasteur",
          signature_en: "",
          modifie_le: "2026-09-07",
        },
      });
    return route.fulfill({ json: paginated([]) });
  });
  return writes;
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.querySelector("main")!.scrollWidth <=
          document.querySelector("main")!.clientWidth + 1,
    ),
  ).toBeTruthy();
}

test("tableau de bord, thèmes persistants et navigation mobile", async ({ page }, info) => {
  await setup(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cultes récemment modifiés" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Marcher dans la foi" })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/dashboard-light-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel("Thème de l’interface").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: `test-results/dashboard-dark-${info.project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Thème de l’interface").selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Ouvrir la navigation" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Personnes", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
});

test("le prédicateur appartient aux rôles autorisés, y compris après la première page", async ({
  page,
}) => {
  await setup(page, { longDirectory: true });
  await page.goto("/sermons/nouveau");
  const picker = page.getByRole("combobox", { name: "Prédicateur", exact: true });
  await picker.fill("Paul");
  await expect(page.getByRole("option", { name: /Paul Martin/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Chantre/ })).toHaveCount(0);
  await picker.press("Enter");
  await expect(page.getByRole("button", { name: "Retirer Paul Martin" })).toBeVisible();
  await noOverflow(page);
});

test("personnes : filtres par rôle, activité et fiches non classées", async ({ page }, info) => {
  await setup(page);
  await page.goto("/personnes");
  await page.getByLabel("Rôle", { exact: true }).selectOption("predicateur");
  await expect(page.getByRole("cell", { name: "Paul Martin", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Émilie Chorale", exact: true })).toHaveCount(0);
  await page.getByLabel("Rôle", { exact: true }).selectOption("unclassified");
  await expect(page.getByRole("cell", { name: "Anne Sans rôle", exact: true })).toBeVisible();
  await page.getByLabel("Rôle", { exact: true }).selectOption("");
  await page.getByLabel("Présence dans les sélections").selectOption("inactive");
  await expect(page.getByRole("cell", { name: "Jean Retiré", exact: true })).toBeVisible();
  await page.getByLabel("Présence dans les sélections").selectOption("all");
  await page.getByLabel("Rechercher une personne").fill("emilie");
  await expect(page.getByRole("cell", { name: "Émilie Chorale", exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/personnes-${info.project.name}.png`,
    fullPage: true,
  });
  await noOverflow(page);
});

test("la fiche personne est nommée, retient le focus et valide les champs requis", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/personnes");
  const trigger = page.getByRole("button", { name: "Ajouter une personne" });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "Nouvelle personne" });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  await modal.getByLabel("Prénom").fill("Jean");
  await expect(modal.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  await modal.getByRole("textbox", { name: "Nom", exact: true }).fill("Martin");
  await expect(modal.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    expect(await modal.evaluate((el) => el.contains(document.activeElement))).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("le répertoire en erreur propose de réessayer sans annoncer une liste vide", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/personnes/?**", (route) =>
    route.fulfill({ status: 503, json: { detail: "Unavailable" } }),
  );
  await page.goto("/personnes");
  await expect(page.getByRole("alert")).toContainText("Le chargement a échoué");
  await expect(page.getByRole("button", { name: "Réessayer", exact: true })).toBeVisible();
  await expect(page.getByText("Le répertoire est vide", { exact: false })).toHaveCount(0);
});

test("témoignages : message reçu, états et confirmation de publication", async ({ page }, info) => {
  const writes = await setup(page);
  await page.goto("/temoignages");
  await expect(page.getByText("Nous avons retrouvé l’espérance.", { exact: false })).toBeVisible();
  await page.screenshot({ path: `test-results/inbox-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: /Non retenus/ }).click();
  await expect(page).toHaveURL(/statut=rejete/);
  await expect(page.getByRole("heading", { name: "Aucun témoignage non retenu" })).toBeVisible();
  await page.getByRole("button", { name: /^Reçus/ }).click();
  await page.getByRole("link", { name: "Examiner le témoignage" }).click();
  await expect(page.getByText("Message reçu · original conservé")).toBeVisible();
  await page.getByRole("button", { name: "Approuver et publier" }).click();
  await expect(page.getByRole("dialog", { name: "Publier ce témoignage ?" })).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirmer la publication" }).click();
  await expect(
    page.getByText("Ce témoignage est publié. La fiche est en lecture seule."),
  ).toBeVisible();
  expect(writes.filter((w) => w.path.endsWith("/approuver/"))).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Nom affiché", { exact: true })).toBeDisabled();
});

test("les changements restent locaux avant enregistrement et bloquent la décision", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto("/temoignages/esperance");
  await page.getByRole("switch", { name: "Image et photos visibles sur la vitrine" }).click();
  expect(writes).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Approuver et publier" })).toBeDisabled();
  await expect(page.getByText("Modifications non enregistrées.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Modifications enregistrées.", { exact: true })).toBeVisible();
  expect(writes[0].body.image_publique).toBe(false);
  await expect(page.getByText("Un autre validateur doit relire", { exact: false })).toBeVisible();
});

for (const config of [{ editor: true }, { own: true }, { recent: false }]) {
  test(`la publication respecte les accès ${JSON.stringify(config)}`, async ({ page }) => {
    await setup(page, config);
    await page.goto("/temoignages/esperance");
    await expect(page.getByRole("button", { name: "Approuver et publier" })).toBeDisabled();
    if ("recent" in config)
      await expect(page.getByRole("button", { name: "Vérifier mon identité" })).toBeVisible();
  });
}

test("la navigation entre fiches recharge le bon formulaire", async ({ page }) => {
  await setup(page);
  await page.goto("/sermons/premier");
  await expect(page.getByRole("heading", { name: "Marcher dans la foi" })).toBeVisible();
  await page.getByRole("link", { name: "Cultes", exact: true }).last().click();
  await page.getByRole("link", { name: "Servir ensemble", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Titre", exact: true })).toHaveValue(
    "Servir ensemble",
  );
});

test("les suggestions de prédicateurs excluent les autres rôles et les inactifs", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/sermons/nouveau");
  await page.getByRole("combobox", { name: "Prédicateur", exact: true }).click();
  await expect(page.getByRole("option", { name: /Samuel Berger/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Paul Martin/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Émilie|Jean Retiré|Anne Sans/ })).toHaveCount(0);
});

test("aucune voix principale n’est proposée avant le choix des interprètes", async ({ page }) => {
  await setup(page);
  await page.goto("/cantiques/nouveau");
  await page.getByRole("combobox", { name: /Famille/ }).selectOption("special");
  const lead = page.getByRole("combobox", { name: "Voix principale (facultatif)" });
  await lead.fill("Paul");
  await expect(page.getByText("Sélectionnez d’abord les interprètes du cantique.")).toBeVisible();
  await expect(page.getByRole("option", { name: /Paul Martin/ })).toHaveCount(0);
});

test("navigation sur toutes les pages principales en thème sombre", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await page.addInitScript(() => localStorage.setItem("rst-theme", "dark"));
  for (const [url, title] of [
    ["/sermons", "Cultes"],
    ["/cantiques", "Cantiques"],
    ["/annonces", "Annonces"],
    ["/cette-semaine", "Cette semaine"],
    ["/nehemie", "Projet Néhémie"],
    ["/medias", "Médiathèque"],
    ["/mot-du-pasteur", "Mot du pasteur"],
    ["/annonces/nouvelle", "Nouvelle annonce"],
    ["/cantiques/nouveau", "Nouveau cantique"],
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: title, exact: true }).first()).toBeVisible();
    await expect(page.getByText("Chargement des informations…")).toHaveCount(0);
    await noOverflow(page);
    if (url === "/cantiques/nouveau" || url === "/annonces/nouvelle")
      await page.screenshot({
        path: `test-results/${url.split("/")[1]}-dark-${info.project.name}.png`,
        fullPage: true,
      });
  }
  expect(errors).toEqual([]);
});

test("la pagination des témoignages conserve l’état choisi et l’ordre", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/temoignages/admin/?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const second = params.get("page") === "2";
    return route.fulfill({
      json: paginated(
        [
          {
            ...testimony(second ? "second" : "premier"),
            traductions: [{ langue: "fr", auteur: second ? "Deuxième page" : "Première page" }],
          },
        ],
        26,
        second ? null : "?page=2",
      ),
    });
  });
  await page.goto("/temoignages?statut=en_revue&ordre=recent");
  await page.getByRole("button", { name: "Suivante" }).click();
  await expect(page.getByRole("link", { name: "Deuxième page" })).toBeVisible();
  await expect(page).toHaveURL(/statut=en_revue.*ordre=recent.*page=2/);
  await page.getByRole("button", { name: /^Reçus/ }).click();
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
});
