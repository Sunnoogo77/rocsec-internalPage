import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "validator-session-test",
  username: "equipe.test",
  first_name: "Marie",
  last_name: "Équipe",
  is_staff: true,
  is_superuser: false,
  role: "validateur",
  has_2fa: false,
  mfa_required: false,
  mfa_setup_required: false,
  must_change_password: false,
};

async function setup(page: Page, errorCode: "authentication_required" | "permission_denied") {
  let authenticated = true;
  let creates = 0;
  let logins = 0;
  let logouts = 0;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    if (path === "/auth/csrf/") return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path === "/auth/me/")
      return route.fulfill({
        status: authenticated ? 200 : 403,
        json: authenticated
          ? user
          : { error: { code: "authentication_required", message: "Session expirée." } },
      });
    if (path === "/auth/login/") {
      logins += 1;
      authenticated = true;
      return route.fulfill({ json: user });
    }
    if (path === "/auth/logout/") {
      logouts += 1;
      authenticated = false;
      return route.fulfill({ json: { status: "ok" } });
    }
    if (path === "/personnes/" && request.method() === "POST") {
      creates += 1;
      if (creates === 1) {
        if (errorCode === "authentication_required") authenticated = false;
        return route.fulfill({
          status: 403,
          json: {
            error: {
              code: errorCode,
              message:
                errorCode === "authentication_required"
                  ? "Session expirée."
                  : "Vous n’avez pas la permission de créer cette personne.",
            },
          },
        });
      }
      return route.fulfill({
        status: 201,
        json: { ...request.postDataJSON(), id: "created-person", roles_detail: [] },
      });
    }
    if (path === "/personnes/roles/") return route.fulfill({ json: [] });
    return route.fulfill({ json: { count: 0, results: [], next: null, previous: null } });
  });
  return { creates: () => creates, logins: () => logins, logouts: () => logouts };
}

async function submitPerson(page: Page) {
  await page.getByRole("button", { name: "Ajouter une personne", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Nouvelle personne" });
  await modal.getByRole("textbox", { name: "Prénom", exact: true }).fill("Paul");
  await modal.getByRole("textbox", { name: "Nom", exact: true }).fill("Exemple");
  await modal.getByRole("button", { name: "Enregistrer", exact: true }).click();
  return modal;
}

test("une session expirée propose une reconnexion puis permet de reprendre le travail", async ({
  page,
}) => {
  const state = await setup(page, "authentication_required");
  await page.goto("/personnes");
  const modal = await submitPerson(page);
  const alert = modal.getByRole("alert");
  await expect(alert).toContainText("Votre session a expiré ou vos accès ont été modifiés");
  await expect(page).toHaveURL(/\/personnes$/);
  await expect(modal.getByRole("textbox", { name: "Prénom", exact: true })).toHaveValue("Paul");
  await alert.getByRole("button", { name: "Se reconnecter", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Se déconnecter", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Nom d’utilisateur", exact: true }).fill(user.username);
  await page.getByLabel(/^Mot de passe/).fill("Synthetic-only-password.123!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/personnes$/);
  await expect(page.getByText("Votre session a expiré", { exact: false })).toHaveCount(0);
  const nextModal = await submitPerson(page);
  await expect(nextModal).not.toBeVisible();
  expect(state.creates()).toBe(2);
  expect(state.logins()).toBe(1);
  expect(state.logouts()).toBe(0);
});

test("un refus de permission403 conserve la session et la saisie sans proposer de reconnexion", async ({
  page,
}) => {
  const state = await setup(page, "permission_denied");
  await page.goto("/personnes");
  const modal = await submitPerson(page);
  const alert = modal.getByRole("alert");
  await expect(alert).toContainText("Vous n’avez pas la permission de créer cette personne");
  await expect(page.getByRole("button", { name: "Se reconnecter", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/personnes$/);
  await expect(modal.getByRole("textbox", { name: "Prénom", exact: true })).toHaveValue("Paul");
  await expect(modal.getByRole("textbox", { name: "Nom", exact: true })).toHaveValue("Exemple");
  await expect(modal.getByRole("button", { name: "Enregistrer", exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Se déconnecter", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ajouter une personne", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nouvelle personne" })).toBeVisible();
  expect(state.creates()).toBe(1);
  expect(state.logins()).toBe(0);
  expect(state.logouts()).toBe(0);
});
