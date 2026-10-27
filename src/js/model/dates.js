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

/* ISO dates ("2026-03-10") as the app handles them: a Date held at 9:00 local time (so that a change of hour never moves the day),
** and the moment as the API wants it. No names of months or days, no formatting for a person: that is the catalog's job. */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function now() {
	const date = new Date();
	date.setHours(9, 0, 0, 0);
	return date;
}
export function parse(str) {
	const date = now();
	const parts = str.split(/\D/);
	date.setFullYear(parts[0], parts[1] - 1, parts[2]);
	return date;
}
export function str(date) {
	const month = date.getMonth() + 1;
	const day = date.getDate();
	return [date.getFullYear(), month < 10 ? "0" + month : month, day < 10 ? "0" + day : day].join("-");
}
// the moment as the API wants it (RFC 3339, UTC): 2026-03-10T15:30:45Z
export function now_in_utc() {
	return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}
// the number of days from the first date to the second, both "YYYY-MM-DD" (no time zone involved)
export function days_between(from, to) {
	return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY_MS);
}
