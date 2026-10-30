// The sign-up form sends the language it holds. Nothing is created: the request is answered by the test.
import { test, expect } from "./fixtures.mjs";

// the sign-up form with every field filled, up to the captcha answer
async function fill_form(page) {
	await page.goto("/register");
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
	await page.route("**/api/v2/register", async (route) => {
		seen.body = route.request().postDataJSON();
		await route.fulfill({ status: 201, json: { data: { sent: true } } });
	});
	return seen;
}

test.describe("browser in German", () => {
	test.use({ locale: "de-DE" });
	test("the select shows the browser's language, and a change switches the catalog", async ({ page }) => {
		const seen = await catch_registration(page);
		await fill_form(page);
		await expect(page.locator("#i_language")).toHaveValue("DE");
		expect(await page.locator("#i_language option").evaluateAll((options) => options.map((option) => option.value))).toEqual(["EN", "FR", "ES", "DE", "IT", "PL", "PT"]);
		expect(await page.locator('#i_language option[value="DE"]').textContent()).toBe("Deutsch");
		// no catalog but French: the screen stays French, with no missing key (the fixture fails the test on a warning)
		await page.locator("#i_language").selectOption("IT");
		await expect(page.locator("html")).toHaveAttribute("lang", "fr");
		await expect(page.locator("#i_nickname")).toBeVisible();
		await page.locator("#but_register").click();
		await expect(page.locator("#register_ok")).toBeVisible();
		expect(seen.body.language).toBe("IT");
	});
});

test.describe("browser in Japanese", () => {
	test.use({ locale: "ja-JP" });
	test("the select shows EN when the browser's language is not one of the API's", async ({ page }) => {
		const seen = await catch_registration(page);
		await fill_form(page);
		await expect(page.locator("#i_language")).toHaveValue("EN");
		await page.locator("#but_register").click();
		await expect(page.locator("#register_ok")).toBeVisible();
		expect(seen.body.language).toBe("EN");
	});
});
