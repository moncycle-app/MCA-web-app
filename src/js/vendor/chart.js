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

/* Chart.js (its UMD build, vendor/chart.js) is loaded when a chart is first needed, by a dynamic import, so that the build puts it in a
** chunk of its own. Only the timeline uses it, and only for the methods that take a temperature. load_chart() resolves with the Chart class:
** served as it is (src/), the UMD file sets globalThis.Chart; bundled (dist/), it is wrapped as CommonJS and the class is its default export. */
let loading = null;

export function load_chart() {
	if (!loading) {
		loading = import("../../vendor/chart.js")
			.then((module) => globalThis.Chart || module.default)
			.catch((error) => { loading = null; throw error; });
	}
	return loading;
}
