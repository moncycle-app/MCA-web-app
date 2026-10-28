// Shared by every spec: an account made through the backend's /_test/ fixtures, a public client address per test (the sign-in
// throttling is per address), and a page that fails its test on a CSP violation, a script error or a missing catalog key.
import { test as base, expect } from "@playwright/test";

export { expect };
export const API = "http://127.0.0.1:8190";
const JSON_HEADERS = { "Content-Type": "application/json" };

export function today() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function days_ago(count) {
	const date = new Date();
	date.setDate(date.getDate() - count);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function post(request, path, data, headers = {}) {
	const answer = await request.post(API + path, { data, headers: { ...JSON_HEADERS, ...headers } });
	return answer.json();
}

export const test = base.extend({
	// a public address of its own: a private one in X-Forwarded-For is treated as a proxy and ignored by the server
	address: async ({}, use) => {
		const octet = () => 20 + Math.floor(Math.random() * 180);
		await use(`${octet()}.${octet()}.${octet()}.${octet()}`);
	},
	extraHTTPHeaders: async ({ address }, use) => use({ "X-Forwarded-For": address }),

	// an account with a cycle that began 4 days ago (so that today is a day of the timeline), made without the UI
	account: async ({ playwright }, use, info) => {
		const request = await playwright.request.newContext();
		const email = `e2e-${info.workerIndex}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
		const password = "Passw0rdPassw0rd";
		const created = await post(request, "/_test/account", { email, password, nickname: "Testeuse", method: 2 });
		const auth = { Authorization: "Bearer " + created.token };
		await post(request, "/api/v2/day/" + days_ago(4), { cycleFirstDay: true, lastWriteClientUtc: new Date().toISOString() }, auth);
		await use({ email, password, user_id: created.userId, token: created.token, auth, request });
		await request.dispose();
	},

	page: async ({ page }, use) => {
		const problems = [];
		await page.addInitScript(() => {
			document.addEventListener("securitypolicyviolation", (event) => console.error("CSP " + event.violatedDirective + " " + event.blockedURI));
		});
		page.on("console", (message) => {
			const text = message.text();
			if (text.startsWith("CSP ")) problems.push(text);
			if (message.type() === "warning" && /i18n/i.test(text)) problems.push(text);
		});
		page.on("pageerror", (error) => problems.push("pageerror: " + error.message));
		// the news file and the terms page are other sites: the CSP of a test server names none, and nothing here needs them
		await page.route("**/api/v2/server_info", async (route) => {
			try {
				const answer = await route.fetch();
				const body = await answer.json();
				if (body.data) { delete body.data.newsUrl; delete body.data.termsOfServiceUrl; }
				await route.fulfill({ response: answer, json: body });
			} catch { }   // the page went away (a redirect) before the answer came
		});
		await use(page);
		expect(problems).toEqual([]);
	},

	// a page holding the session of the account, without going through the sign-in screen
	signed_in: async ({ page, account }, use) => {
		const answer = await page.request.post("/api/v2/token", { data: { email: account.email, password: account.password, name: "WEB-APP e2e", cookie: true } });
		expect(answer.ok()).toBe(true);
		await page.goto("/auth");
		await expect(page.locator("#i_login_email")).toBeVisible();   // the screen has mounted (it empties the storage), the session can be set
		await page.evaluate((id) => { localStorage.auth = id; }, String((await answer.json()).data.userId));
		await use(page);
	},
});

export async function sql(request, statement, params = []) {
	return post(request, "/_test/sql", { sql: statement, params });
}

export async function sign_in_with_ui(page, account) {
	await page.goto("/auth");
	await page.locator("#i_login_email").fill(account.email);
	await page.locator("#i_password").fill(account.password);
	await page.locator("#connexion_but").click();
	await page.waitForURL((url) => url.pathname === "/");
}

// the timeline in its detailed ("maxi") view, with today's row
export async function open_today(page) {
	await page.goto("/");
	await expect(page.locator("#recap, #timeline").first()).toBeAttached();
	if (!(await page.locator("#timeline").isVisible())) await page.locator("#but_mini_maxi").click();
	const row = page.locator("#o-" + today());
	await expect(row).toBeVisible();
	await row.click();
	await expect(page.locator("#jour_form")).toBeVisible();
}
