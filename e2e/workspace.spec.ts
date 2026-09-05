import { test, expect } from "@playwright/test";
const user = {
  id: "1",
  email: "equipe@example.test",
  first_name: "Marie",
  last_name: "Test",
  is_staff: true,
  is_superuser: false,
  role: "editeur",
  has_2fa: true,
};

test("une route privée demande une connexion et ne propose aucune inscription", async ({
  page,
}) => {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({
      status: route.request().url().includes("/csrf/") ? 200 : 403,
      json: { csrf: "synthetic-csrf" },
    }),
  );
  await page.goto("/comptes");
  await expect(page.getByRole("heading", { name: "Bienvenue" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await expect(page.getByRole("link", { name: /inscription|créer un compte/i })).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/login-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("connexion avec code TOTP et CSRF puis accès aux réglages", async ({ page }) => {
  let loggedIn = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/login/")) {
      expect(route.request().headers()["x-csrftoken"]).toBe("synthetic-csrf");
      const body = route.request().postDataJSON();
      if (!body.otp_token)
        return route.fulfill({ status: 400, json: { requires_otp: true, detail: "Code requis" } });
      expect(body.otp_token).toBe("123456");
      loggedIn = true;
      return route.fulfill({ json: user });
    }
    if (path.endsWith("/me/"))
      return route.fulfill({ status: loggedIn ? 200 : 403, json: loggedIn ? user : {} });
    if (path.endsWith("/step-up/"))
      return route.fulfill({ json: { is_recent: false, seconds_remaining: 0 } });
    return route.fulfill({ json: { count: 0, results: [] } });
  });
  await page.goto("/reglages");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(user.email);
  await page.getByLabel(/^Mot de passe/).fill("Synthetic-password.123!");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByLabel("Code TOTP").fill("123456");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Mon compte", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Désactiver et terminer mes sessions" }),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "Équipe et accès" })).toHaveCount(0);
  await page.screenshot({
    path: `test-results/settings-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("la route comptes ne charge aucune donnée pour un éditeur", async ({ page }) => {
  let accountRequests = 0;
  await page.route("**/api/v1/**", (route) => {
    const url = route.request().url();
    if (url.includes("/users/")) accountRequests++;
    return route.fulfill({
      json: url.includes("/me/") ? user : { csrf: "synthetic", count: 0, results: [] },
    });
  });
  await page.goto("/comptes");
  await expect(
    page.getByText("La gestion des comptes est réservée au superadministrateur."),
  ).toBeVisible();
  expect(accountRequests).toBe(0);
});
