import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "mfa-settings-user",
  username: "equipe.test",
  first_name: "Test",
  last_name: "Équipe",
  is_staff: true,
  is_superuser: true,
  role: "validateur",
  has_2fa: false,
  must_change_password: false,
};
const secret = "JBSWY3DPEHPK3PXP";
const otpUrl = `otpauth://totp/RST%20Admin:equipe.test?secret=${secret}&issuer=RST%20Admin`;

async function mockSettings(page: Page, configured = false) {
  const state = { authenticated: true, recent: configured, verified: 0, meReads: 0, configured };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith("/csrf/")) return route.fulfill({ json: { csrf: "synthetic-csrf" } });
    if (path.endsWith("/me/")) {
      state.meReads++;
      return route.fulfill({
        status: state.authenticated ? 200 : 403,
        json: state.authenticated
          ? {
              ...user,
              has_2fa: state.configured,
              mfa_required: true,
              mfa_setup_required: !state.configured,
            }
          : {},
      });
    }
    if (path.endsWith("/login/")) {
      if (!route.request().postDataJSON().otp_token) {
        return route.fulfill({ status: 400, json: { requires_otp: true, detail: "Code requis." } });
      }
      state.authenticated = true;
      return route.fulfill({
        json: {
          ...user,
          has_2fa: state.configured,
          mfa_required: true,
          mfa_setup_required: !state.configured,
        },
      });
    }
    if (path.endsWith("/enable/"))
      return route.fulfill({ json: { secret_b32: secret, otpauth_url: otpUrl } });
    if (path.endsWith("/verify/")) {
      state.verified++;
      if (route.request().postDataJSON().token !== "123456")
        return route.fulfill({ status: 400, json: { detail: "Code TOTP invalide." } });
      state.authenticated = true;
      state.configured = true;
      state.recent = true;
      return route.fulfill({ json: { status: "ok", has_2fa: true } });
    }
    if (path.endsWith("/step-up/")) {
      if (method === "POST") {
        if (route.request().postDataJSON().token !== "654321")
          return route.fulfill({
            status: 400,
            json: {
              error: {
                code: "validation_error",
                message: "Code TOTP invalide, expiré ou déjà utilisé.",
              },
            },
          });
        state.recent = true;
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({
        json: { is_recent: state.recent, seconds_remaining: state.recent ? 600 : 0 },
      });
    }
    return route.fulfill({ json: { count: 0, results: [] } });
  });
  return state;
}

test("configuration guidée avec QR local et clé manuelle masquée par défaut", async ({ page }) => {
  await mockSettings(page);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { copiedKey?: string }).copiedKey = text;
        },
      },
    });
  });
  await page.goto("/reglages#securite");
  await expect(
    page.getByRole("heading", { name: "Double authentification", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Configurer la double authentification" }).click();
  const qr = page.getByRole("img", { name: "QR code pour configurer la double authentification" });
  await expect(qr).toBeVisible();
  expect(await qr.evaluate((element) => element.tagName.toLowerCase())).toBe("svg");
  await expect(page.locator(".enrollmentSecret")).not.toBeVisible();
  await expect(
    page.getByText("Scannez ce QR code avec l’application.", { exact: true }),
  ).toBeVisible();
  await qr.screenshot({ path: `test-results/mfa-qr-${test.info().project.name}.png` });
  await page.getByText("Je ne peux pas scanner le QR code", { exact: true }).click();
  await expect(page.locator(".enrollmentSecret")).toHaveText(secret);
  await page.getByRole("button", { name: "Copier la clé", exact: true }).click();
  await expect(page.getByText(/Clé copiée/)).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { copiedKey?: string }).copiedKey)).toBe(
    secret,
  );
  expect(requests.every((url) => new URL(url).origin === "http://127.0.0.1:4174")).toBeTruthy();
  expect(requests.some((url) => url.includes(secret) || url.includes("otpauth"))).toBeFalsy();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/mfa-enrolment-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(qr).toHaveCount(0);
  await expect(page.locator(".enrollmentSecret")).toHaveCount(0);
});

test("un code rejeté reste visible puis l’activation vérifie directement la connexion", async ({
  page,
}) => {
  const state = await mockSettings(page, false);
  await page.goto("/reglages");
  await page.getByRole("button", { name: "Configurer la double authentification" }).click();
  await page.getByLabel("Code à six chiffres").fill("111111");
  await page.getByRole("button", { name: "Activer et continuer" }).click();
  await expect(page.getByRole("alert")).toContainText("Le code n’a pas été accepté.");
  await expect(
    page.getByRole("img", { name: "QR code pour configurer la double authentification" }),
  ).toBeVisible();
  await page.getByLabel("Code à six chiffres").fill("123456");
  const meReadsBeforeActivation = state.meReads;
  await page.getByRole("button", { name: "Activer et continuer" }).click();
  await expect(page).toHaveURL(/\/reglages$/);
  await expect(
    page.getByText(/La double authentification est activée. Votre connexion est vérifiée/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter", exact: true })).toHaveCount(0);
  await expect(page.locator(".enrollmentSecret")).toHaveCount(0);
  await expect(page.getByLabel("Code de vérification")).toHaveCount(0);
  expect(state.verified).toBe(2);
  expect(state.meReads).toBeGreaterThan(meReadsBeforeActivation);
});

test("une réponse de configuration tardive ne réaffiche pas le QR après avoir quitté la page", async ({
  page,
}) => {
  await mockSettings(page);
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let enableStarted = false;
  await page.route("**/auth/2fa/enable/", async (route) => {
    enableStarted = true;
    await responseGate;
    await route.fulfill({ json: { secret_b32: secret, otpauth_url: otpUrl } });
  });
  await page.goto("/reglages");
  await page.getByRole("button", { name: "Configurer la double authentification" }).click();
  await expect.poll(() => enableStarted).toBeTruthy();
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
  );
  await expect(
    page.getByRole("button", { name: "Configurer la double authentification" }),
  ).toBeEnabled();
  const response = page.waitForResponse("**/auth/2fa/enable/");
  releaseResponse();
  await (await response).finished();
  // Let the response handler and React's next paint finish before checking absence.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await expect(
    page.getByRole("img", { name: "QR code pour configurer la double authentification" }),
  ).toHaveCount(0);
  await expect(page.locator(".enrollmentSecret")).toHaveCount(0);
  await page.getByRole("button", { name: "Configurer la double authentification" }).click();
  await expect(
    page.getByRole("img", { name: "QR code pour configurer la double authentification" }),
  ).toBeVisible();
});

test("la connexion vérifiée reste valable et la MFA obligatoire ne peut pas être désactivée", async ({
  page,
}) => {
  await page.clock.install();
  await mockSettings(page, true);
  await page.addInitScript(() => history.replaceState({ usr: { returnTo: "/personnes" } }, ""));
  await page.goto("/reglages#securite");
  await expect(page.getByRole("status")).toContainText("Votre identité est vérifiée.");
  await page.clock.fastForward(30 * 60 * 1000);
  await expect(page.getByRole("status")).toContainText("Votre identité est vérifiée.");
  await expect(page.getByLabel("Code de vérification")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Reprendre mon action" })).toHaveAttribute(
    "href",
    "/personnes",
  );
  await expect(
    page.getByRole("button", { name: "Désactiver et terminer mes sessions" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/obligatoire pour votre compte et ne peut pas être désactivée/),
  ).toBeVisible();
});

test("la configuration obligatoire est imposée avant les contenus, après le mot de passe temporaire", async ({
  page,
}) => {
  await mockSettings(page, false);
  await page.goto("/personnes");
  await expect(page).toHaveURL(/\/reglages#securite$/);
  await expect(page.getByText(/Configurez-la ci-dessous pour accéder/)).toBeVisible();
  await page.route("**/auth/me/", (route) =>
    route.fulfill({
      json: { ...user, mfa_required: true, mfa_setup_required: true, must_change_password: true },
    }),
  );
  await page.goto("/personnes");
  await expect(page).toHaveURL(/\/changer-mot-de-passe$/);
  await expect(page.getByRole("heading", { name: "Choisissez votre mot de passe" })).toBeVisible();
});
