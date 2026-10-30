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

/* Chart.js (its UMD build, /vendor/chart.js) is loaded when a chart is first needed, with a <script> tag added once. Only the timeline uses it,
** and only for the methods that take a temperature. load_chart() resolves with the Chart class. */
let loading = null;

export function load_chart() {
	if (globalThis.Chart) return Promise.resolve(globalThis.Chart);
	if (!loading) {
		loading = new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = "/vendor/chart.js";
			script.addEventListener("load", () => resolve(globalThis.Chart));
			script.addEventListener("error", () => { loading = null; reject(new Error("chart.js not loaded")); });
			document.head.append(script);
		});
	}
	return loading;
}
