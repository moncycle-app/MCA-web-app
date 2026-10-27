// The timeline: a day typed in the form, the queue when the server cannot be reached, a description made on the spot, mini/maxi and exports.
import { test, expect, API, today, open_today } from "./fixtures.mjs";

test("a day is saved, shown as text, and kept after a reload", async ({ page, signed_in, account }) => {
	await open_today(signed_in);
	await page.locator("#go_vert").check();
	await page.locator("#from_com").fill("<b>x</b>");
	await page.locator("#from_com").blur();
	await expect(page.locator("#jour_form_saved")).toBeVisible();
	await expect(page.locator("#from_com")).toHaveValue("<b>x</b>");
	await expect(page.locator("#jour_form b.comment, #jour_form #from_com b")).toHaveCount(0);
	await page.reload();
	await open_today(page);
	await expect(page.locator("#from_com")).toHaveValue("<b>x</b>");
	const stored = await account.request.get(`${API}/api/v2/day/${today()}`, { headers: account.auth });
	expect((await stored.json()).data.comment).toBe("<b>x</b>");
});

test("a day that cannot be sent waits in the queue, then goes", async ({ page, signed_in }) => {
	await open_today(signed_in);
	await page.route("**/api/v2/day**", (route) => route.abort());
	await page.locator("#go_jaune").check();
	await expect(page.locator("#jour_form_unsent")).toBeVisible();
	await page.unroute("**/api/v2/day**");
	await page.locator("#sync_retry").click();
	await expect(page.locator("#jour_form_saved")).toBeVisible();
	await expect(page.locator("#jour_form_unsent")).toBeHidden();
	expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.data_pending || "{}")).length)).toBe(0);
});

test("a description made in the day form is a chip at once", async ({ page, signed_in }) => {
	await open_today(signed_in);
	await page.locator('.desc_add_toggle[data-desc-type="2"]').click();
	await page.locator("#desc_add_form_sensation .desc_add_input").fill("fatigue");
	await page.locator("#desc_add_form_sensation .desc_add_submit").click();
	await expect(page.locator("#menu_sensation_container .desc_chip label", { hasText: "fatigue" })).toBeVisible();
});

test("the mini and maxi views switch, and a cycle exports through the API", async ({ page, signed_in }) => {
	await page.goto("/");
	await expect(page.locator("#recap, #timeline").first()).toBeAttached();
	const before = await page.locator("#timeline").isVisible();
	await page.locator("#but_mini_maxi").click();
	await expect(page.locator("#timeline")).toBeVisible({ visible: !before });
	await expect(page.locator("#recap")).toBeVisible({ visible: before });
	const exports = page.locator('.cycle_options a[href^="/api/v2/export/"]');
	await expect(exports.first()).toBeAttached();
	expect(await exports.evaluateAll((links) => links.map((link) => link.getAttribute("href").split("?")[0].split("/").pop()))).toEqual(expect.arrayContaining(["nfp", "csv", "pdf"]));
});
