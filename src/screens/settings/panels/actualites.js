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
import { parse_route } from "../../../js/core/router.js";
import { moncycle_news } from "../../../js/services/news.js";
import { by_id } from "../../../js/core/dom.js";
import { settings_show_panel } from "../settings.js";

// The news of Tech 4 Fertility (js/news.js): the entry of the menu shows only when there is an item. The address #actualites is read again
// once it is there, so that a link to it opens the panel.
export function settings_load_news(url) {
	moncycle_news.load(url).then(function (item) {
		if (!item) return;
		// the screen can be left before the news arrive
		if (!by_id("news_title")) return;
		by_id("news_title").textContent = item.title;
		by_id("news_text").textContent = item.description;
		by_id("but_news_read").onclick = function () { window.open(item.url, "_blank", "noopener,noreferrer"); };
		by_id("menu_actualites").hidden = false;
		if (parse_route(location.hash).sub === "actualites") settings_show_panel();
	});
}
