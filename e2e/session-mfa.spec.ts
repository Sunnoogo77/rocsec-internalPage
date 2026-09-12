import { expect, test } from "@playwright/test";

const user = {
  id: "validator-test",
  username: "equipe.test",
  first_name: "Test",
  last_name: "Équipe",
  is_staff: true,
  is_superuser: false,
  role: "validateur",
  has_2fa: true,
  mfa_required: true,
  mfa_setup_required: false,
  must_change_password: false,
};

test("un seul code à la connexion permet plusieurs actions même après trente minutes", async ({
  page,
}) => {
  await page.clock.install();
  let authenticated = false;
  let otpLogins = 0;
  let stepPosts = 0;
  let personCreates = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/me/"))
      return route.fulfill({ status: authenticated ? 200 : 403, json: authenticated ? user : {} });
    if (path.endsWith("/login/")) {
      if (!route.request().postDataJSON().otp_token)
        return route.fulfill({ status: 400, json: { requires_otp: true, detail: "Code requis." } });
      otpLogins++;
      authenticated = true;
      return route.fulfill({ json: user });
    }
    if (path.endsWith("/step-up/")) {
      if (route.request().method() === "POST") stepPosts++;
      return route.fulfill({ json: { is_recent: true, seconds_remaining: 600 } });
    }
    if (path.endsWith("/personnes/") && route.request().method() === "POST") {
      personCreates++;
      return route.fulfill({
        status: 201,
        json: {
          ...route.request().postDataJSON(),
          id: `person-${personCreates}`,
          roles_detail: [],
        },
      });
    }
    if (path.endsWith("/roles/")) return route.fulfill({ json: [] });
    return route.fulfill({ json: { count: 0, results: [], next: null } });
  });
  await page.goto("/personnes");
  await page.getByRole("textbox", { name: "Nom d’utilisateur", exact: true }).fill(user.username);
  await page.getByLabel(/^Mot de passe/).fill("Synthetic-password.123!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.getByRole("textbox", { name: "Code de vérification", exact: true }).fill("123456");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/personnes$/);
  for (const name of ["Paul", "Marie"]) {
    await page.getByRole("button", { name: "Ajouter une personne", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Nouvelle personne" });
    await modal.getByRole("textbox", { name: "Prénom", exact: true }).fill(name);
    await modal.getByRole("textbox", { name: "Nom", exact: true }).fill("Exemple");
    await modal.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(modal).not.toBeVisible();
    await page.clock.fastForward(30 * 60 * 1000);
  }
  expect(personCreates).toBe(2);
  expect(otpLogins).toBe(1);
  expect(stepPosts).toBe(0);
});

test("un validateur sans exigence MFA peut gérer les personnes sans configurer une application", async ({
  page,
}) => {
  let verificationRequests = 0;
  let writes = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/me/"))
      return route.fulfill({ json: { ...user, has_2fa: false, mfa_required: false } });
    if (path.endsWith("/step-up/")) verificationRequests++;
    if (path.endsWith("/personnes/") && route.request().method() === "POST") {
      writes++;
      return route.fulfill({
        status: 201,
        json: { ...route.request().postDataJSON(), id: "person-test" },
      });
    }
    if (path.endsWith("/roles/")) return route.fulfill({ json: [] });
    return route.fulfill({ json: { count: 0, results: [], next: null } });
  });
  await page.goto("/personnes");
  await page.getByRole("button", { name: "Ajouter une personne", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Nouvelle personne" });
  await modal.getByRole("textbox", { name: "Prénom", exact: true }).fill("Paul");
  await modal.getByRole("textbox", { name: "Nom", exact: true }).fill("Exemple");
  await expect(modal.getByText("Configurer la double authentification")).toHaveCount(0);
  await modal.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(modal).not.toBeVisible();
  expect(verificationRequests).toBe(0);
  expect(writes).toBe(1);
});
