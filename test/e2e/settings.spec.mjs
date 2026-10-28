// The settings screen: every panel opens, the nickname saves by itself.
import { test, expect } from "./fixtures.mjs";

test("every panel opens from the menu", async ({ page, signed_in }) => {
	await signed_in.goto("/settings");
	await expect(page.locator("#menu a.menu_item:not([hidden])").first()).toBeVisible();
	const names = await page.locator("#menu a.menu_item:not([hidden])").evaluateAll((items) => items.map((item) => item.id.replace("menu_", "")));
	expect(names.length).toBeGreaterThanOrEqual(7);
	for (const name of names) {
		await page.locator("#menu_" + name).click();
		await expect(page.locator("#panel_" + name)).toBeVisible();
		await page.locator(`#panel_${name} a.back`).click();
		await expect(page.locator("#menu")).toBeVisible();
	}
});

test("the nickname saves by itself", async ({ page, signed_in }) => {
	await signed_in.goto("/settings#suivi");
	const saved = page.waitForResponse((answer) => answer.url().endsWith("/api/v2/account") && answer.request().method() !== "GET");
	await page.locator("#i_nickname").fill("Nouveau pseudo");
	await page.locator("#i_nickname").blur();
	expect((await saved).ok()).toBe(true);
	await page.reload();
	await expect(page.locator("#i_nickname")).toHaveValue("Nouveau pseudo");
});
