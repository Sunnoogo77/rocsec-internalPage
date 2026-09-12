import { test, expect } from "@playwright/test";
const user = {
  id: "1",
  username: "equipe.marie",
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
      expect(body.username).toBe(user.username);
      expect(body).not.toHaveProperty("email");
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
  await page.getByRole("textbox", { name: "Nom d’utilisateur", exact: true }).fill(user.username);
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

test("les portraits alternent après trente secondes et peuvent être mis en pause", async ({
  page,
}) => {
  await page.clock.install();
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 403, json: {} }));
  await page.goto("/login");
  const jesus = page.getByRole("img", { name: "Jésus-Christ" });
  const branham = page.getByRole("img", { name: "William Marrion Branham" });
  await expect(jesus).toBeVisible();
  await expect(branham).toHaveCount(0);
  await expect(page.getByLabel("Nom d’utilisateur")).toHaveAttribute("autocomplete", "username");
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/logo-rst.png");
  await expect(page.getByRole("img", { name: "Logo Roc Séculaire Tabernacle" })).toBeVisible();
  await page.clock.fastForward(30_000);
  await expect(branham).toBeVisible();
  await expect(jesus).toHaveCount(0);
  await page.getByRole("button", { name: "Mettre le défilement en pause" }).click();
  await page.clock.fastForward(60_000);
  await expect(branham).toBeVisible();
  await page.getByRole("button", { name: "Reprendre le défilement" }).click();
  await page.clock.fastForward(30_000);
  await expect(jesus).toBeVisible();
});

test("la connexion respecte le thème sombre et la réduction des animations", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("rst-theme", "system"));
  await page.clock.install();
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 403, json: {} }));
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.clock.fastForward(60_000);
  await expect(page.getByRole("img", { name: "Jésus-Christ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mettre le défilement en pause" })).toHaveCount(0);
  await page.getByRole("button", { name: "Afficher l’autre portrait" }).click();
  await expect(page.getByRole("img", { name: "William Marrion Branham" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/login-dark-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("un administrateur crée un compte avec un nom d’utilisateur sans email", async ({ page }) => {
  let created = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/me/")) return route.fulfill({ json: { ...user, is_superuser: true } });
    if (path.endsWith("/users/") && route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({
        username: "soeur.marie",
        password: "Synthetic-only-test.7392!",
        role: "editeur",
      });
      expect(route.request().headers()["x-csrftoken"]).toBe("synthetic-csrf");
      created = true;
      return route.fulfill({ status: 201, json: { id: "2", username: "soeur.marie" } });
    }
    return route.fulfill({
      json: {
        count: created ? 1 : 0,
        results: created
          ? [{ id: "2", username: "soeur.marie", is_active: true, role: "editeur" }]
          : [],
      },
    });
  });
  await page.goto("/comptes");
  await page.getByLabel("Nom d’utilisateur").fill("soeur.marie");
  await page.getByLabel("Mot de passe initial").fill("Synthetic-only-test.7392!");
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByText("soeur.marie", { exact: true })).toBeVisible();
});
