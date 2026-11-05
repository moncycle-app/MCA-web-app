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
import * as dates from "../../js/model/dates.js";
import { t, t_map } from "../../js/core/i18n.js";
import { el } from "../../js/core/dom.js";
import { cycle_option, cycle_title_click, cycle_title_node } from "./cycle_view.js";
import { open_menu } from "./day_form.js";
import { state } from "./state.js";

export function cycle2recap(c, nb, fin) {
	let c_id = "rc-" + c;
	let c_date = dates.parse(c);
	let c_fin = new Date(fin);
	let c_title = el("h5", {class: `title title_${c}`, for: c}, cycle_title_node("timeline.cycle_title_recap", "timeline.cycle_title_recap_end", c_date, c_fin, nb));
	c_title.addEventListener("click", cycle_title_click);
	let c_ruler = el("div", {id: "ruler_" + c, class: "mini_ruler"});
	c_ruler.style.display = "none";
	let odd = true;
	for (let n=1; n<=state.cycle_columns; n++) {
		c_ruler.append(el("span", {class: odd ? "odd" : null, text: String(n)}));
		odd = !odd;
	}
	return el("div", {id: c_id, class: "cycle_recap"},
		el("div", {class: "cycle_head"}, c_title, cycle_option(c, dates.str(fin), "recap")),
		c_ruler,
		el("div", {id: "rc_contenu_" + c, class: "contenu"}));
}

export function day_timeline2recap(j) {
	let o_date = dates.parse(j.date_obs);
	let o_id = "ro-" + dates.str(o_date);
	let o_class = "obs";
	if (j.observation_paused) o_class += " o_paused";
	let day_timeline = el("div", {id: o_id, class: o_class, date: dates.str(o_date)});
	day_timeline.addEventListener("click", open_menu);
	let color = "empty";
	let stamp_code = j.stamp;
	let baby = (j.stamp == "BB");
	if (j.stamp && j.stamp.includes("BB") && j.stamp.length>2) {
		color = state.stamp_class["BB"];
		stamp_code = stamp_code.replace("BB", "");
		baby = true;
	}
	if (state.stamp_class[stamp_code]) color = state.stamp_class[stamp_code];
	let middle_glyph = baby ? t_map("timeline.stamp_glyph")["BB"] : "";
	let bottom_glyph = j.union_sex ? t("timeline.union") : "";
	if (j.err && j.err.includes("no data")) middle_glyph = t("timeline.to_fill_in_glyph");
	const fc_method = state.constante.nfp_method==3 || state.constante.nfp_method==4;
	// the flow goes in the square, unless the baby is there: then it goes with the letters
	let flow = fc_method && j.fc_score ? j.fc_flow ?? "" : "";
	if (middle_glyph == "") {
		middle_glyph = flow;
		flow = "";
	}
	if (j.observation_paused) {
		color = "pink";
		middle_glyph = t("timeline.observation_paused_stamp_glyph");
		bottom_glyph = "";
	}
	if (j.day_not_observed) {
		middle_glyph = t("timeline.not_observed_glyph");
		color = "not_observed";
	}
	if (middle_glyph=="" && j.stamp=="") middle_glyph = t("timeline.to_fill_in_glyph");
	day_timeline.append(el("span", {class: "s", text: j.is_peak ? t("timeline.peak_mucus") : ""}));
	if (state.constante.nfp_method==1 || state.constante.nfp_method==2) day_timeline.append(el("span", {class: "n"}));
	day_timeline.append(el("span", {class: `g ${color}`, text: middle_glyph}));
	if (fc_method && !j.observation_paused && !j.day_not_observed && j.fc_score){
		const sensation = j.fc_sensation ?? "";
		const stretch = sensation.match(/^\d+/)?.[0] ?? "";
		const letters = flow + sensation.slice(stretch.length) + (j.fc_letters || []).join("");
		day_timeline.append(el("span", {class: "fc", text: stretch}));
		day_timeline.append(el("span", {class: "fc", text: letters.length>2 ? t("timeline.fc_note_overflow") : letters}));
	}
	else if (fc_method) {
		day_timeline.append(el("span", {class: "fc"}));
		day_timeline.append(el("span", {class: "fc"}));
	}
	day_timeline.append(el("span", {class: "c", text: bottom_glyph}));
	return day_timeline;
}

// The "o" cell of a cervical mucus day: observations as they are, sensations in bold, then the
// descriptions with no type yet, struck through (timeline.css). Built with the DOM: a name is free text. <b> and <s> and text nodes on
// purpose, `.day span` styles every span as a cell and `.day span:empty` hides it, so a day with no description keeps an empty cell.
export function description_cell(descriptions) {
	let names_of = (type) => descriptions.filter(d => d.type == type).map(d => d.name);
	let parts = [
		...names_of(1).map(name => document.createTextNode(name)),
		...names_of(2).map(name => el("b", {class: "o_sens", text: name})),
		...names_of(0).map(name => el("s", {class: "o_other", title: t("timeline.desc_legacy_title"), text: name})),
	];
	let cell = el("span", {class: "o pas_fc pas_fc_temp"});
	parts.forEach((part, i) => {
		if (i > 0) cell.append(document.createTextNode(", "));
		cell.append(part);
	});
	return cell;
}
