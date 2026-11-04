// The settings screen: every panel opens, the nickname saves by itself.
import { test, expect, API } from "./fixtures.mjs";

test("every panel opens from the menu", async ({ page, signed_in }) => {
	await signed_in.goto("/#/settings");
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
	await signed_in.goto("/#/settings/profil");
	const saved = page.waitForResponse((answer) => answer.url().endsWith("/api/v3/account") && answer.request().method() !== "GET");
	await page.locator("#i_nickname").fill("Nouveau pseudo");
	await page.locator("#i_nickname").blur();
	expect((await saved).ok()).toBe(true);
	await page.reload();
	await expect(page.locator("#i_nickname")).toHaveValue("Nouveau pseudo");
});

// The Affichage panel: each optional setting is a form that sends its key alone, null puts it back to the default, and the timeline follows.
const posted = (page) => page.waitForResponse((answer) => answer.url().endsWith("/api/v3/account") && answer.request().method() === "POST");

test("the date order is saved alone and the day rows follow it, then it is reset with null", async ({ page, signed_in, account }) => {
	await signed_in.goto("/#/settings/affichage");
	const reset = page.locator('form[data-setting="dateOrder"] button[name="reset"]');
	await expect(reset).toBeDisabled();
	await expect(reset).toBeHidden();   // at its default, there is nothing to go back to
	await expect(page.locator("#i_date_order")).toHaveValue("DAY_FIRST");
	let saved = posted(page);
	await page.locator("#i_date_order").selectOption("MONTH_FIRST");
	expect((await saved).request().postDataJSON()).toEqual({ dateOrder: "MONTH_FIRST" });
	await expect(reset).toBeEnabled();
	await expect(reset).toBeVisible();
	await page.goto("/");
	// "T NOV 3": the initial, the month on 3 letters, the day (and ", 25" when the year is not this one)
	await expect(page.locator("#timeline .d").first()).toHaveText(/^\S [^\d\s]{3} \d{1,2}(, \d\d)?$/);
	await page.goto("/#/settings/affichage");
	saved = posted(page);
	await reset.click();
	expect((await saved).request().postDataJSON()).toEqual({ dateOrder: null });
	await expect(page.locator("#i_date_order")).toHaveValue("DAY_FIRST");
	await page.goto("/");
	await expect(page.locator("#timeline .d").first()).toHaveText(/^\S \d{1,2} [^\d\s]{3}( \d\d)?$/);
	const stored = await (await account.request.get(`${API}/api/v3/account`, { headers: account.auth })).json();
	expect(stored.data.settings.dateOrder.isSet).toBe(false);
});

test("the colour behind the days can be switched off", async ({ page, signed_in, account }) => {
	await signed_in.goto("/#/settings/affichage");
	await expect(page.locator("#i_day_background")).toBeChecked();
	const saved = posted(page);
	await page.locator('label[for="i_day_background"]').click();   // the box itself is drawn by its label
	expect((await saved).request().postDataJSON()).toEqual({ dayBackgroundColor: false });
	await page.goto("/");
	await expect(page.locator("html")).toHaveClass(/no_day_color/);
	await expect.poll(async () => (await (await account.request.get(`${API}/api/v3/account`, { headers: account.auth })).json()).data.settings.dayBackgroundColor.value).toBe(false);
});

test("the temperature unit is offered with the temperature, and a refused change puts the control back", async ({ page, signed_in, account }) => {
	await signed_in.goto("/#/settings/affichage");
	await expect(page.locator("#f_temperature_unit")).toBeHidden();   // the account does not track the temperature
	await account.request.post(`${API}/api/v3/account`, { data: { temperatureTracking: true }, headers: { "Content-Type": "application/json", ...account.auth } });
	await page.reload();
	await expect(page.locator("#f_temperature_unit")).toBeVisible();
	await expect(page.locator("#i_temperature_unit")).toHaveValue("C");
	await page.route("**/api/v3/account", (route) => route.request().method() === "POST"
		? route.fulfill({ status: 400, json: { error: { code: "validation_failed", message: "Validation failed.", details: { issues: [{ field: "temperatureUnit", code: "invalid_value", message: "not an unit" }] } } } })
		: route.fallback());
	await page.locator("#i_temperature_unit").selectOption("F");
	await expect(page.locator("#i_temperature_unit")).toHaveValue("C");
	await expect(page.locator('form[data-setting="temperatureUnit"] .form_msg')).toContainText("not an unit");
});
