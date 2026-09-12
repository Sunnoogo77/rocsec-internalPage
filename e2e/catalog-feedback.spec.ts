import { expect, test, type Page, type Route } from "@playwright/test";

const admin = {
  id: "catalog-admin",
  username: "admin.catalogue",
  is_staff: true,
  is_superuser: true,
  role: "editeur",
  has_2fa: true,
  must_change_password: false,
};
const group = {
  id: "group-one",
  nom_fr: "Chorale",
  nom_en: "",
  description_fr: "",
  description_en: "",
  membres: [],
  membres_detail: [],
  actif: true,
};
const series = {
  id: "series-one",
  titre_fr: "Foi et service",
  titre_en: "",
  description_fr: "",
  description_en: "",
  close: false,
};

async function setup(page: Page, write: (route: Route) => Promise<void>) {
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/me/")) return route.fulfill({ json: admin });
    if (route.request().method() !== "GET") return write(route);
    if (path.endsWith("/step-up/"))
      return route.fulfill({ json: { is_recent: true, seconds_remaining: 600 } });
    if (path.endsWith("/roles/")) return route.fulfill({ json: [] });
    if (path.endsWith("/groupes/")) return route.fulfill({ json: { count: 1, results: [group] } });
    if (path.endsWith("/series/")) return route.fulfill({ json: { count: 1, results: [series] } });
    return route.fulfill({ json: { count: 0, results: [] } });
  });
}

test("le refus MFA pendant la modification d’un groupe conserve la saisie et guide vers Mon compte", async ({
  page,
}) => {
  await setup(page, (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: { code: "mfa_required", message: "Une vérification MFA récente est requise." },
      },
    }),
  );
  await page.goto("/personnes");
  await page.getByRole("button", { name: "Gérer les groupes" }).click();
  const modal = page.getByRole("dialog", { name: "Groupes de personnes" });
  await modal.getByRole("button", { name: "Éditer", exact: true }).click();
  await modal.getByLabel("Nom FR", { exact: true }).fill("Chorale du dimanche");
  await modal.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText(
    "Une vérification de votre identité est nécessaire.",
  );
  await expect(modal.getByLabel("Nom FR", { exact: true })).toHaveValue("Chorale du dimanche");
  await modal.getByRole("link", { name: "Vérifier mon identité" }).click();
  await expect(page).toHaveURL(/\/reglages#securite$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("une suppression de série refusée est expliquée près de la série conservée", async ({
  page,
}) => {
  let deletes = 0;
  await setup(page, (route) => {
    if (route.request().method() === "DELETE") deletes++;
    return route.fulfill({
      status: 409,
      json: {
        detail: "Cette série est encore utilisée. Retirez ses associations avant de la supprimer.",
      },
    });
  });
  await page.goto("/sermons/series");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("La série n’a pas été supprimée.");
  await expect(page.getByRole("alert")).toContainText("Cette série est encore utilisée.");
  await expect(page.getByText(series.titre_fr, { exact: true })).toBeVisible();
  expect(deletes).toBe(1);
});

test("la création de rôle montre les erreurs réseau et de validation sans fermer la fenêtre", async ({
  page,
}) => {
  let attempts = 0;
  await setup(page, (route) => {
    attempts++;
    if (attempts === 1) return route.abort("failed");
    return route.fulfill({
      status: 400,
      json: {
        error: {
          code: "validation_error",
          message: "Une ou plusieurs valeurs sont invalides.",
          details: { libelle_fr: ["Ce rôle existe déjà. Choisissez un autre libellé."] },
        },
      },
    });
  });
  await page.goto("/personnes");
  await page.getByRole("button", { name: "Ajouter une personne", exact: true }).click();
  await page.getByRole("button", { name: "+ Nouveau rôle", exact: true }).click();
  const modal = page.locator("dialog").filter({
    has: page.getByRole("heading", { name: "Nouveau rôle", exact: true }),
  });
  await modal.getByRole("textbox", { name: "Libellé (français)", exact: true }).fill("Accueil");
  await modal.getByRole("button", { name: "Créer le rôle", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("Impossible de joindre le service.");
  await expect(modal.getByRole("textbox", { name: "Libellé (français)", exact: true })).toHaveValue("Accueil");
  await modal.getByRole("button", { name: "Créer le rôle", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("Ce rôle existe déjà.");
  await expect(modal).toBeVisible();
  expect(attempts).toBe(2);
});
