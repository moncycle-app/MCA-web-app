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

import { moncycle_store } from "./store.js";
import { t, t_list } from "../core/i18n.js";
import * as dates from "./dates.js";
import { to_unit, to_celsius } from "./temperature.js";

/* What a person reads and types: dates and temperatures, as the settings of the account ask (`dateFormat`, `temperatureUnit`).
** Display only: the API and the local copy carry ISO dates (YYYY-MM-DD) and Celsius. */

// the seven formats of the API: the order of the parts, the separator
export const DATE_FORMATS = {
	DMY_SLASH : {order : "DMY", separator : "/"},
	DMY_DOT : {order : "DMY", separator : "."},
	DMY_DASH : {order : "DMY", separator : "-"},
	MDY_SLASH : {order : "MDY", separator : "/"},
	YMD_DASH : {order : "YMD", separator : "-"},
	YMD_SLASH : {order : "YMD", separator : "/"},
	YMD_DOT : {order : "YMD", separator : "."},
};

function date_format_of(name) {
	return DATE_FORMATS[name] || DATE_FORMATS[moncycle_store.setting("dateFormat")] || DATE_FORMATS.DMY_SLASH;
}

// "2026-12-31" -> "31/12/26" (the year on two digits); what is not an ISO date is returned as it is. `format` is a name of DATE_FORMATS (the
// account's by default).
export function format_date(iso, format) {
	const found = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof iso === "string" ? iso : "");
	if (!found) return String(iso ?? "");
	const parts = {Y : found[1].slice(2), M : found[2], D : found[3]};
	const one = date_format_of(format);
	return [...one.order].map((letter) => parts[letter]).join(one.separator);
}

// "31/12/26" -> "2026-12-31", null when it is not a date of that format. The separator may be any of . / - (or a space); the year has two
// digits (20xx) or four.
export function parse_date(text, format) {
	const one = date_format_of(format);
	const found = /^(\d{1,4})\D(\d{1,2})\D(\d{1,4})$/.exec(String(text).trim());
	if (!found) return null;
	const parts = {};
	[...one.order].forEach((letter, i) => { parts[letter] = found[i + 1]; });
	if (parts.Y.length === 3 || (one.order[0] === "Y" ? found[1] : found[3]).length > 4) return null;
	const year = parts.Y.length === 2 ? 2000 + Number(parts.Y) : Number(parts.Y);
	const month = Number(parts.M), day = Number(parts.D);
	const check = new Date(Date.UTC(year, month - 1, day));
	if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
	return [String(year).padStart(4, "0"), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

// the same date as a person reads it in a text field, for a field that takes it back with parse_date
export const date_placeholder = (format) => {
	const one = date_format_of(format);
	const names = {D : t("calendar.part_d"), M : t("calendar.part_m"), Y : t("calendar.part_y")};
	return [...one.order].map((letter) => names[letter]).join(one.separator);
};

// "L 31/12/26": the weekday's initial and the date, the heading of a timeline row
export function date_row(date) {
	return t("calendar.date_row", {weekday_initial : t_list("calendar.weekdays")[date.getDay()][0], date : format_date(dates.str(date))});
}
// "Thursday 31/12/26"
export function date_long(date) {
	return t("calendar.date_long", {weekday : t_list("calendar.weekdays")[date.getDay()], date : format_date(dates.str(date))});
}

/* --- temperatures: always Celsius in the API and the copy -------------------- */

export function temperature_unit() {
	return moncycle_store.setting("temperatureUnit") === "F" ? "F" : "C";
}

// "36.5" ("97.7" in Fahrenheit), the way a field of type number takes it; "" when there is no temperature
export function format_temperature(celsius, unit = temperature_unit()) {
	return celsius === null || celsius === undefined || celsius === "" || isNaN(celsius) ? "" : String(to_unit(Number(celsius), unit));
}
// what a person typed ("97,7" or "97.7") -> Celsius, NaN when it is not a number
export function parse_temperature(text, unit = temperature_unit()) {
	const value = parseFloat(String(text).trim().replace(",", "."));
	return isNaN(value) ? NaN : to_celsius(value, unit);
}
