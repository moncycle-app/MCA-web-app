// The text of the screens comes from the catalog: nothing is left empty, nothing shows a key, the language is the one used.
import { test, expect } from "./fixtures.mjs";

async function check_catalog_applied(page) {
	await expect.poll(() => page.locator("[data-i18n]:empty").count()).toBe(0);
	const attributes = await page.locator("[data-i18n-attr]").evaluateAll((elements) => elements.filter((element) => element.dataset.i18nAttr.split(";").some((pair) => !element.getAttribute(pair.split(":")[0].trim()))).length);
	expect(attributes).toBe(0);
	const shown = await page.evaluate(() => document.body.innerText + " " + [...document.querySelectorAll("[placeholder],[title]")].map((element) => element.placeholder + " " + element.title).join(" "));
	expect(shown).not.toMatch(/\b(timeline|settings|auth|register|verify_email|common|calendar|captcha|compat)\.[a-z_0-9]+/);
	await expect(page.locator("html")).toHaveAttribute("lang", "fr");
}

test("the sign-in screen is filled from the catalog", async ({ page }) => {
	await page.goto("/auth");
	await check_catalog_applied(page);
});

test("the settings screen is filled from the catalog", async ({ page, signed_in }) => {
	await signed_in.goto("/settings");
	await check_catalog_applied(page);
	for (const name of ["suivi", "descriptions", "donnees", "connexion", "appareils"]) {
		await page.locator("#menu_" + name).click();
		await check_catalog_applied(page);
		await page.locator(`#panel_${name} a.back`).click();
	}
});
