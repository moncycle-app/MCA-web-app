// The sign-up form sends the language it holds. Nothing is created: the request is answered by the test.
import { test, expect } from "./fixtures.mjs";

test("the registration carries a language", async ({ page }) => {
	let body = null;
	await page.route("**/api/v2/register", async (route) => {
		body = route.request().postDataJSON();
		await route.fulfill({ status: 201, json: { data: { sent: true } } });
	});
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
	await page.locator("#but_register").click();
	await expect(page.locator("#register_ok")).toBeVisible();
	expect(body.language).toBe("FR");
});
