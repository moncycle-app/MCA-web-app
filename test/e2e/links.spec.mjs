import { fileURLToPath } from "node:url";
// The addresses that exist outside the app: links of the backend's mails, and pages opened by hand.
import { test, expect, API, sql } from "./fixtures.mjs";
import { WEB_ROOT } from "../../playwright.config.mjs";

test("a sign-in link from a mail pre-fills the address", async ({ page }) => {
	await page.goto("/#/auth?login_email=x@y.z");
	await expect(page.locator("#i_login_email")).toHaveValue("x@y.z");
});

test("a settings link opens its panel", async ({ page, signed_in }) => {
	await signed_in.goto("/#/settings/notifications");
	await expect(page.locator("#panel_notifications")).toBeVisible();
	await expect(page.locator("#menu")).toBeHidden();
});

test("a verify_email link shows its form and the fragment leaves the address bar", async ({ page, account }) => {
	const answer = await account.request.post(API + "/_test/email_token", { data: { userId: account.user_id, purpose: 2 } });
	const { token } = await answer.json();
	await page.goto(`/#/verify_email?purpose=resetPassword&t=${token}`);
	await expect(page.locator("#et_form_box")).toBeVisible();
	await expect(page.locator("#et_password_block")).toBeVisible();
	expect(new URL(page.url()).hash).toBe("#/verify_email");
});

// the route is by exact path: a glob "**/auth.html" would also catch screens/auth/auth.html, the markup of the screen
test("an address of the first version, answered with index.html by a server, is written back as a route", async ({ page }) => {
	await page.route((url) => url.pathname === "/auth.html", (route) => route.fulfill({ path: fileURLToPath(new URL(`../../${WEB_ROOT}/index.html`, import.meta.url)), contentType: "text/html" }));
	await page.goto("/auth.html");
	await expect(page.locator("#i_login_email")).toBeVisible();
	expect(new URL(page.url()).hash).toBe("#/auth");
});

test("an unknown route ends on the timeline", async ({ page, signed_in }) => {
	await signed_in.goto("/#/no/such/screen");
	await expect(page.locator("#but_mini_maxi")).toBeVisible();
	expect(new URL(page.url()).hash).toBe("#/");
});

test("a link of the app changes the screen without loading the page again, and Back returns", async ({ page, signed_in }) => {
	await signed_in.goto("/");
	await expect(page.locator("#but_mini_maxi")).toBeVisible();
	await page.evaluate(() => { window.same_page = true; });
	await page.locator('a[href="#/settings"]').click();
	await expect(page.locator("#menu")).toBeVisible();
	expect(new URL(page.url()).hash).toBe("#/settings");
	await page.goBack();
	await expect(page.locator("#but_mini_maxi")).toBeVisible();
	expect(new URL(page.url()).hash).toMatch(/^(#\/)?$/);
	expect(await page.evaluate(() => window.same_page)).toBe(true);
});

test("a screen that goes away leaves no handler on the window or the document", async ({ page, signed_in }) => {
	// every listener added to the window or the document, with the signal it ends with (none: it lives as long as the page)
	await page.addInitScript(() => {
		globalThis.listeners = [];
		for (const target of [window, document]) {
			const add = target.addEventListener;
			target.addEventListener = function (type, handler, options) {
				globalThis.listeners.push({ target: target === window ? "window" : "document", type, signal: options && options.signal });
				return add.call(this, type, handler, options);
			};
		}
	});
	await signed_in.goto("/");
	await expect(page.locator("#but_mini_maxi")).toBeVisible();
	const read = () => page.evaluate(() => ({
		ended: globalThis.listeners.filter((one) => one.signal && one.signal.aborted).length,
		with_signal: globalThis.listeners.filter((one) => one.signal).map((one) => one.target + "." + one.type).sort(),
		without_signal: globalThis.listeners.filter((one) => !one.signal).length,
	}));
	const on_timeline = await read();
	expect(on_timeline.with_signal).toEqual(expect.arrayContaining(["window.scroll", "window.focus", "window.storage"]));
	expect(on_timeline.ended).toBe(0);
	await page.locator('a[href="#/settings"]').click();
	await expect(page.locator("#menu")).toBeVisible();
	const on_settings = await read();
	// all of the timeline's have ended, and the screens added nothing that lives as long as the page
	expect(on_settings.ended).toBe(on_timeline.with_signal.length);
	expect(on_settings.without_signal).toBe(on_timeline.without_signal);
});
