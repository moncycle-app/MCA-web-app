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
import { t, t_list, t_node } from "../core/i18n.js";
import { to_unit, to_celsius } from "./temperature.js";

/* What a person reads: dates and temperatures, as the settings of the account ask (`dateOrder`, `temperatureUnit`).
** Display only: the API and the local copy carry ISO dates (YYYY-MM-DD) and Celsius. */

/* --- the dates: compact and long -------------------------------------------- */
// No numeric date is shown: the weekday and the month are words of the catalog, and the order of the day and the month is the account's
// `dateOrder`, not the language's habit. (A date field of a form is the browser's own, and answers ISO.)

// `order` is a code of `dateOrder`; the account's when it is not given
function month_first(order) {
	return (order || moncycle_store.setting("dateOrder")) === "MONTH_FIRST";
}

// "Tuesday": the weekday of a Date, with a capital
export function weekday_name(date) {
	const name = t_list("calendar.weekdays")[date.getDay()];
	return name.charAt(0).toUpperCase() + name.slice(1);
}

// "M 3 NOV" / "T NOV 3": the weekday's initial, the day, the month on 3 letters; "M 3 NOV 25" / "T NOV 3, 25" when the year is not the current
// one. `with_weekday` false leaves the initial out (inside a sentence).
export function date_compact(date, with_weekday = true, order = null) {
	const month = t_list("calendar.months_short")[date.getMonth()].toUpperCase();
	const first = month_first(order);
	let text = first ? `${month} ${date.getDate()}` : `${date.getDate()} ${month}`;
	if (date.getFullYear() !== new Date().getFullYear()) text += (first ? ", " : " ") + String(date.getFullYear()).slice(-2);
	return with_weekday ? `${weekday_name(date).charAt(0)} ${text}` : text;
}

// "Tuesday 3 November 2026" / "Tuesday, November 3, 2026": the year is always there. `weekday` replaces the weekday's text with a node
// (t_node) when a screen styles it.
function long_slots(date) {
	return {
		weekday : weekday_name(date),
		day : date.getDate() === 1 ? t("calendar.day_one") : String(date.getDate()),
		month : t_list("calendar.months")[date.getMonth()],
		year : String(date.getFullYear()),
	};
}
export function date_long(date) {
	return month_first() ? t("calendar.date_long_month_first", long_slots(date)) : t("calendar.date_long_day_first", long_slots(date));
}
export function date_long_node(date, weekday_node) {
	const slots = {...long_slots(date), weekday : weekday_node};
	return month_first() ? t_node("calendar.date_long_month_first", slots) : t_node("calendar.date_long_day_first", slots);
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
