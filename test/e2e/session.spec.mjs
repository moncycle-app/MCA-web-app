// Sign-in, sign-out, session end, version gate, and who may open which address.
import { test, expect, sign_in_with_ui, sql, open_today } from "./fixtures.mjs";

test("sign in from /auth, see the timeline, sign out", async ({ page, account }) => {
	await sign_in_with_ui(page, account);
	await expect(page.locator("#recap:visible, #timeline:visible")).toHaveCount(1);
	await page.goto("/settings");
	await page.locator("#but_logout").click();
	await page.waitForURL((url) => url.pathname === "/auth");
	expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test("a signed-in user leaves /auth, a signed-out one leaves /settings", async ({ page, signed_in }) => {
	await signed_in.goto("/auth").catch(() => { });
	await expect(page).toHaveURL(/\/$/);
	await page.evaluate(() => localStorage.clear());
	await page.context().clearCookies();
	await page.goto("/settings").catch(() => { });   // the redirect to /auth may abort this navigation
	await expect(page).toHaveURL(/\/auth$/);
});

test("a session that ended on the server sends back to /auth with an empty storage", async ({ page, signed_in, account }) => {
	await open_today(signed_in);
	await sql(account.request, "DELETE FROM auth_token WHERE no_user_account = ?", [account.user_id]);
	await page.locator("#go_vert").check();
	await page.waitForURL((url) => url.pathname === "/auth");
	expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test("an API generation out of the supported range stops the app and sends nothing", async ({ page, signed_in }) => {
	const writes = [];
	await page.route("**/api/v2/server_info", async (route) => {
		const answer = await route.fetch();
		const body = await answer.json();
		body.data.appVersion = "99";
		delete body.data.newsUrl;
		await route.fulfill({ response: answer, json: body });
	});
	page.on("request", (request) => { if (request.url().includes("/api/") && request.method() !== "GET") writes.push(request.method() + " " + request.url()); });
	await page.goto("/");
	await expect(page.locator("#compat_notice")).toBeVisible();
	expect(writes).toEqual([]);
});
