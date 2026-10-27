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
