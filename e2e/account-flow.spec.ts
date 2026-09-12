import { expect, test, type Page, type Route } from "@playwright/test";

const admin = {
  id: "admin-synthetic",
  username: "admin.test",
  first_name: "Admin",
  last_name: "Test",
  is_staff: true,
  is_superuser: true,
  role: "editeur",
  has_2fa: true,
  must_change_password: false,
};
const account = {
  id: "new-synthetic",
  username: "equipe.paul",
  role: "editeur",
  is_active: true,
  must_change_password: true,
};
const initialPassword = " Temporary-test.7358! ";

async function setup(
  page: Page,
  onWrite: (route: Route) => Promise<void>,
  options: { recent?: boolean; has2fa?: boolean } = {},
) {
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/me/"))
      return route.fulfill({ json: { ...admin, has_2fa: options.has2fa ?? true } });
    if (route.request().method() !== "GET") return onWrite(route);
    if (path.endsWith("/step-up/"))
      return route.fulfill({
        json: {
          is_recent: options.recent ?? true,
          seconds_remaining: options.recent === false ? 0 : 600,
        },
      });
    if (path.endsWith("/roles/")) return route.fulfill({ json: [] });
    return route.fulfill({ json: { count: 0, next: null, results: [] } });
  });
}

async function fillAccount(page: Page) {
  await page
    .getByRole("textbox", { name: "Nom d’utilisateur", exact: true })
    .fill(account.username);
  await page.getByLabel("Mot de passe initial").fill(initialPassword);
}

test("une création refusée par la double authentification affiche une action près du formulaire", async ({
  page,
}) => {
  let writes = 0;
  await setup(
    page,
    async (route) => {
      writes++;
      await route.fulfill({
        status: 403,
        json: {
          error: {
            code: "mfa_required",
            message: "Une vérification MFA récente est requise.",
            details: {},
          },
        },
      });
    },
    { recent: false, has2fa: false },
  );
  await page.goto("/comptes");
  await fillAccount(page);
  await page.getByRole("button", { name: "Créer le compte", exact: true }).click();
  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toContainText("Une vérification de votre identité est nécessaire");
  await expect(alert.getByRole("link", { name: "Vérifier mon identité" })).toHaveAttribute(
    "href",
    "/reglages#securite",
  );
  await expect(page.getByRole("textbox", { name: "Nom d’utilisateur", exact: true })).toHaveValue(
    account.username,
  );
  await expect(page.getByLabel("Mot de passe initial")).toHaveValue(initialPassword);
  await expect(page.getByRole("dialog", { name: "Compte créé" })).toHaveCount(0);
  expect(writes).toBe(1);
  await alert.getByRole("link", { name: "Vérifier mon identité" }).click();
  await expect(page).toHaveURL(/\/reglages#securite$/);
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(initialPassword);
  await page.goBack();
  await expect(page.getByLabel("Mot de passe initial")).toHaveValue("");
});

test("les erreurs de validation du compte restent visibles et permettent une correction", async ({
  page,
}) => {
  await setup(page, (route) =>
    route.fulfill({
      status: 400,
      json: {
        error: {
          code: "validation_error",
          message: "Données invalides.",
          details: { username: ["Ce nom d’utilisateur existe déjà."] },
        },
      },
    }),
  );
  await page.goto("/comptes");
  await fillAccount(page);
  await page.getByRole("button", { name: "Créer le compte", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Nom d’utilisateur : Ce nom d’utilisateur existe déjà.",
  );
  await expect(page.getByRole("button", { name: "Créer le compte", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Mot de passe initial")).toHaveValue(initialPassword);
});

test("le récapitulatif n’apparaît qu’après succès et copie les accès sans conserver le mot de passe", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { lastCopied: string }).lastCopied = text;
        },
      },
    });
  });
  let writes = 0;
  let release: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await setup(page, async (route) => {
    writes++;
    expect(route.request().postDataJSON()).toEqual({
      username: account.username,
      password: initialPassword,
      role: "editeur",
      mfa_required: false,
    });
    await responseGate;
    await route.fulfill({ status: 201, json: account });
  });
  await page.goto("/comptes");
  await fillAccount(page);
  await page.getByRole("button", { name: "Créer le compte", exact: true }).click();
  await expect(page.getByRole("button", { name: "Création…", exact: true })).toBeDisabled();
  await expect(page.getByRole("dialog", { name: "Compte créé" })).toHaveCount(0);
  release!();
  const receipt = page.getByRole("dialog", { name: "Compte créé", exact: true });
  await expect(receipt).toBeVisible();
  expect(writes).toBe(1);
  await expect(page.getByLabel("Mot de passe initial")).toHaveValue("");
  const receiptPassword = receipt.getByLabel("Mot de passe provisoire à transmettre");
  await expect(receiptPassword).toHaveAttribute("type", "password");
  await expect(receiptPassword).toHaveValue(initialPassword);
  await receipt.getByRole("button", { name: "Afficher le mot de passe", exact: true }).click();
  await expect(receiptPassword).toHaveAttribute("type", "text");
  await receipt.getByRole("button", { name: "Copier l’identifiant", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { lastCopied: string }).lastCopied)).toBe(
    account.username,
  );
  await receipt.getByRole("button", { name: "Copier le mot de passe", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { lastCopied: string }).lastCopied)).toBe(
    initialPassword,
  );
  await receipt.getByRole("button", { name: "Copier le message complet", exact: true }).click();
  const copied = await page.evaluate(
    () => (window as unknown as { lastCopied: string }).lastCopied,
  );
  expect(copied).toContain(`Nom d’utilisateur : ${account.username}`);
  expect(copied).toContain(`Mot de passe provisoire : ${initialPassword}`);
  expect(copied).toContain("http://127.0.0.1:4174/login");
  expect(copied).toContain("À votre première connexion");
  const storage = await page.evaluate(
    () =>
      `${JSON.stringify(localStorage)} ${JSON.stringify(sessionStorage)} ${JSON.stringify(history.state)}`,
  );
  expect(storage).not.toContain(initialPassword);
  await page.screenshot({
    path: `test-results/account-receipt-${test.info().project.name}.png`,
    fullPage: true,
  });
  await receipt.getByRole("button", { name: "Terminer", exact: true }).click();
  await expect(receipt).toHaveCount(0);
  expect(
    await page.locator("input").evaluateAll((inputs) => inputs.map((input) => input.value)),
  ).not.toContain(initialPassword);
});

test("le récapitulatif s’efface automatiquement après cinq minutes", async ({ page }) => {
  await page.clock.install();
  await setup(page, (route) => route.fulfill({ status: 201, json: account }));
  await page.goto("/comptes");
  await fillAccount(page);
  await page.getByRole("button", { name: "Créer le compte", exact: true }).click();
  const receipt = page.getByRole("dialog", { name: "Compte créé", exact: true });
  await expect(receipt).toBeVisible();
  await page.clock.fastForward(5 * 60 * 1000);
  await expect(receipt).toHaveCount(0);
  await expect(page.getByLabel("Mot de passe initial")).toHaveValue("");
});

test("une personne peut être préparée avant la vérification et le bouton pour la résoudre reste visible", async ({
  page,
}) => {
  let writes = 0;
  await setup(
    page,
    async (route) => {
      writes++;
      await route.fulfill({ status: 403, json: {} });
    },
    { recent: false, has2fa: false },
  );
  await page.goto("/personnes");
  await page.getByRole("button", { name: "Ajouter une personne", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Nouvelle personne" });
  await modal.getByRole("textbox", { name: "Prénom", exact: true }).fill("Paul");
  await modal.getByRole("textbox", { name: "Nom", exact: true }).fill("Exemple");
  await expect(modal.getByRole("button", { name: "Enregistrer", exact: true })).toBeDisabled();
  await expect(modal.locator('a[href="/reglages#securite"]')).toBeVisible();
  expect(writes).toBe(0);
});

test("le superadministrateur ayant le rôle éditeur peut créer une personne et voit le succès", async ({
  page,
}) => {
  let person: Record<string, unknown> | undefined;
  await setup(page, async (route) => {
    person = {
      ...route.request().postDataJSON(),
      id: "new-person",
      roles_detail: [],
      libelle: "Paul Exemple",
    };
    await route.fulfill({ status: 201, json: person });
  });
  await page.goto("/personnes");
  await page.getByRole("button", { name: "Ajouter une personne", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Nouvelle personne" });
  await modal.getByRole("textbox", { name: "Prénom", exact: true }).fill("Paul");
  await modal.getByRole("textbox", { name: "Nom", exact: true }).fill("Exemple");
  await modal.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("La personne a été ajoutée au répertoire.");
  expect(person?.prenom).toBe("Paul");
});

test("une vérification expirée pendant l’ajout d’une personne laisse la fiche et l’action de résolution visibles", async ({
  page,
}) => {
  await setup(page, (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: {
          code: "mfa_required",
          message: "Une vérification MFA récente est requise.",
          details: {},
        },
      },
    }),
  );
  await page.goto("/personnes");
  await page.getByRole("button", { name: "Ajouter une personne", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Nouvelle personne" });
  await modal.getByRole("textbox", { name: "Prénom", exact: true }).fill("Paul");
  await modal.getByRole("textbox", { name: "Nom", exact: true }).fill("Exemple");
  await modal.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText(
    "Une vérification de votre identité est nécessaire",
  );
  await expect(modal.getByRole("link", { name: "Vérifier mon identité" })).toBeVisible();
  await expect(modal.getByRole("textbox", { name: "Prénom", exact: true })).toHaveValue("Paul");
  await expect(modal.getByRole("textbox", { name: "Nom", exact: true })).toHaveValue("Exemple");
});

test("les identifiants s’effacent en quittant la page, y compris avant une restauration du navigateur", async ({
  page,
}) => {
  await setup(page, (route) => route.fulfill({ status: 201, json: account }));
  await page.goto("/comptes");
  await fillAccount(page);
  await page.getByRole("button", { name: "Créer le compte", exact: true }).click();
  const receipt = page.getByRole("dialog", { name: "Compte créé", exact: true });
  await expect(receipt).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
  );
  await expect(receipt).toHaveCount(0);
  await expect(page.getByLabel("Mot de passe initial")).toHaveValue("");
});

for (const failure of ["network", "server"] as const) {
  test(`une réponse de création ${failure === "network" ? "perdue" : "en erreur serveur"} actualise la liste sans recréer le compte`, async ({
    page,
  }) => {
    let created = false;
    let writes = 0;
    let refreshedAfterFailure = false;
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
      if (path.endsWith("/me/")) return route.fulfill({ json: admin });
      if (path.endsWith("/step-up/"))
        return route.fulfill({ json: { is_recent: true, seconds_remaining: 600 } });
      if (path.endsWith("/users/")) {
        if (route.request().method() === "POST") {
          writes++;
          created = true;
          if (failure === "network") return route.abort("failed");
          return route.fulfill({ status: 502, json: {} });
        }
        if (created) refreshedAfterFailure = true;
        return route.fulfill({
          json: { count: created ? 1 : 0, results: created ? [account] : [] },
        });
      }
      return route.fulfill({ json: { count: 0, results: [] } });
    });
    await page.goto("/comptes");
    await fillAccount(page);
    await page.getByRole("button", { name: "Créer le compte", exact: true }).click();
    const alert = page.locator("form").getByRole("alert");
    await expect(alert).toContainText("Impossible de confirmer la création du compte");
    await expect(alert).toContainText("Vérifiez la liste des comptes avant de réessayer.");
    await expect(page.getByText(account.username, { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Compte créé" })).toHaveCount(0);
    await expect(page.getByLabel("Mot de passe initial")).toHaveValue(initialPassword);
    expect(refreshedAfterFailure).toBe(true);
    expect(writes).toBe(1);
  });
}

test("une suppression de personne en cours garde la fenêtre ouverte et affiche un éventuel refus", async ({
  page,
}) => {
  const person = {
    id: "person-synthetic",
    civilite: "Fr.",
    prenom: "Paul",
    nom: "Exemple",
    nom_affichage: "",
    libelle: "Paul Exemple",
    roles: [],
    roles_detail: [],
    actif: true,
    bio_courte_fr: "",
    bio_courte_en: "",
  };
  let writes = 0;
  let release: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/me/")) return route.fulfill({ json: admin });
    if (path.endsWith("/step-up/"))
      return route.fulfill({ json: { is_recent: true, seconds_remaining: 600 } });
    if (route.request().method() === "DELETE") {
      writes++;
      await responseGate;
      return route.fulfill({
        status: 409,
        json: {
          error: {
            code: "protected_resource",
            message: "Cette personne est associée à une prédication et ne peut pas être supprimée.",
            details: {},
          },
        },
      });
    }
    if (path.endsWith("/roles/")) return route.fulfill({ json: [] });
    return route.fulfill({ json: { count: 1, results: [person], next: null } });
  });
  await page.goto("/personnes");
  await page.getByRole("button", { name: /Supprimer .*Paul Exemple/ }).click();
  const modal = page.getByRole("dialog", { name: "Supprimer cette personne ?", exact: true });
  await modal.getByRole("button", { name: "Supprimer définitivement", exact: true }).click();
  await expect(modal.getByRole("button", { name: "Suppression…", exact: true })).toBeDisabled();
  await expect(modal.getByRole("button", { name: "Annuler", exact: true })).toBeDisabled();
  await modal.getByRole("button", { name: "Fermer la fenêtre", exact: true }).click();
  await expect(modal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();
  release!();
  await expect(modal.getByRole("alert")).toContainText(
    "Cette personne est associée à une prédication et ne peut pas être supprimée.",
  );
  await expect(modal.getByText("Paul Exemple", { exact: true })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Annuler", exact: true })).toBeEnabled();
  expect(writes).toBe(1);
  await modal.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Paul Exemple" })).toBeVisible();
});

test("le superadministrateur voit l’activité et modifie les accès d’un autre compte sans modifier les siens", async ({
  page,
}) => {
  let managed = {
    ...account,
    is_superuser: false,
    mfa_required: false,
    mfa_setup_required: false,
    has_2fa: false,
    last_login: "2026-09-12T12:34:00Z",
    last_activity_at: "2026-09-12T13:45:00Z",
    last_activity_action: "account_created",
    last_activity_target: "synthetic-account",
  };
  let patch: Record<string, unknown> | undefined;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/me/"))
      return route.fulfill({ json: { ...admin, mfa_required: true, mfa_setup_required: false } });
    if (path.endsWith("/step-up/"))
      return route.fulfill({ json: { is_recent: true, seconds_remaining: 7200 } });
    if (route.request().method() === "PATCH") {
      patch = route.request().postDataJSON();
      managed = { ...managed, ...patch };
      return route.fulfill({ json: managed });
    }
    return route.fulfill({
      json: {
        count: 2,
        results: [{ ...admin, is_active: true, mfa_required: true, last_login: null }, managed],
      },
    });
  });
  await page.goto("/comptes");
  await expect(page.getByText(/Dernière connexion :.*2026/)).toBeVisible();
  await expect(page.getByText(/Dernière action : Création d’un compte/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Modifier les accès", exact: true })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Modifier les accès", exact: true }).click();
  const modal = page.getByRole("dialog", { name: `Modifier l’accès de ${account.username}` });
  await modal.getByLabel("Niveau d’accès").selectOption("validateur");
  await modal.getByRole("switch", { name: "Exiger la double authentification" }).click();
  await modal.getByRole("switch", { name: "Compte actif" }).click();
  await modal.getByRole("button", { name: "Enregistrer les accès" }).click();
  await expect(modal).not.toBeVisible();
  expect(patch).toEqual({ role: "validateur", is_active: false, mfa_required: true });
  await expect(page.getByRole("status")).toContainText(
    `Les accès de ${account.username} ont été enregistrés.`,
  );
});

test("la réinitialisation d’un mot de passe produit un récapitulatif uniquement après confirmation", async ({
  page,
}) => {
  const managed = { ...account, is_superuser: false, mfa_required: false, has_2fa: false };
  let writes = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/me/")) return route.fulfill({ json: admin });
    if (path.endsWith("/step-up/")) return route.fulfill({ json: { is_recent: true } });
    if (route.request().method() === "PATCH") {
      writes++;
      expect(route.request().postDataJSON().password).toBe(initialPassword);
      if (writes === 1)
        return route.fulfill({
          status: 400,
          json: {
            error: {
              code: "validation_error",
              message: "Modifiez le mot de passe provisoire.",
              details: {},
            },
          },
        });
      return route.fulfill({ json: managed });
    }
    return route.fulfill({ json: { count: 1, results: [managed] } });
  });
  await page.goto("/comptes");
  await page.getByRole("button", { name: "Modifier les accès", exact: true }).click();
  const modal = page.getByRole("dialog", { name: `Modifier l’accès de ${account.username}` });
  await modal.getByLabel("Nouveau mot de passe provisoire (facultatif)").fill(initialPassword);
  await modal.getByRole("button", { name: "Enregistrer les accès" }).click();
  await expect(modal.getByRole("alert")).toContainText("Modifiez le mot de passe provisoire.");
  await expect(modal.getByLabel("Nouveau mot de passe provisoire (facultatif)")).toHaveValue(
    initialPassword,
  );
  await modal.getByRole("button", { name: "Enregistrer les accès" }).click();
  const receipt = page.getByRole("dialog", {
    name: "Mot de passe provisoire renouvelé",
    exact: true,
  });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByLabel("Mot de passe provisoire à transmettre")).toHaveValue(
    initialPassword,
  );
  expect(
    await page.evaluate(
      () =>
        `${JSON.stringify(localStorage)} ${JSON.stringify(sessionStorage)} ${JSON.stringify(history.state)}`,
    ),
  ).not.toContain(initialPassword);
  await receipt.getByRole("button", { name: "Terminer", exact: true }).click();
  await expect(receipt).toHaveCount(0);
});
