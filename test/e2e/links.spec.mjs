// The addresses that exist outside the app: links of the backend's mails, and pages opened by hand.
import { test, expect, API, sql } from "./fixtures.mjs";

test("a sign-in link from a mail pre-fills the address", async ({ page }) => {
	await page.goto("/auth?login_email=x@y.z");
	await expect(page.locator("#i_login_email")).toHaveValue("x@y.z");
});

test("a settings link opens its panel", async ({ page, signed_in }) => {
	await signed_in.goto("/settings#notifications");
	await expect(page.locator("#panel_notifications")).toBeVisible();
	await expect(page.locator("#menu")).toBeHidden();
});

test("a verify_email link shows its form and the fragment leaves the address bar", async ({ page, account }) => {
	const answer = await account.request.post(API + "/_test/email_token", { data: { userId: account.user_id, purpose: 2 } });
	const { token } = await answer.json();
	await page.goto(`/verify_email#purpose=resetPassword&t=${token}`);
	await expect(page.locator("#et_form_box")).toBeVisible();
	await expect(page.locator("#et_password_block")).toBeVisible();
	expect(new URL(page.url()).hash).toBe("");
});

test("an old .html address is written back without .html", async ({ page }) => {
	await page.goto("/auth.html");
	await expect(page.locator("#i_login_email")).toBeVisible();
	expect(new URL(page.url()).pathname).toBe("/auth");
});

test("an unknown path ends on the timeline", async ({ page, signed_in }) => {
	await signed_in.goto("/no/such/screen");
	await expect(page.locator("#but_mini_maxi")).toBeVisible();
	expect(new URL(page.url()).pathname).toBe("/");
});

test("a link of the app changes the screen without loading the page again, and Back returns", async ({ page, signed_in }) => {
	await signed_in.goto("/");
	await expect(page.locator("#but_mini_maxi")).toBeVisible();
	await page.evaluate(() => { window.same_page = true; });
	await page.locator('a[href="/settings"]').click();
	await expect(page.locator("#menu")).toBeVisible();
	expect(new URL(page.url()).pathname).toBe("/settings");
	await page.goBack();
	await expect(page.locator("#but_mini_maxi")).toBeVisible();
	expect(new URL(page.url()).pathname).toBe("/");
	expect(await page.evaluate(() => window.same_page)).toBe(true);
});

test("a screen that goes away leaves no handler on the window or the document", async ({ page, signed_in }) => {
	await signed_in.goto("/");
	await expect(page.locator("#but_mini_maxi")).toBeVisible();
	// the handlers the screen added through jQuery (its own namespace); jQuery's internal ones for focus are not the screen's
	const own = () => page.evaluate(() => {
		const found = [];
		for (const target of [window, document]) {
			const events = globalThis.$._data(target, "events") || {};
			for (const [name, handlers] of Object.entries(events)) handlers.forEach((handler) => { if (handler.namespace) found.push(name + "." + handler.namespace); });
		}
		return found.sort();
	});
	expect(await own()).toEqual(expect.arrayContaining(["scroll.timeline", "focus.timeline", "click.timeline"]));
	await page.locator('a[href="/settings"]').click();
	await expect(page.locator("#menu")).toBeVisible();
	const on_settings = await own();
	expect(on_settings.filter((name) => name.endsWith(".timeline"))).toEqual([]);
});
