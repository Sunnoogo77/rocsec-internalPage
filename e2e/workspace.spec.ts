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
  must_change_password: false,
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

test("le mot de passe peut être affiché puis masqué sans envoyer le formulaire", async ({
  page,
}) => {
  let loginRequests = 0;
  const password = " Synthetic-password.123! ";
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/login/")) {
      loginRequests++;
      expect(route.request().postDataJSON().password).toBe(password);
      return route.fulfill({ status: 403, json: { detail: "Identifiants de test" } });
    }
    return route.fulfill({ status: 403, json: {} });
  });
  await page.goto("/login");
  await page.getByLabel("Nom d’utilisateur").fill(user.username);
  const field = page.getByLabel(/^Mot de passe/);
  await field.fill(password);
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Afficher le mot de passe", exact: true }).click();
  await expect(field).toHaveAttribute("type", "text");
  await expect(field).toHaveValue(password);
  const hide = page.getByRole("button", { name: "Masquer le mot de passe", exact: true });
  await hide.focus();
  await hide.press("Space");
  await expect(field).toHaveAttribute("type", "password");
  await expect(field).toHaveValue(password);
  await expect(
    page.getByRole("button", { name: "Afficher le mot de passe", exact: true }),
  ).toBeFocused();
  expect(loginRequests).toBe(0);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Identifiants de test");
  expect(loginRequests).toBe(1);
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

test("la connexion occupe l’écran et les portraits alternent seuls toutes les trente secondes", async ({
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
  await expect(page.getByLabel("Nom d’utilisateur")).not.toHaveAttribute("placeholder");
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/logo-rst-white.svg");
  await expect(page.getByRole("img", { name: "Logo Roc Séculaire Tabernacle" })).toBeVisible();
  await expect(jesus).toHaveAttribute("src", "/images/jesus-login.png");
  const portraits = page.getByRole("region", { name: "Portraits de l’assemblée" });
  await expect(portraits.locator("button, a, p, span")).toHaveCount(0);
  expect(await portraits.innerText()).toBe("");
  if (test.info().project.name === "desktop") {
    const bounds = await portraits.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds).toEqual({ x: 0, y: 0, width: viewport.width / 2, height: viewport.height });
    const logo = await page
      .getByRole("img", { name: "Logo Roc Séculaire Tabernacle" })
      .boundingBox();
    expect(logo!.x + logo!.width / 2).toBeCloseTo(viewport.width * 0.75, 0);
  }
  await page.clock.fastForward(30_000);
  await expect(branham).toBeVisible();
  await expect(jesus).toHaveCount(0);
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
  await expect(page.getByRole("button", { name: "Afficher l’autre portrait" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "William Marrion Branham" })).toHaveCount(0);
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
          ? [
              {
                id: "2",
                username: "soeur.marie",
                is_active: true,
                role: "editeur",
                must_change_password: true,
              },
            ]
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
  await expect(
    page.getByText(/elle devra choisir son propre mot de passe à sa première connexion/),
  ).toBeVisible();
  await expect(page.getByText(/Mot de passe à renouveler/)).toBeVisible();
});

test("un mot de passe temporaire bloque les liens directs vers tous les espaces privés", async ({
  page,
}) => {
  let contentRequests = 0;
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/me/"))
      return route.fulfill({ json: { ...user, must_change_password: true, has_2fa: false } });
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    contentRequests++;
    return route.fulfill({ status: 403, json: { code: "password_change_required" } });
  });
  for (const path of ["/comptes", "/reglages", "/sermons"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/changer-mot-de-passe$/);
    await expect(
      page.getByRole("heading", { name: "Choisissez votre mot de passe" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
  }
  expect(contentRequests).toBe(0);
  await page.screenshot({
    path: `test-results/password-first-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("la première connexion impose un mot de passe personnel puis une nouvelle connexion", async ({
  page,
}) => {
  let loggedIn = false;
  let mustChange = true;
  let passwordWrites = 0;
  const temporary = "Temporary-test.7363!";
  const personal = "Personal-test.6281!";
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    const me = { ...user, has_2fa: false, must_change_password: mustChange };
    if (path.endsWith("/me/"))
      return route.fulfill({ status: loggedIn ? 200 : 403, json: loggedIn ? me : {} });
    if (path.endsWith("/login/")) {
      expect(route.request().postDataJSON().password).toBe(mustChange ? temporary : personal);
      loggedIn = true;
      return route.fulfill({ json: me });
    }
    if (path.endsWith("/password/")) {
      expect(route.request().headers()["x-csrftoken"]).toBe("synthetic-csrf");
      expect(route.request().postDataJSON()).toEqual({
        current_password: temporary,
        new_password: personal,
      });
      passwordWrites++;
      mustChange = false;
      loggedIn = false;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: { is_recent: false, count: 0, results: [] } });
  });
  await page.goto("/reglages");
  await page.getByLabel("Nom d’utilisateur").fill(user.username);
  await page.getByLabel(/^Mot de passe/).fill(temporary);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/changer-mot-de-passe$/);
  await page.getByLabel("Mot de passe temporaire").fill(temporary);
  await page.getByLabel(/^Nouveau mot de passe/).fill(personal);
  await page.getByLabel("Confirmer le nouveau mot de passe").fill("Different-password.6736!");
  await page.getByRole("button", { name: "Enregistrer et me reconnecter" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Les deux nouveaux mots de passe ne correspondent pas.",
  );
  expect(passwordWrites).toBe(0);
  await page.getByLabel("Confirmer le nouveau mot de passe").fill(personal);
  await page.getByRole("button", { name: "Enregistrer et me reconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toContainText("Votre mot de passe a été modifié");
  expect(passwordWrites).toBe(1);
  await page.getByLabel("Nom d’utilisateur").fill(user.username);
  await page.getByLabel(/^Mot de passe/).fill(personal);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Mon compte", exact: true })).toBeVisible();
});

test("un compte avec MFA vérifie un nouveau code avant de remplacer son mot de passe temporaire", async ({
  page,
}) => {
  let recent = false;
  const writes: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/me/"))
      return route.fulfill({ json: { ...user, must_change_password: true } });
    if (path.endsWith("/step-up/")) {
      if (route.request().method() === "POST") {
        expect(route.request().postDataJSON()).toEqual({ token: "654321" });
        expect(route.request().headers()["x-csrftoken"]).toBe("synthetic-csrf");
        recent = true;
        writes.push("step-up");
      }
      return route.fulfill({ json: { is_recent: recent } });
    }
    if (path.endsWith("/password/")) {
      expect(recent).toBe(true);
      writes.push("password");
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 403, json: {} });
  });
  await page.goto("/changer-mot-de-passe");
  await page.getByLabel("Mot de passe temporaire").fill("Temporary-test.7363!");
  await page.getByLabel(/^Nouveau mot de passe/).fill("Personal-test.6281!");
  await page.getByLabel("Confirmer le nouveau mot de passe").fill("Personal-test.6281!");
  await expect(page.getByText(/prochain code de votre application/)).toBeVisible();
  await page.getByLabel("Code de vérification").fill("654321");
  await page.getByRole("button", { name: "Enregistrer et me reconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(writes).toEqual(["step-up", "password"]);
});
