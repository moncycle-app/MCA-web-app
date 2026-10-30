// The catalog module: lookups, plurals, dates, the choice of the language. And the catalog against the code: every key the code or the
// markup uses exists in the catalogs, and they hold no key that nothing uses; English and French hold the same keys.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { install } from "./support/browser_stub.mjs";

install();
const src = fileURLToPath(new URL("../src/", import.meta.url));
const catalog = JSON.parse(readFileSync(join(src, "i18n/fr.json"), "utf8"));
const english = JSON.parse(readFileSync(join(src, "i18n/en.json"), "utf8"));
const i18n = await import("/js/core/i18n.js");
i18n.use_catalog(catalog, "fr");

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
test("the interface is offered in English and French, English first", () => {
	assert.deepEqual(i18n.LANGUAGES, ["EN", "FR"]);
	assert.equal(i18n.FALLBACK, "en");
});
test("the language: account, then the register select, then the browser, then EN", () => {
	const browser = ["ja-JP", "de-DE", "fr"];
	assert.equal(i18n.resolve_language({ account: "en", selected: "FR", navigator_languages: browser }), "EN");
	assert.equal(i18n.resolve_language({ account: "fr", navigator_languages: ["en-GB"] }), "FR");
	assert.equal(i18n.resolve_language({ selected: "en", navigator_languages: browser }), "EN");
	// a language of the API with no catalog (ES) is not the account's for the interface: the next rule applies
	assert.equal(i18n.resolve_language({ account: "es", navigator_languages: browser }), "FR");
	assert.equal(i18n.resolve_language({ account: "ES", navigator_languages: ["de-DE"] }), "EN");
	assert.equal(i18n.resolve_language({ selected: "pt", navigator_languages: browser }), "FR");
	// the browser: the first of its languages that we have, EN when none
	assert.equal(i18n.resolve_language({ navigator_languages: browser }), "FR");
	assert.equal(i18n.resolve_language({ navigator_languages: ["fr-CA", "en"] }), "FR");
	assert.equal(i18n.resolve_language({ navigator_languages: ["ja-JP", "zh"] }), "EN");
	assert.equal(i18n.resolve_language({ account: "XX", navigator_languages: [] }), "EN");
	assert.equal(i18n.language_from_browser(["EN-us"]), "EN");
	assert.equal(i18n.language_from_browser(undefined), "EN");
});
test("no catalog for the language asked: English is read, and the news follow what was asked", async () => {
	const fetched = globalThis.fetch;
	globalThis.fetch = async (url) => {
		const name = String(url).replace("i18n/", "");
		if (name === "en.json" || name === "fr.json") return { ok: true, json: async () => JSON.parse(readFileSync(join(src, "i18n", name), "utf8")) };
		return { ok: false, json: async () => { throw new Error("404"); } };
	};
	try {
		i18n.use_catalog({});   // nothing read yet: the English catalog is the fallback that is read first
		assert.equal(await i18n.set_language("fr"), "fr");
		assert.equal(i18n.t("common.language_label"), "Langue:");
		assert.equal(await i18n.set_language("es"), "en");
		assert.equal(i18n.requested_language(), "es");
		assert.equal(i18n.t("common.language_label"), "Language:");
		assert.equal(i18n.locale(), "en-GB");
		assert.equal(i18n.date_short(new Date(2026, 9, 8)), "8 Oct");
		assert.equal(await i18n.set_language("en"), "en");
	}
	finally {
		globalThis.fetch = fetched;
		i18n.use_catalog(catalog, "fr");
	}
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
	if (file.endsWith(".js")) for (const m of text.matchAll(/"((?:timeline|settings|auth|register|recover|verify_email|captcha|compat|common|calendar|meta)\.[A-Za-z_0-9.]+)"/g)) used.add(m[1]);
}
// keys the code builds from a variable part: the catalog keeps them together under these prefixes
const built = ["verify_email.page."];
const comment = (key) => key.endsWith("._comment");

const catalogs = { "fr.json": catalog, "en.json": english };
for (const [name, content] of Object.entries(catalogs)) {
	test(`every key used by the code or the markup is in ${name}`, () => {
		const missing = [...used].filter((key) => !(key in content) && !used_prefixes.has(key + ".") && !built.includes(key));
		assert.deepEqual(missing, []);
	});
	test(`${name} holds no key that nothing uses`, () => {
		const unused = Object.keys(content).filter((key) => !comment(key) && !used.has(key) && ![...used_prefixes, ...built].some((prefix) => key.startsWith(prefix)));
		assert.deepEqual(unused, []);
	});
	test(`every _comment of ${name} explains a key that exists`, () => {
		const orphans = Object.keys(content).filter((key) => comment(key) && !(key.slice(0, -"._comment".length) in content));
		assert.deepEqual(orphans, []);
	});
	test(`no string of ${name} holds markup`, () => {
		const html = Object.entries(content).filter(([key, value]) => !comment(key) && JSON.stringify(value).match(/<[a-z\/]/i));
		assert.deepEqual(html.map(([key]) => key), []);
	});
}
test("English and French hold the same keys, the same {placeholders}, and lists of the same length", () => {
	assert.deepEqual(Object.keys(english).filter((key) => !(key in catalog)), []);
	assert.deepEqual(Object.keys(catalog).filter((key) => !(key in english)), []);
	const names = (value) => [...new Set(JSON.stringify(value).match(/\{[a-z_0-9]+\}/g) || [])].sort();
	const differing = Object.keys(catalog).filter((key) => !comment(key) && JSON.stringify(names(catalog[key])) !== JSON.stringify(names(english[key])));
	assert.deepEqual(differing, []);
	const lists = Object.keys(catalog).filter((key) => Array.isArray(catalog[key]) && catalog[key].length !== english[key].length);
	assert.deepEqual(lists, []);
});

test("news: the item of the language, else the French one", async () => {
	const { moncycle_news } = await import("/js/services/news.js");
	const now = new Date().toISOString();
	const item = (title) => ({ title, description: "d", url: "https://example.org/a", pubDate: now });
	const news = { fr: item("Bonjour"), en: item("Hello") };
	assert.equal(moncycle_news.item(news, "en").title, "Hello");
	assert.equal(moncycle_news.item(news, "de").title, "Bonjour");
	assert.equal(moncycle_news.item(news).title, "Bonjour");
	assert.equal(moncycle_news.item({ fr: item("Bonjour"), en: null }, "en"), null);
});
