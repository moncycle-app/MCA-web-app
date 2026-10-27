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
	// The French notice that stops the app: what the web app and the server are, and nothing is sent, dropped or erased.
	notice_text : function (detail) {
		const range = detail.range.min === detail.range.max ? "la version " + detail.range.min : "les versions " + detail.range.min + " à " + detail.range.max;
		return "Cette version de l'application (" + detail.webapp + ") fonctionne avec " + range + " du serveur, qui est en version " + detail.api + ". " +
			"Par prudence, rien n'est envoyé au serveur et rien n'est effacé de cet appareil : vos modifications en attente sont conservées. " +
			"Utilisez la version de l'application prévue pour ce serveur, ou mettez-la à jour.";
	},
	show_notice : function (detail) {
		if (typeof document === "undefined" || document.getElementById("compat_notice")) return;
		const notice = document.createElement("div");
		notice.id = "compat_notice";
		notice.className = "compat_notice";
		notice.setAttribute("role", "alert");
		notice.appendChild(document.createTextNode(moncycle_compat.notice_text(detail)));
		document.body.insertBefore(notice, document.body.firstChild);
	},
};

