// The FertilityCare note against the server: what is typed is taken, comes back in its fields and in the same text, and a day read can be sent back.
import { test, expect, API, today, open_today } from "./fixtures.mjs";
import { fc_score_to_codified, fc_score_from_api, fc_note_from_boxes, fc_boxes_unticked_by } from "../../src/js/model/fc_notation.js";

const NOTES = ["H AP", "MB", "VLB 4 X1", "LB", "L", "L 10KL AD", "10KL AD", "0 AD", "2W X1", "10DL", "10SL X2", "6CP X3", "PY AD", "6BC X1", "B", "LAP", "RAP"];
const FIELDS = ["codifiedBleedingObservation", "codifiedBleedingBrown", "codifiedMucusSensation", "codifiedMucusObservation", "codifiedNumberObservations", "codifiedPainObservations"];

// every box the notation knows, and the note it makes alone
const EVERY_BOX = {
	fc_h: "H", fc_m: "M", fc_flow_l: "L", fc_vl: "VL", fc_vh: "VH", fc_b: "B",
	fc_0: "0", fc_2: "2", fc_2w: "2W", fc_4: "4", fc_6: "6", fc_8: "8", fc_10: "10", fc_10dl: "10DL", fc_10sl: "10SL", fc_10wl: "10WL",
	fc_c: "C", fc_g: "G", fc_k: "K", fc_p: "P", fc_y: "Y", fc_l: " L",
	fc_x1: "X1", fc_x2: "X2", fc_x3: "X3", fc_ad: "AD", fc_ap: "AP", fc_rap: "RAP", fc_lap: "LAP",
};

async function fertility_care(account) {
	const answer = await account.request.post(`${API}/api/v3/account`, { headers: account.auth, data: { method: "fertilityCare" } });
	expect(answer.ok(), await answer.text()).toBeTruthy();
}

test("every note goes through the server and comes back the same, and a day read is taken back", async ({ account }) => {
	await fertility_care(account);
	const url = `${API}/api/v3/day/${today()}`;
	const sent = (data, stamp) => account.request.post(url, { headers: account.auth, data: { ...data, lastWriteClientUtc: new Date(Date.now() + stamp).toISOString() } });
	let stamp = 1000;
	for (const typed of NOTES) {
		const body = fc_score_to_codified(typed);
		const written = await sent(body, stamp += 1000);
		expect(written.ok(), typed + " " + await written.text()).toBeTruthy();
		const day = (await (await account.request.get(url, { headers: account.auth })).json()).data;
		for (const field of FIELDS) expect(day[field], typed + " " + field).toEqual(body[field]);
		expect(fc_score_from_api(day)).toBe(typed);
		const { cycleStartDate, cycleDay, lastWriteDb, ...input } = day;
		const again = await sent(input, stamp += 1000);
		expect(again.ok(), typed + " read back " + await again.text()).toBeTruthy();
	}
});

test("a note typed in the form is saved, ticks its boxes, and another change of the form keeps it", async ({ page, signed_in, account }) => {
	await fertility_care(account);
	await open_today(signed_in);
	const note = page.locator("#form_fc");
	const stored = async () => (await (await account.request.get(`${API}/api/v3/day/${today()}`, { headers: account.auth })).json()).data;

	await note.fill("6BC X1");
	await note.blur();
	await expect(page.locator("#fc_msg")).toHaveClass(/vert/);
	await expect(page.locator("#jour_form_saved")).toBeVisible();
	await expect(page.locator("#fc_6")).toBeChecked();
	await expect(page.locator("#fc_c")).toBeChecked();
	await expect(page.locator("#fc_b")).not.toBeChecked();   // this B is a letter of the mucus
	await page.locator("#fc_ad").check();
	await expect.poll(async () => (await stored()).codifiedMucusObservation).toEqual(["B", "C"]);
	expect((await stored()).codifiedBleedingBrown).toBe(false);

	await note.fill("VLB");
	await note.blur();
	await expect.poll(async () => (await stored()).codifiedBleedingBrown).toBe(true);
	await expect(page.locator("#fc_vl")).toBeChecked();
	await expect(page.locator("#fc_b")).toBeChecked();
	expect((await stored()).codifiedBleedingObservation).toBe("VL");
	expect((await stored()).codifiedMucusObservation).toEqual([]);
	await expect(page.locator(`#o-${today()} .note_red`).first()).toBeAttached();
});

test("the box of the letter L alone is a letter, not a flow, and a brown bleeding alone is a filled day", async ({ page, signed_in, account }) => {
	await fertility_care(account);
	await open_today(signed_in);
	const stored = async () => (await (await account.request.get(`${API}/api/v3/day/${today()}`, { headers: account.auth })).json()).data;
	await page.locator("#fc_l").check();
	await expect.poll(async () => (await stored()).codifiedMucusObservation).toEqual(["L"]);
	expect((await stored()).codifiedBleedingObservation).toBe(null);
	await page.reload();
	await open_today(page);
	await expect(page.locator("#fc_l")).toBeChecked();
	await expect(page.locator("#fc_flow_l")).not.toBeChecked();

	await page.locator("#fc_l").uncheck();
	await page.locator("#fc_b").check();
	await expect.poll(async () => (await stored()).codifiedBleedingBrown).toBe(true);
	await expect(page.locator("#form_fc")).toHaveValue("B");
	await expect(page.locator(`#o-${today()} .fc`)).toHaveText("B");
	await expect(page.locator(`#o-${today()} .note_red`)).toHaveText("B");
});

test("a copy of the previous schema with the old note is dropped, and the day is drawn from the server", async ({ page, signed_in, account }) => {
	await fertility_care(account);
	await open_today(signed_in);
	await page.locator("#form_fc").fill("MB");
	await page.locator("#form_fc").blur();
	await expect(page.locator("#jour_form_saved")).toBeVisible();
	await page.evaluate((date) => {
		const key = "data_day_" + date;
		localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), codifiedBleedingObservation: "VLB", codifiedMucusObservation: "KL" }));
		localStorage.setItem("data_version", "8/" + localStorage.getItem("data_version").split("/").slice(1).join("/"));
	}, today());
	await page.reload();
	await open_today(page);
	await expect(page.locator("#form_fc")).toHaveValue("MB");
});

test("the recap reads the fields: the flow in the square, the stretch and the letters beside it", async ({ page, signed_in, account }) => {
	await fertility_care(account);
	await open_today(signed_in);
	const note = page.locator("#form_fc");
	const cell = page.locator(`#ro-${today()}`);
	const shows = async (typed, square, stretch, letters) => {
		await note.fill(typed);
		await note.blur();
		await expect(cell.locator(".g")).toHaveText(square);
		await expect(cell.locator(".fc")).toHaveText([stretch, letters]);
	};
	await shows("L 10KL AD", "L", "10", "KL");
	await shows("VLB 4 X1", "VL", "4", "");
	await shows("0 AD", "👋", "0", "");
	await shows("LAP", "👋", "", "");
	await shows("10DL", "👋", "10", "DL");
	await shows("6BC X1", "👋", "6", "BC");
	await expect(page.locator(`#o-${today()} .note_red`)).toHaveCount(0);   // a letter B is not the bleeding
});

test("a note that is not valid is not saved, and the rest of the form is", async ({ page, signed_in, account }) => {
	await fertility_care(account);
	await open_today(signed_in);
	const note = page.locator("#form_fc");
	const stored = async () => (await (await account.request.get(`${API}/api/v3/day/${today()}`, { headers: account.auth })).json()).data;
	await note.fill("H 10KL");
	await note.blur();
	await expect.poll(async () => (await stored()).codifiedBleedingObservation).toBe("H");
	await note.fill("HM 6C");
	await note.blur();
	await expect(page.locator("#fc_msg")).toHaveClass(/rouge/);
	await page.locator("#from_com").fill("kept");
	await page.locator("#from_com").blur();
	await expect.poll(async () => (await stored()).comment).toBe("kept");
	await expect(note).toHaveValue("HM 6C");   // still there to correct
	const day = await stored();
	expect([day.codifiedBleedingObservation, day.codifiedMucusSensation, day.codifiedMucusObservation]).toEqual(["H", "10", ["K", "L"]]);
});

test("in the boxes a part holds one code, brown and the letters several", async ({ page, signed_in, account }) => {
	await fertility_care(account);
	await open_today(signed_in);
	await page.locator("label[for=fc_h]").click();
	await page.locator("label[for=fc_b]").click();
	await page.locator("label[for=fc_m]").click();
	await expect(page.locator("#fc_h")).not.toBeChecked();
	await page.locator("label[for=fc_10]").click();
	await page.locator("label[for=fc_10dl]").click();
	await expect(page.locator("#fc_10")).not.toBeChecked();
	await page.locator("label[for=fc_x1]").click();
	await page.locator("label[for=fc_ad]").click();
	await page.locator("label[for=fc_ap]").click();
	await page.locator("label[for=fc_lap]").click();
	await page.locator("label[for=fc_c]").click();
	await page.locator("label[for=fc_k]").click();
	await expect(page.locator("#form_fc")).toHaveValue("MB 10DLCK AD LAP");
	await expect(page.locator("#fc_msg")).toHaveClass(/vert/);
	const day = async () => (await (await account.request.get(`${API}/api/v3/day/${today()}`, { headers: account.auth })).json()).data;
	await expect.poll(async () => (await day()).codifiedPainObservations).toBe("LAP");
	expect((await day()).codifiedMucusObservation).toEqual(["C", "K"]);
});

test("a B beside a flow is brown: its box is ticked and the day says so", async ({ page, signed_in, account }) => {
	await fertility_care(account);
	const url = `${API}/api/v3/day/${today()}`;
	await account.request.post(url, { headers: account.auth, data: { codifiedBleedingObservation: "H", codifiedMucusObservation: ["B"], lastWriteClientUtc: new Date().toISOString() } });
	await open_today(signed_in);
	await expect(page.locator("#form_fc")).toHaveValue("H B");
	await expect(page.locator("#fc_b")).toBeChecked();
	await page.locator("#from_com").fill("again");
	await page.locator("#from_com").blur();
	const day = async () => (await (await account.request.get(url, { headers: account.auth })).json()).data;
	await expect.poll(async () => (await day()).comment).toBe("again");
	expect([(await day()).codifiedBleedingBrown, (await day()).codifiedMucusObservation]).toEqual([true, []]);
});

test("every box, ticked then unticked by a click, reaches the server and goes away", async ({ page, signed_in, account }) => {
	test.setTimeout(120000);
	await fertility_care(account);
	await open_today(signed_in);
	const url = `${API}/api/v3/day/${today()}`;
	const note_of = async () => fc_score_from_api((await (await account.request.get(url, { headers: account.auth })).json()).data);
	for (const [box, shown] of Object.entries(EVERY_BOX)) {
		await page.locator(`label[for=${box}]`).click();
		await expect(page.locator("#form_fc"), box).toHaveValue(shown);
		await expect(page.locator("#fc_msg"), box).toHaveClass(/vert/);
		await expect.poll(note_of, { message: box }).toBe(shown);
		await page.locator(`label[for=${box}]`).click();
		await expect(page.locator("#form_fc"), box).toHaveValue("");
		await expect.poll(note_of, { message: box + " unticked" }).toBe("");
	}
});

test("a walk through the boxes: at each step the page and the server agree, and after a reload too", async ({ page, signed_in, account }) => {
	test.setTimeout(120000);
	await fertility_care(account);
	await open_today(signed_in);
	const url = `${API}/api/v3/day/${today()}`;
	const note_of = async () => fc_score_from_api((await (await account.request.get(url, { headers: account.auth })).json()).data);
	const boxes = Object.keys(EVERY_BOX);
	let seed = 7;
	let ticked = [];
	for (let step = 0; step < 40; step++) {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		const box = boxes[seed % boxes.length];
		await page.locator(`label[for=${box}]`).click();
		ticked = ticked.includes(box) ? ticked.filter((other) => other !== box) : [...ticked.filter((other) => !fc_boxes_unticked_by(box).includes(other)), box];
		const expected = fc_note_from_boxes(ticked, "");
		await expect(page.locator("#form_fc"), `step ${step} ${box}`).toHaveValue(expected);
		await expect.poll(note_of, { message: `step ${step} ${box}` }).toBe(expected);
		const on_page = await page.locator('#form_data input.fc_form_note[type="checkbox"]:checked').evaluateAll((list) => list.map((one) => one.id));
		expect([...on_page].sort(), `step ${step} ${box}`).toEqual([...ticked].sort());
		if (step % 13 === 12) {
			await page.reload();
			await open_today(page);
			await expect(page.locator("#form_fc")).toHaveValue(expected);
			const reloaded = await page.locator('#form_data input.fc_form_note[type="checkbox"]:checked').evaluateAll((list) => list.map((one) => one.id));
			expect([...reloaded].sort()).toEqual([...ticked].sort());
		}
	}
});

for (const width of [375, 320]) {
	test.describe(`in French, ${width} wide`, () => {
		test.use({ viewport: { width, height: 700 } });
		test("the field of the note does not move with the message, which stays on the line of the label", async ({ page, signed_in, account }) => {
			await fertility_care(account);
			await account.request.post(`${API}/api/v3/account`, { headers: account.auth, data: { language: "FR" } });
			await open_today(signed_in);
			const note = page.locator("#form_fc");
			const message = page.locator("#fc_msg");
			const label = page.locator("#fc_score_holder .categorie");
			const empty = await note.boundingBox();
			const check_state = async (typed, css, words) => {
				await note.fill(typed);
				await note.blur();
				await expect(message).toHaveClass(css);
				await expect(message).toHaveText(words);
				expect(await note.boundingBox()).toEqual(empty);
				const shown = await message.boundingBox();
				const title = await label.boundingBox();
				expect(shown.y).toBeGreaterThanOrEqual(title.y - 1);
				expect(shown.y + shown.height).toBeLessThanOrEqual(title.y + title.height + 1);
				expect(shown.x).toBeGreaterThanOrEqual(title.x + title.width);
				expect(shown.x + shown.width).toBeCloseTo(empty.x + empty.width, 0);
				// the whole message is readable: nothing is cut off
				expect(await message.evaluate((box) => box.scrollWidth <= box.clientWidth)).toBe(true);
			};
			await check_state("B 2", /vert/, "syntaxe valide");
			await check_state("B 2XXXX", /rouge/, "note non enregistrée");
			await page.screenshot({ path: `test-results/fc_msg_${width}.png` });
			await check_state("6C", /vert/, "syntaxe valide");
		});
	});
}
