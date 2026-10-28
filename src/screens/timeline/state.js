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

/* What the timeline keeps while it is on screen: the account and the days it draws from the local copy (js/model/store.js), the cycles
** loaded so far, the peak days and counters its marks come from. reset_state() empties it when the screen is mounted. */
export const state = {};

export function reset_state() {
	for (const key of Object.keys(state)) delete state[key];
	Object.assign(state, {
	stamp_class : {
		"R"  : "rouge",
		"G"  : "vert",
		"Y"  : "jaune",
		"BB" : "baby",
	},
	arrow_id : {
		"↓" : "b",
		"↑" : "h",
		"→" : "d",
		"←" : "g",
		""  : ""
	},

	sommets : [],
	counter_starts : {},
	page_a_recharger: false,
	graph_data : {},
	graphs : {},
	cycle_curseur : 0,
	date_loaded: null,
	constante : {},
	description : [],
	day_timeline : {},
	timeline_asc : true,
	// what the cycles drawn were made from (see structure_of): when the copy says otherwise, they are drawn again
	structure : null,
	cycle_columns : 35,

	mini_maxi : "mini",
	// The news banner: the French item of the news file (js/news.js), once per page. "OK merci" hides the article whose link it was
	// clicked on, so a new article shows again.
	news_requested : false,
	// a save less than this long ago reads "maintenant"
	last_write_recent_ms : 2 * 60 * 1000,
	last_write_timer : null,
	form_nouveau_cycle_active: false,
	cycle_title_opened : null,
	// container holding the chips for each description type: 2=sensation, 1=observation, 0=autre (legacy)
	desc_container_id : {2 : "#menu_sensation_container", 1 : "#menu_observation_container", 0 : "#menu_autre_container"},
	desc_chip_count : 0,
	menu_opened_date : null
	});
}
reset_state();
