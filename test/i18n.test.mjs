// The catalog module: lookups, plurals, dates, the choice of the language. And the catalog against the code: every key the code or the
// markup uses exists in fr.json, and fr.json holds no key that nothing uses.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { install } from "./support/browser_stub.mjs";

install();
const src = fileURLToPath(new URL("../src/", import.meta.url));
const catalog = JSON.parse(readFileSync(join(src, "i18n/fr.json"), "utf8"));
const i18n = await import("/js/core/i18n.js");
i18n.use_catalog(catalog);

test("t: variables, missing keys", (t) => {
	assert.equal(i18n.t("timeline.day_number", { n: 12 }), "J12");
	assert.equal(i18n.t("timeline.but_day_step", { arrow: "↑", day: "J13" }), "↑ J13");
	const warnings = [];
	t.mock.method(console, "warn", (message) => warnings.push(message));
	assert.equal(i18n.t("no.such_key"), "no.such_key");
	assert.equal(i18n.t("no.such_key"), "no.such_key");
	assert.equal(warnings.length, 1, "warned once");
	assert.match(warnings[0], /no\.such_key/);
});
test("t: plurals follow the language's rule (French: 0 and 1 are singular)", () => {
	assert.match(i18n.t("timeline.sync_not_sent", { count: 1 }), /^⚠️ 1 modification enregistrée sur/);
	assert.match(i18n.t("timeline.sync_not_sent", { count: 0 }), /^⚠️ 0 modification enregistrée sur/);
	assert.match(i18n.t("timeline.sync_not_sent", { count: 3 }), /^⚠️ 3 modifications enregistrées sur/);
	assert.equal(i18n.t("settings.n_days", { count: 2 }), "2 jours");
});
test("t_list, t_map", () => {
	assert.equal(i18n.t_list("calendar.months_short").length, 12);
	assert.deepEqual(i18n.t_list("no.list"), []);
	const errors = i18n.t_map("settings.export_errors");
	assert.equal(errors.no_data_in_period, "aucune observation sur cette période.");
	assert.ok(!Object.keys(errors).some((key) => key.includes("_comment")));
});
test("dates keep today's output", () => {
	const day = new Date(2026, 2, 3, 14, 5);
	assert.equal(i18n.date_short(day), "3 mars");
	assert.equal(i18n.date_long(day), "mardi 3 mars 2026");
	assert.equal(i18n.date_row(day), "m 3 mars ");
	assert.equal(i18n.date_short(new Date(2026, 0, 8)), "8 jan");
	assert.equal(i18n.clock(day), "14:05");
});
test("numbers use the catalog's locale", () => {
	assert.equal(i18n.locale(), "fr-FR");
	assert.equal(i18n.format_number(36.5), "36,5");
	assert.equal(i18n.parse_number("36,5"), 36.5);
	assert.equal(i18n.parse_number(" 36.5 "), 36.5);
});
test("the language: account, then the register select, then the browser, then EN", () => {
	const browser = ["ja-JP", "de-DE", "fr"];
	assert.equal(i18n.resolve_language({ account: "es", selected: "FR", navigator_languages: browser }), "ES");
	assert.equal(i18n.resolve_language({ selected: "pt", navigator_languages: browser }), "PT");
	assert.equal(i18n.resolve_language({ navigator_languages: browser }), "DE");
	assert.equal(i18n.resolve_language({ navigator_languages: ["ja-JP", "zh"] }), "EN");
	assert.equal(i18n.resolve_language({ account: "XX", navigator_languages: [] }), "EN");
	assert.equal(i18n.language_from_browser(["EN-us"]), "EN");
});

// --- the catalog against the code ---------------------------------------------------------------------------------------------------
function files(dir, extensions) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (name === "vendor" || name === "i18n") return [];
		return statSync(path).isDirectory() ? files(path, extensions) : extensions.some((e) => name.endsWith(e)) ? [path] : [];
	});
}
const used = new Set();
const used_prefixes = new Set();
for (const file of files(src, [".js", ".html"])) {
	let text = readFileSync(file, "utf8");
	if (file.endsWith(".js")) text = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");   // what a comment says about t("...") is not a use
	for (const m of text.matchAll(/\bt(?:_node|_list)?\(\s*"([a-z_]+(?:\.[A-Za-z_0-9]+)+)"/g)) used.add(m[1]);
	for (const m of text.matchAll(/\bt_map\(\s*"([a-z_]+(?:\.[A-Za-z_0-9]+)*)"/g)) used_prefixes.add(m[1] + ".");
	for (const m of text.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
	for (const m of text.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(";").forEach((pair) => used.add(pair.slice(pair.indexOf(":") + 1)));
	// keys handed over as plain strings ("timeline.cycle_title" to a function that calls t(key))
	if (file.endsWith(".js")) for (const m of text.matchAll(/"((?:timeline|settings|auth|register|verify_email|captcha|compat|common|calendar|meta)\.[A-Za-z_0-9.]+)"/g)) used.add(m[1]);
}
// keys the code builds from a variable part: the catalog keeps them together under these prefixes
const built = ["verify_email.page."];
const comment = (key) => key.endsWith("._comment");

test("every key used by the code or the markup is in fr.json", () => {
	const missing = [...used].filter((key) => !(key in catalog) && !used_prefixes.has(key + ".") && !built.includes(key));
	assert.deepEqual(missing, []);
});
test("fr.json holds no key that nothing uses", () => {
	const unused = Object.keys(catalog).filter((key) => !comment(key) && !used.has(key) && ![...used_prefixes, ...built].some((prefix) => key.startsWith(prefix)));
	assert.deepEqual(unused, []);
});
test("every _comment explains a key that exists", () => {
	const orphans = Object.keys(catalog).filter((key) => comment(key) && !(key.slice(0, -"._comment".length) in catalog));
	assert.deepEqual(orphans, []);
});
test("no catalog string holds markup", () => {
	const html = Object.entries(catalog).filter(([key, value]) => !comment(key) && JSON.stringify(value).match(/<[a-z\/]/i));
	assert.deepEqual(html.map(([key]) => key), []);
});
