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

/* Does this web app work with that API? The API tells its generation in `appVersion` (GET /server_info: "16", "16dev", "v16"); the
** web app declares, in version.json, the range of generations it was tested with: api {min, max}. A plain script that needs nothing,
** so that the build and the tests can load it too.
*/
export const moncycle_compat = {
	// the generation as a number, or null when the text is not one (a git describe form, nothing)
	parse : function (api_version) {
		const found = /^v?(\d+)(dev)?$/.exec(typeof api_version === "string" ? api_version.trim() : "");
		return found ? parseInt(found[1], 10) : null;
	},
	// "compatible", "incompatible", or "unknown" (no readable generation or range: never a reason to block)
	check : function (range, api_version) {
		const generation = moncycle_compat.parse(api_version);
		if (generation === null || !range || !Number.isInteger(range.min) || !Number.isInteger(range.max)) return "unknown";
		return generation >= range.min && generation <= range.max ? "compatible" : "incompatible";
	},
};

