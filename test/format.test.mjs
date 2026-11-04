// What a person reads and types, as the settings of the account ask: Celsius and Fahrenheit, and the optional settings
// of the copy (the value, the default, a reset with null, the account of an answer of POST /account). Display only: the API carries ISO dates
// and Celsius. The dates a person reads (compact and long) are words of the catalog, in the order of the account's `dateOrder`.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { install } from "./support/browser_stub.mjs";
import { install_fake_api } from "./support/fake_api.mjs";

install();
install_fake_api();
const catalog = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`../src/i18n/${name}.json`, import.meta.url)), "utf8"));
const i18n = await import("/js/core/i18n.js");
const { moncycle_store: store } = await import("/js/model/store.js");
const format = await import("/js/model/format.js");
const { day_to_api, day_from_api } = await import("/js/model/day.js");
const { constante_from_api, structure_of, account_setting } = await import("/js/model/cycles.js");

const setting = (value, is_set = true, standard = value) => ({ value, isSet: is_set, default: standard });
function account(settings = {}) {
	return { userId: 7, nickname: "T", method: "cervicalMucus", temperatureTracking: true, language: "FR", allCyclesFirstDay: [], allObservationPausedDates: [], customSettings: {}, settings: {
		timelineAscending: setting(true, false), autoMailExport: setting(false, false), dayBackgroundColor: setting(true, false),
		dateFormat: setting("DMY_SLASH", false), dateOrder: setting("DAY_FIRST", false), temperatureUnit: setting("C", false), notificationEmails: setting("", false), ...settings } };
}
beforeEach(() => {
	localStorage.clear();
	store.listeners = {};
	store.account = account();
});

test("the compact date: weekday initial, day, month on 3 letters; the year only when it is not the current one", () => {
	const year = new Date().getFullYear();
	i18n.use_catalog(catalog("fr"), "fr");
	assert.match(format.date_compact(new Date(year, 10, 3)), /^. 3 NOV$/);
	assert.equal(format.date_compact(new Date(2026, 10, 3)), year === 2026 ? "M 3 NOV" : "M 3 NOV 26");
	assert.equal(format.date_compact(new Date(year - 1, 1, 9), false), "9 FÉV " + String(year - 1).slice(-2));
	assert.equal(format.date_compact(new Date(year, 0, 1), false), "1 JAN");   // the 1st is a number here, "1er" is for the long date
	i18n.use_catalog(catalog("en"), "en");
	assert.match(format.date_compact(new Date(year, 11, 25)), /^[SMTWF] 25 DEC$/);
});

test("the compact date follows the account's order, not the language's", () => {
	const year = new Date().getFullYear();
	const day = new Date(year - 1, 10, 3);
	for (const language of ["fr", "en"]) {
		i18n.use_catalog(catalog(language), language);
		store.account = account({ dateOrder: setting("MONTH_FIRST") });
		assert.match(format.date_compact(day), new RegExp(`^. NOV 3, ${String(year - 1).slice(-2)}$`), language);
		assert.match(format.date_compact(day, false, "DAY_FIRST"), /^3 NOV \d\d$/, language);   // an explicit order wins over the account's
		store.account = account();
		assert.match(format.date_compact(day), /^. 3 NOV \d\d$/, language);
	}
});

test("the long date: whole words, always the year, a capital on the weekday", () => {
	const day = new Date(2026, 10, 3);
	i18n.use_catalog(catalog("fr"), "fr");
	assert.equal(format.date_long(day), "Mardi 3 novembre 2026");
	assert.equal(format.date_long(new Date(2026, 11, 1)), "Mardi 1er décembre 2026");
	store.account = account({ dateOrder: setting("MONTH_FIRST") });
	assert.equal(format.date_long(day), "Mardi novembre 3, 2026");
	i18n.use_catalog(catalog("en"), "en");
	assert.equal(format.date_long(day), "Tuesday, November 3, 2026");
	store.account = account();
	assert.equal(format.date_long(day), "Tuesday 3 November 2026");
	assert.equal(format.date_long(new Date(2025, 0, 1)), "Wednesday 1 January 2025");
});

test("temperatures: Celsius and Fahrenheit, the round trip", () => {
	assert.equal(format.format_temperature(36.5), "36.5");
	store.account = account({ temperatureUnit: setting("F") });
	assert.equal(format.temperature_unit(), "F");
	assert.equal(format.format_temperature(36.5), "97.7");
	assert.equal(format.format_temperature(null), "");
	assert.equal(format.parse_temperature("97,7"), 36.5);
	assert.ok(Number.isNaN(format.parse_temperature("hot")));
	// every tenth of a degree F shown comes back as itself
	for (let tenth = 950; tenth <= 1050; tenth++) {
		const shown = tenth / 10;
		assert.equal(Number(format.format_temperature(format.parse_temperature(String(shown)))), shown);
	}
});

test("a temperature typed in Fahrenheit is sent in Celsius, to two decimals", () => {
	const fields = (temp) => [{ name: "date", value: "2026-03-10" }, { name: "temp", value: temp }];
	assert.equal(day_to_api(fields("97.7"), [], "F").temperature, 36.5);
	assert.equal(day_to_api(fields("98.6"), [], "F").temperature, 37);
	assert.equal(day_to_api(fields("98.1"), [], "F").temperature, 36.72);
	assert.equal(day_to_api(fields("36.55"), []).temperature, 36.55);   // Celsius is sent as typed
	assert.equal(day_to_api(fields(""), [], "F").temperature, null);
	// and the copy keeps Celsius: reading the day back gives it unchanged
	assert.equal(day_from_api({ date: "2026-03-10", temperature: 36.72, freeMucusObservation: [], freeMucusSensation: [], freeOther: [] }, []).temperature, 36.72);
});

test("settings: the value, the default, and a reset with null", () => {
	assert.equal(store.setting("dayBackgroundColor"), true);
	const before = store.set_setting("dayBackgroundColor", false);
	assert.equal(store.setting("dayBackgroundColor"), false);
	assert.deepEqual(store.account.settings.dayBackgroundColor, { value: false, isSet: true, default: true });
	assert.equal(constante_from_api(store.account).day_background_color, false);
	// the server refused: back to what it was
	store.restore_setting("dayBackgroundColor", before);
	assert.deepEqual(store.account.settings.dayBackgroundColor, { value: true, isSet: false, default: true });
	// a reset (null) goes back to the default, not set
	store.set_setting("temperatureUnit", "F");
	assert.equal(store.setting("temperatureUnit"), "F");
	store.set_setting("temperatureUnit", null);
	assert.deepEqual(store.account.settings.temperatureUnit, { value: "C", isSet: false, default: "C" });
	// a copy made before a setting existed answers the built-in default
	delete store.account.settings.dateOrder;
	assert.equal(store.setting("dateOrder"), "DAY_FIRST");
	assert.equal(account_setting(null, "temperatureUnit"), "C");
});

test("settings: each optional setting makes a round trip through the copy", () => {
	const values = { timelineAscending: false, autoMailExport: true, dayBackgroundColor: false, dateOrder: "MONTH_FIRST", temperatureUnit: "F", notificationEmails: "a@b.fr;c@d.fr" };
	for (const [name, value] of Object.entries(values)) {
		store.set_setting(name, value);
		assert.equal(store.setting(name), value, name);
		assert.equal(JSON.parse(localStorage.getItem("data_account")).settings[name].value, value, name);
		store.set_setting(name, null);
		assert.equal(store.account.settings[name].isSet, false, name);
		assert.equal(store.setting(name), store.account.settings[name].default, name);
	}
});

test("the timeline reads its order, and redraws when a format changes", () => {
	assert.equal(constante_from_api(account({ timelineAscending: setting(false) })).timeline_asc, false);
	const base = structure_of(account());
	assert.notEqual(structure_of(account({ timelineAscending: setting(false) })), base);
	assert.notEqual(structure_of(account({ dateOrder: setting("MONTH_FIRST") })), base);
	assert.notEqual(structure_of(account({ temperatureUnit: setting("F") })), base);
	assert.equal(structure_of(account({ dayBackgroundColor: setting(false) })), base);   // the colour is only the header's business
});

test("an answer of POST /account replaces the account of the copy, which keeps its lists and the news address", () => {
	store.account = { ...account(), allCyclesFirstDay: ["2026-03-01"], allObservationPausedDates: ["2026-03-05"], newsUrl: "https://news.example/n.json", customSettings: { "app.x": 1 } };
	store.account_saved({ ...account({ temperatureUnit: setting("F") }), nickname: "New", customSettings: { "app.x": 2 } });
	assert.equal(store.account.nickname, "New");
	assert.equal(store.setting("temperatureUnit"), "F");
	assert.deepEqual(store.account.allCyclesFirstDay, ["2026-03-01"]);
	assert.equal(store.account.newsUrl, "https://news.example/n.json");
});
