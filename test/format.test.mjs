// What a person reads and types, as the settings of the account ask: the seven date formats, Celsius and Fahrenheit, and the optional settings
// of the copy (the value, the default, a reset with null, the account of an answer of POST /account). Display only: the API carries ISO dates
// and Celsius.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { install } from "./support/browser_stub.mjs";
import { install_fake_api } from "./support/fake_api.mjs";

install();
install_fake_api();
const { moncycle_store: store } = await import("/js/model/store.js");
const format = await import("/js/model/format.js");
const { day_to_api, day_from_api } = await import("/js/model/day.js");
const { constante_from_api, structure_of, account_setting } = await import("/js/model/cycles.js");

const setting = (value, is_set = true, standard = value) => ({ value, isSet: is_set, default: standard });
function account(settings = {}) {
	return { userId: 7, nickname: "T", method: "cervicalMucus", temperatureTracking: true, language: "FR", allCyclesFirstDay: [], allObservationPausedDates: [], customSettings: {}, settings: {
		timelineAscending: setting(true, false), autoMailExport: setting(false, false), dayBackgroundColor: setting(true, false),
		dateFormat: setting("DMY_SLASH", false), temperatureUnit: setting("C", false), notificationEmails: setting("", false), ...settings } };
}
beforeEach(() => {
	localStorage.clear();
	store.listeners = {};
	store.account = account();
});

const SHOWN = { DMY_SLASH: "31/12/26", DMY_DOT: "31.12.26", DMY_DASH: "31-12-26", MDY_SLASH: "12/31/26", YMD_DASH: "26-12-31", YMD_SLASH: "26/12/31", YMD_DOT: "26.12.31" };

test("dates: the seven formats, written and read back", () => {
	for (const [name, shown] of Object.entries(SHOWN)) {
		assert.equal(format.format_date("2026-12-31", name), shown, name);
		assert.equal(format.parse_date(shown, name), "2026-12-31", name);
	}
	assert.equal(format.parse_date("31/12/2026", "DMY_SLASH"), "2026-12-31");   // four digits are fine too
	assert.equal(format.parse_date("1/2/26", "DMY_SLASH"), "2026-02-01");
});

test("dates: what is not a date is refused, and the account's format is the default", () => {
	for (const text of ["", "31/12", "32/12/26", "29/02/26", "31/13/26", "a/b/c", "31/12/226"]) assert.equal(format.parse_date(text, "DMY_SLASH"), null, text);
	assert.equal(format.parse_date("29/02/28", "DMY_SLASH"), "2028-02-29");
	assert.equal(format.format_date("2026-12-31"), "31/12/26");
	store.account = account({ dateFormat: setting("YMD_DOT") });
	assert.equal(format.format_date("2026-12-31"), "26.12.31");
	assert.equal(format.parse_date("26.12.31"), "2026-12-31");
	assert.equal(format.format_date("nothing"), "nothing");
});

test("dates: unset, the format is the one the server derived from the language (and follows a change of language)", () => {
	store.account = account({ dateFormat: setting("DMY_SLASH", false) });
	assert.equal(format.format_date("2026-12-31"), "31/12/26");
	// POST /account { language: "DE" } answers the whole account, with the default of German
	store.account_saved({ ...account({ dateFormat: setting("DMY_DOT", false, "DMY_DOT") }), language: "DE" });
	assert.equal(format.format_date("2026-12-31"), "31.12.26");
	assert.equal(store.account.settings.dateFormat.isSet, false);
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
	delete store.account.settings.dateFormat;
	assert.equal(store.setting("dateFormat"), "DMY_SLASH");
	assert.equal(account_setting(null, "temperatureUnit"), "C");
});

test("settings: each optional setting makes a round trip through the copy", () => {
	const values = { timelineAscending: false, autoMailExport: true, dayBackgroundColor: false, dateFormat: "YMD_DASH", temperatureUnit: "F", notificationEmails: "a@b.fr;c@d.fr" };
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
	assert.notEqual(structure_of(account({ dateFormat: setting("YMD_DOT") })), base);
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
