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

/* The notice that stops the app when the API is out of the range this web app was tested with (see compat.js, store.js): what the web
** app and the server are, and nothing is sent, dropped or erased. */
import { t } from "/js/core/i18n.js";

export function notice_text(detail) {
	const range = detail.range.min === detail.range.max ? t("compat.range_one", {min: detail.range.min}) : t("compat.range_many", {min: detail.range.min, max: detail.range.max});
	return t("compat.notice", {webapp: detail.webapp, range: range, api: detail.api});
}
export function show_notice(detail) {
	if (typeof document === "undefined" || document.getElementById("compat_notice")) return;
	const notice = document.createElement("div");
	notice.id = "compat_notice";
	notice.className = "compat_notice";
	notice.setAttribute("role", "alert");
	notice.appendChild(document.createTextNode(notice_text(detail)));
	document.body.insertBefore(notice, document.body.firstChild);
}
