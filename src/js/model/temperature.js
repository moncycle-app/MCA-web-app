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

/* Celsius and Fahrenheit. The API and the local copy always carry Celsius; a person reads and types the unit of the account (`temperatureUnit`).
** Pure functions: model/format.js adds the account's unit. */

const round = (value, decimals) => Math.round(value * 10 ** decimals) / 10 ** decimals;

// Celsius -> the number of the unit: Fahrenheit on one decimal, Celsius as it is stored (two at most)
export function to_unit(celsius, unit = "C") {
	return unit === "F" ? round(celsius * 9 / 5 + 32, 1) : round(celsius, 2);
}
// a number of the unit -> Celsius on two decimals, what the API wants
export function to_celsius(value, unit = "C") {
	return round(unit === "F" ? (value - 32) * 5 / 9 : value, 2);
}
