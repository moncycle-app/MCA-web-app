/* moncycle.app
**
** Copyright (C) 2021-2026 Tech 4 Fertility, aka. T4F (https://tech4fertility.org)
** SPDX-License-Identifier: AGPL-3.0-or-later
**
** This program is free software: you can redistribute it and/or modify it under
** the terms of the GNU Affero General Public License as published by the Free
** Software Foundation, either version 3 of the License, or (at your option) any
** later version. It is distributed WITHOUT ANY WARRANTY; see the licence for details.
**
** https://www.moncycle.app
** https://github.com/moncycle-app/backend-api-web-app
*/

/* Every text a person reads comes from a catalog (src/i18n/<language>.json) through this module, and nothing else holds French (or any
** language). See src/i18n/README.md.
**
**  t(key, vars)         plain text; {name} is replaced by vars.name; a value {"one": "...", "other": "..."} is chosen from vars.count
**  t_list(key)          an array of the catalog (the months, the weekdays)
**  t_node(key, slots)   a DocumentFragment: the text of the key, where {name} is replaced by the node slots.name (markup inside a sentence)
**  apply(root)          fills the static markup: data-i18n="key" sets the text (a child with data-slot="name" stands for {name} of the key),
**                       data-i18n-attr="placeholder:key;title:key" sets attributes
**  set_language(code)   changes the language of the catalog, then call apply() again
**
** French is the only catalog that ships, and the fallback for a language with no catalog and for a key missing from one. A key missing from
** every catalog is warned about once in the console and shown as itself. Dates keep today's output (the names and the layouts are
** catalog entries; Intl.DateTimeFormat would write "janv." for "jan"), numbers use Intl.NumberFormat with the catalog's "meta.locale".
*/


export const API_LANGUAGES = ["EN", "FR", "ES", "DE", "IT", "PL", "PT"];
export const FALLBACK = "fr";

let fallback_catalog = {};
let catalog = {};
let language = FALLBACK;   // the catalog actually used
const warned = new Set();

export function current_language() { return language; }
export function locale() { return String(catalog["meta.locale"] || fallback_catalog["meta.locale"] || "fr-FR"); }

async function fetch_catalog(code) {
	try {
		const response = await fetch("/i18n/" + code + ".json", {credentials: "omit"});
		return response.ok ? await response.json() : null;
	}
	catch (e) { return null; }
}

// Reads the French catalog (fallback), then the one of the language when it has one. Resolves with the language used.
export async function load(code = FALLBACK) {
	const wanted = String(code).toLowerCase();
	if (Object.keys(fallback_catalog).length === 0) {
		fallback_catalog = (await fetch_catalog(FALLBACK)) || {};
		catalog = fallback_catalog;
		if (Object.keys(fallback_catalog).length === 0) console.error("i18n: the French catalog could not be read");
	}
	if (wanted !== FALLBACK) {
		const other = await fetch_catalog(wanted);
		if (other) { catalog = other; language = wanted; }
		else { catalog = fallback_catalog; language = FALLBACK; }
	}
	else {
		catalog = fallback_catalog;
		language = FALLBACK;
	}
	if (typeof document !== "undefined" && document.documentElement) document.documentElement.lang = language;
	return language;
}
// The catalog given as an object (tests): it is the French one
export function use_catalog(object, code = FALLBACK) {
	fallback_catalog = object;
	catalog = object;
	language = code;
}
export async function set_language(code) { return load(code); }

// The language of the interface: the account's (once signed in), then the register select, then the first of navigator.languages that
// the API knows, else EN. Returns an API code ("FR").
export function resolve_language({account = null, selected = null, navigator_languages = []} = {}) {
	for (const code of [account, selected]) {
		if (code && API_LANGUAGES.includes(String(code).toUpperCase())) return String(code).toUpperCase();
	}
	return language_from_browser(navigator_languages);
}
// the first entry of navigator.languages whose 2-letter prefix is a language of the API, case-insensitive; EN when none is
export function language_from_browser(navigator_languages) {
	for (const entry of navigator_languages || []) {
		const code = String(entry).slice(0, 2).toUpperCase();
		if (API_LANGUAGES.includes(code)) return code;
	}
	return "EN";
}

function lookup(key) {
	if (key in catalog) return catalog[key];
	if (key in fallback_catalog) return fallback_catalog[key];
	if (!warned.has(key)) {
		warned.add(key);
		console.warn("i18n: missing key " + key);
	}
	return undefined;
}

function fill(text, vars) {
	return text.replace(/\{([a-z_0-9]+)\}/g, (whole, name) => (vars && name in vars ? String(vars[name]) : whole));
}

export function t(key, vars) {
	let value = lookup(key);
	if (value === undefined) return key;
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		const rule = new Intl.PluralRules(locale()).select(Number(vars && vars.count));
		value = value[rule] ?? value.other;
	}
	return typeof value === "string" ? fill(value, vars) : key;
}
// The entries under a prefix, as an object: t_map("settings.export_errors") gives {no_data_in_period: "...", ...} (a lookup by error code)
export function t_map(prefix) {
	const map = {};
	const keys = new Set([...Object.keys(fallback_catalog), ...Object.keys(catalog)]);
	keys.forEach((key) => {
		if (key.startsWith(prefix + ".") && !key.endsWith("._comment")) {
			const value = lookup(key);
			if (typeof value === "string") map[key.slice(prefix.length + 1)] = value;
		}
	});
	return map;
}
export function t_list(key) {
	const value = lookup(key);
	return Array.isArray(value) ? value : [];
}
export function t_node(key, slots = {}) {
	const fragment = document.createDocumentFragment();
	const text = t(key);
	const pattern = /\{([a-z_0-9]+)\}/g;
	const used = new Set();
	let from = 0;
	let found;
	while ((found = pattern.exec(text)) !== null) {
		if (found.index > from) fragment.append(text.slice(from, found.index));
		const slot = slots[found[1]];
		if (slot === undefined) fragment.append(found[0]);
		else if (typeof slot === "string" || !used.has(found[1])) fragment.append(slot);   // a string becomes a text node
		else fragment.append(slot.cloneNode(true));   // a node put there before: a copy
		used.add(found[1]);
		from = found.index + found[0].length;
	}
	if (from < text.length) fragment.append(text.slice(from));
	return fragment;
}

// The static markup of a screen (or of the whole page). A key with {name} in it takes the child that has data-slot="name".
export function apply(root = document) {
	root.querySelectorAll("[data-i18n]").forEach((element) => {
		const key = element.dataset.i18n;
		const slots = {};
		element.querySelectorAll(":scope > [data-slot]").forEach((child) => { slots[child.dataset.slot] = child; });
		if (Object.keys(slots).length === 0) element.textContent = t(key);
		else element.replaceChildren(t_node(key, slots));
	});
	root.querySelectorAll("[data-i18n-attr]").forEach((element) => {
		element.dataset.i18nAttr.split(";").forEach((pair) => {
			const at = pair.indexOf(":");
			if (at > 0) element.setAttribute(pair.slice(0, at).trim(), t(pair.slice(at + 1).trim()));
		});
	});
}

// Numbers as a person writes them (36,5 in French)
export function format_number(value, options) {
	return new Intl.NumberFormat(locale(), options).format(value);
}
// The number of a field typed by a person ("36,5" or "36.5") -> a number, NaN when it is not one
export function parse_number(text) {
	return parseFloat(String(text).trim().replace(",", "."));
}

/* --- dates: the names and the layouts are catalog entries ------------------ */
export function date_short(d) {
	return t("calendar.date_short", {day: d.getDate(), month: t_list("calendar.months_short")[d.getMonth()]});
}
export function date_long(d) {
	return t("calendar.date_long", {weekday: t_list("calendar.weekdays")[d.getDay()], day: d.getDate(), month: t_list("calendar.months_long")[d.getMonth()], year: d.getFullYear()});
}
// heading of a timeline row: weekday initial + short date
export function date_row(d) {
	return t("calendar.date_row", {weekday_initial: t_list("calendar.weekdays")[d.getDay()][0], day: d.getDate(), month: t_list("calendar.months_short")[d.getMonth()]});
}
export function clock(d) {
	return t("calendar.clock", {hh: String(d.getHours()).padStart(2, "0"), mm: String(d.getMinutes()).padStart(2, "0")});
}

// The catalog is read when a page loads (no jQuery in the unit tests): a page's module starts with `await i18n_ready`, so that its own code
// runs once the catalog is there and the static markup is filled.
export let ready = Promise.resolve();
if (typeof document !== "undefined" && document.documentElement && globalThis.location) {
	ready = load(FALLBACK).then(() => { apply(document); });
}
