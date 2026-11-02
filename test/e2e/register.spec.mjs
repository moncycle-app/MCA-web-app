// The sign-up form sends the language it holds. Nothing is created: the request is answered by the test.
import { test, expect } from "./fixtures.mjs";

// the sign-up form with every field filled, up to the captcha answer
async function fill_form(page) {
	await page.goto("/#/register");
	await page.locator("#i_nickname").fill("AB");
	await page.locator('label[for="m_cervical_mucus"]').click();
	await page.locator("#i_login_email").fill("nobody@example.test");
	await page.locator("#i_login_email_conf").fill("nobody@example.test");
	await page.locator("#i_password").fill("Passw0rdPassw0rd");
	await page.locator("#i_password_conf").fill("Passw0rdPassw0rd");
	await page.locator("#i_anaissance").selectOption({ index: 1 });
	await expect(page.locator("#r_captcha")).toBeVisible();
	await page.locator("#i_captcha").fill("abcdef");
	await page.locator("#i_comment").fill("test");
	await page.locator("#i_terms").check();
}

async function catch_registration(page) {
	const seen = { body: null };
	await page.route("**/api/v3/register", async (route) => {
		seen.body = route.request().postDataJSON();
		await route.fulfill({ status: 201, json: { data: { sent: true } } });
	});
	return seen;
}

test.describe("browser in German", () => {
	test.use({ locale: "de-DE" });
	test("English is the default: the select is the first field, offers EN and FR, and a change switches the screen", async ({ page }) => {
		const seen = await catch_registration(page);
		await fill_form(page);
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await expect(page.locator("#i_language")).toHaveValue("EN");
		expect(await page.locator("#i_language option").evaluateAll((options) => options.map((option) => option.value))).toEqual(["EN", "FR"]);
		expect(await page.locator('#i_language option[value="FR"]').textContent()).toBe("Français");
		// the first field of the form, before the nickname
		expect(await page.locator("#f_registration").evaluate((form) => form.querySelector("select, input, textarea").id)).toBe("i_language");
		await expect(page.locator("#f_registration label").first()).toHaveText("Language:");
		await page.locator("#i_language").selectOption("FR");
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
		await expect(page.locator("#f_registration label").first()).toHaveText("Langue:");
		await expect(page).toHaveTitle("moncycle.app - inscription");
		// what was typed is kept, the birth bands are written again in French
		await expect(page.locator("#i_nickname")).toHaveValue("AB");
		await expect(page.locator("#i_anaissance option").nth(1)).toContainText("entre");
		await page.locator("#but_register").click();
		await expect(page.locator("#register_ok")).toBeVisible();
		expect(seen.body.language).toBe("FR");
	});
});

test.describe("browser in French", () => {
	test.use({ locale: "fr-FR" });
	test("the select shows FR and the screen is French", async ({ page }) => {
		const seen = await catch_registration(page);
		await fill_form(page);
		await expect(page.locator("#i_language")).toHaveValue("FR");
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
		await expect(page.locator("#f_registration label").first()).toHaveText("Langue:");
		await page.locator("#but_register").click();
		await expect(page.locator("#register_ok")).toBeVisible();
		expect(seen.body.language).toBe("FR");
	});
});

test.describe("browser in German then French", () => {
	test("the first of the browser's languages that we have", async ({ page }) => {
		await page.addInitScript(() => Object.defineProperty(navigator, "languages", { get: () => ["de-DE", "fr-CA", "en"] }));
		await page.goto("/#/register");
		await expect(page.locator("#i_language")).toHaveValue("FR");
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
	});
});

test.describe("browser in Japanese", () => {
	test.use({ locale: "ja-JP" });
	test("the select shows EN when the browser's language is not one we have", async ({ page }) => {
		const seen = await catch_registration(page);
		await fill_form(page);
		await expect(page.locator("#i_language")).toHaveValue("EN");
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
		await page.locator("#but_register").click();
		await expect(page.locator("#register_ok")).toBeVisible();
		expect(seen.body.language).toBe("EN");
	});
});
