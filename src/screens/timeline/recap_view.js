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

import * as dates from "/js/model/dates.js";
import { t, t_map } from "/js/core/i18n.js";
import { cycle_option, cycle_title_click, cycle_title_node } from "/screens/timeline/cycle_view.js";
import { open_menu } from "/screens/timeline/day_form.js";
import { state } from "/screens/timeline/state.js";

const $ = globalThis.$;

export function cycle2recap(c, nb, fin) {
	let c_id = "rc-" + c;
	let cycle = $("<div>", {id: c_id, class: "cycle_recap"});
	let c_date = dates.parse(c);
	let c_fin = new Date(fin);
	let c_title = $(`<h5 class='title title_${c}' for='${c}'></h5>`).append(cycle_title_node("timeline.cycle_title_recap", "timeline.cycle_title_recap_end", c_date, c_fin, nb));
	c_title.click(cycle_title_click);
	cycle.append(c_title);
	cycle.append(cycle_option(c, dates.str(fin), "recap"));
	let c_ruler = $("<div>", {id: "ruler_" + c, class: "mini_ruler", style: "display:none"});
	let odd = true;
	for (let n=1; n<=state.cycle_columns; n++) {
		let ruler_num = $(`<span>${n}</span>`);
		if (odd) ruler_num.addClass("odd");
		c_ruler.append(ruler_num);
		odd = !odd;
	}
	cycle.append(c_ruler);
	cycle.append($("<div>", {id: "rc_contenu_" + c, class: "contenu"}));
	return cycle;
}

export function day_timeline2recap(j) {
	let o_date = dates.parse(j.date_obs);
	let o_id = "ro-" + dates.str(o_date);
	let o_class = "obs";
	if (j.observation_paused) o_class += " o_paused";
	let day_timeline = $("<div>", {id: o_id, class: o_class, date: dates.str(o_date)});
	day_timeline.click(open_menu);
	let color = "vide";
	let index_couleur = j.stamp;
	let baby = (j.stamp == "BB");
	if (j.stamp && j.stamp.includes("BB") && j.stamp.length>2) {
		color = state.stamp_class["BB"];
		index_couleur = index_couleur.replace("BB", "");
		baby = true;
	}
	if (state.stamp_class[index_couleur]) color = state.stamp_class[index_couleur];
	let car_du_milieu = baby ? t_map("timeline.stamp_glyph")["BB"] : "";
	let car_du_bas = j.union_sex ? t("timeline.union") : "";
	if (j.err && j.err.includes("no data")) car_du_milieu = t("timeline.to_fill_in_glyph");
	let recap_note = j.fc_score;
	if ((state.constante.nfp_method==3 || state.constante.nfp_method==4) && j.fc_score) {
		recap_note = recap_note.toUpperCase();
		recap_note = recap_note.replace('RAP','').replace('LAP','').replace('AD','').replace('AP','').replace('B','');
	}
	else recap_note = "";
	if ((state.constante.nfp_method==3 || state.constante.nfp_method==4) && car_du_milieu == "" && j.fc_score) {
		const should_be_red = ['VL', 'L', 'VH', 'H', 'M'];
		should_be_red.forEach(c => {
			recap_note = recap_note.trim();
			if (recap_note.indexOf(c) == 0) {
				car_du_milieu += c;
				recap_note = recap_note.replace(c,'');
			}
		});
	}
	if (j.observation_paused) {
		color = "pink";
		car_du_milieu = t("timeline.observation_paused_stamp_glyph");
		car_du_bas = "";
	}
	if (j.day_not_observed) {
		car_du_milieu = t("timeline.not_observed_glyph");
		color = "jcpas";
	}
	if (car_du_milieu=="" && j.stamp=="") car_du_milieu = t("timeline.to_fill_in_glyph");
	day_timeline.append(`<span class='s'>${j.is_peak ? t("timeline.peak_mucus") : ""}</span>`);
	if (state.constante.nfp_method==1 || state.constante.nfp_method==2) day_timeline.append(`<span class='n'></span>`);
	day_timeline.append(`<span class='g ${color}'>${car_du_milieu}</span>`);
	if ((state.constante.nfp_method==3 || state.constante.nfp_method==4) && !j.observation_paused && !j.day_not_observed && j.fc_score){
		recap_note = recap_note.replace('X1','').replace('X2','').replace('X3','');
		let fc_glaire = recap_note.match(/\d+/);
		if (fc_glaire) recap_note = recap_note.replace(fc_glaire[0], '');
		day_timeline.append($("<span>", {class: "fc"}).text(fc_glaire? fc_glaire[0] : ""));
		recap_note = recap_note.trim().replace(/\s+/g, '')
		if (recap_note.length>2) recap_note = t("timeline.fc_note_overflow");
		day_timeline.append($("<span>", {class: "fc"}).text(recap_note));
	}
	else if (state.constante.nfp_method==3 || state.constante.nfp_method==4) {
		day_timeline.append(`<span class='fc'></span>`);
		day_timeline.append(`<span class='fc'></span>`);
	}
	day_timeline.append(`<span class='c'>${car_du_bas}</span>`);
	return day_timeline;
}

// The "o" cell of a cervical mucus day: observations as they are, sensations in bold, then the
// descriptions with no type yet, struck through (css/tableau.css). Built with the DOM, never as
// HTML: a name is free text. <b> and <s> and text nodes on purpose, `.day span` styles every span
// as a cell and `.day span:empty` hides it, so a day with no description keeps an empty cell.
export function description_cell(descriptions) {
	let names_of = (type) => descriptions.filter(d => d.type == type).map(d => d.name);
	let parts = [
		...names_of(1).map(name => document.createTextNode(name)),
		...names_of(2).map(name => $("<b>", {class: "o_sens"}).text(name)[0]),
		...names_of(0).map(name => $("<s>", {class: "o_other", title: t("timeline.desc_legacy_title")}).text(name)[0]),
	];
	let cell = $("<span>", {class: "o pas_fc pas_fc_temp"});
	parts.forEach((part, i) => {
		if (i > 0) cell.append(document.createTextNode(", "));
		cell.append(part);
	});
	return cell;
}
