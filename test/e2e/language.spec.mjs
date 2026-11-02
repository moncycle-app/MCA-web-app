// The language of the interface: the browser's (English by default) when nobody is signed in, with a select at the bottom of the screen;
// the account's once signed in, changed in the settings.
import { test, expect, API } from "./fixtures.mjs";

// the language of the account, set through the API
async function set_account_language(account, language) {
	const answer = await account.request.post(API + "/api/v3/account", { data: { language }, headers: { "Content-Type": "application/json", ...account.auth } });
	expect(answer.ok()).toBe(true);
}
async function account_language(account) {
	const answer = await account.request.get(API + "/api/v3/account", { headers: account.auth });
	return (await answer.json()).data.language;
}

test.describe("not signed in", () => {
	test("sign-in: English by default, a select at the bottom changes the language and keeps what was typed", async ({ page }) => {
		await page.goto("/#/auth");
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await expect(page.locator("#connexion_but")).toHaveValue("Sign in 🔑");
		const select = page.locator("#i_language");
		await expect(select).toHaveValue("EN");
		expect(await select.locator("option").evaluateAll((options) => options.map((option) => option.value))).toEqual(["EN", "FR"]);
		// the last thing of the screen
		expect(await page.locator("#app").evaluate((app) => app.lastElementChild.contains(app.querySelector("#i_language")))).toBe(true);

		await page.locator("#i_login_email").fill("someone@example.test");
		await select.selectOption("FR");
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
		await expect(page.locator("#connexion_but")).toHaveValue("Connexion 🔑");
		await expect(page).toHaveTitle("moncycle.app - authentification");
		await expect(page.locator("#i_login_email")).toHaveValue("someone@example.test");
		await expect(page.locator('label[for="i_language"]')).toHaveText("Langue:");

		// the choice is for the visit: the sign-up screen follows it, with its own select on it
		await page.locator('a[href="#/register"]').click();
		await expect(page.locator("#i_language")).toHaveValue("FR");
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
		await page.locator("#i_language").selectOption("EN");
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await expect(page).toHaveTitle("moncycle.app - sign up");
	});

	test.describe("browser in French", () => {
		test.use({ locale: "fr-FR" });
		test("sign-in: the browser's language, which the select shows", async ({ page }) => {
			await page.goto("/#/auth");
			await expect(page.locator("html")).toHaveAttribute("lang", "fr");
			await expect(page.locator("#i_language")).toHaveValue("FR");
			await page.locator("#i_language").selectOption("EN");
			await expect(page.locator("#connexion_but")).toHaveValue("Sign in 🔑");
		});
	});

	test("mail link: the texts the script writes follow the select", async ({ page }) => {
		await page.goto("/#/verify_email?purpose=accountCreation&t=abcdef");
		await expect(page.locator("#et_title")).toHaveText("Confirm your email address");
		await expect(page.locator("#but_et")).toHaveValue("Confirm my address ✅");
		await page.locator("#i_language").selectOption("FR");
		await expect(page.locator("#et_title")).toHaveText("Confirmer votre adresse e-mail");
		await expect(page.locator("#but_et")).toHaveValue("Confirmer mon adresse ✅");
		await expect(page).toHaveTitle("moncycle.app - lien reçu par mail");
	});

	test("mail link that says nothing: the select is there too", async ({ page }) => {
		await page.goto("/#/verify_email");
		await expect(page.locator("#et_invalid")).toBeVisible();
		await page.locator("#i_language").selectOption("FR");
		await expect(page.locator("#et_invalid")).toContainText("lien");
	});
});

test.describe("signed in", () => {
	test("the language of the account is the one used, over the browser's", async ({ page, signed_in, account }) => {
		await set_account_language(account, "FR");
		await signed_in.goto("/#/settings/profil");
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
		await expect(page.locator("#i_language")).toHaveValue("FR");
		await expect(page.locator('label[for="i_language"]')).toHaveText("Langue");
		await page.goto("/");
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
	});

	test("an account in a language we have no catalog for is read in English, and the select says where the account stands", async ({ page, signed_in, account }) => {
		await set_account_language(account, "ES");
		await signed_in.goto("/#/settings/profil");
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await expect(page.locator("#i_language")).toHaveValue("ES");
		expect(await page.locator("#i_language option").evaluateAll((options) => options.map((option) => option.value))).toEqual(["EN", "FR", "ES"]);
		await expect(page.locator('#i_language option[value="ES"]')).toHaveText("Español");
	});

	test("the settings change the language of the account and of the screen", async ({ page, signed_in, account }) => {
		await signed_in.goto("/#/settings/profil");
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await expect(page.locator("#i_language")).toHaveValue("EN");
		const saved = page.waitForResponse((answer) => answer.url().endsWith("/api/v3/account") && answer.request().method() === "POST");
		await page.locator("#i_language").selectOption("FR");
		const answer = await saved;
		expect(answer.ok()).toBe(true);
		expect(answer.request().postDataJSON()).toEqual({ language: "FR" });
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
		await expect(page.locator("#panel_profil")).toBeVisible();   // still on the panel
		await expect(page.locator("#i_language")).toHaveValue("FR");
		await expect(page).toHaveTitle(/réglages/);
		expect(await account_language(account)).toBe("FR");

		// the next visit: French, from the account
		await page.goto("/#/settings/profil");
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
		await page.locator("#i_language").selectOption("EN");
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await expect.poll(() => account_language(account)).toBe("EN");
	});
});

test.describe("signed in, first visit of this browser", () => {
	test.use({ locale: "fr-FR" });
	test("the sign-in page is read in the browser's language, then the account's takes over", async ({ page, account }) => {
		await set_account_language(account, "EN");
		await page.goto("/#/auth");
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
		await page.locator("#i_login_email").fill(account.email);
		await page.locator("#i_password").fill(account.password);
		await page.locator("#connexion_but").click();
		await page.waitForURL((url) => url.hash === "#/");
		// a full load with no copy of the account yet: French for a moment, English once the account is there
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
	});
});
