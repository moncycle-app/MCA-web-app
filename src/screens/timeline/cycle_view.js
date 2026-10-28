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

import { moncycle_config } from "/js/core/config.js";
import { moncycle_store } from "/js/model/store.js";
import * as dates from "/js/model/dates.js";
import { t, t_map, t_node, date_short, date_row } from "/js/core/i18n.js";
import { counter_days, peak_follow_days } from "/js/model/cycles.js";
import { description_cell } from "/screens/timeline/recap_view.js";
import { open_menu } from "/screens/timeline/day_form.js";
import { state } from "/screens/timeline/state.js";

const $ = globalThis.$;

// "Cycle du 3 mars au 29 mars de 27j": the end and the number are elements of their own (the stylesheet colours them)
export function cycle_title_node(key, key_end, start, end, nb) {
	const end_span = $("<span>", {class: "cycle_fin"}).text(t(key_end, {end: date_short(end)}))[0];
	const nb_span = $("<span>", {class: "nb_jours"}).text(nb)[0];
	return t_node(key, {start: date_short(start), end: end_span, nb: nb_span});
}


export function form_nouveau_cycle(prepend=true) {
	if (state.form_nouveau_cycle_active) return;
	state.form_nouveau_cycle_active = true;
	let max_date = dates.str(dates.now());
	let min_date = "";
	if (prepend && state.cycle_curseur>0) {
		max_date = state.constante.all_cycles_1st_day[state.cycle_curseur-1];
		max_date = dates.str(new Date(dates.parse(max_date) - (1000*60*60*24)));
	}
	else if (!prepend) {
		let min_calc = dates.parse(state.constante.all_observation_paused_dates[0]);
		min_calc.setDate(min_calc.getDate()+1);
		min_date = dates.str(min_calc);
	}
	let instruction = t("timeline.new_cycle_ask_1st_day");
	if (!prepend) instruction = t("timeline.new_cycle_ask_restart");
	let html = `<div class="cycle" id="nouveau_cycle"><h2 class="title">${t("timeline.new_cycle_title")}</h2><div class="nouveau_cycle_form">${instruction}<br><input id="nouveau_cycle_date" type="date" value="${max_date}" max="${max_date}" min="${min_date}" /> <input type="button" id="but_creer_cycle" value="${t("timeline.new_cycle_submit")}" /></div></div>`;
	let nocycle = `<div id="nocycle">${t("timeline.all_cycles_shown")}</div>`;
	if (state.cycle_curseur == 0) nocycle = `<div id="nocycle">${t("timeline.create_cycle_hint")}</div>`;
	if (prepend && !state.timeline_asc) {
		$("#charger_cycle").prop("disabled", true);
		$("#timeline").prepend(html);
		$("#recap").prepend(nocycle);
	}
	else {
		$("#timeline").append(html);
		if (state.cycle_curseur == 0) $("#recap").append(nocycle);
	}
	$("#but_creer_cycle").click(function () {
		let nouveau_cycle_date = $("#nouveau_cycle_date").val();
		let max = dates.parse($("#nouveau_cycle_date").attr("max"));
		let min = dates.parse($("#nouveau_cycle_date").attr("min"));
		if (dates.parse(nouveau_cycle_date) > max || (!isNaN(min) && dates.parse(nouveau_cycle_date) < min)) {
			alert(t("timeline.new_cycle_date_error"));
			return;
		}
		moncycle_store.queue_day({date: nouveau_cycle_date, cycleFirstDay: true, lastWriteClientUtc: dates.now_in_utc()});
	});
}

export function trois_jours() {
	$(".day .s").empty();
	$(".obs .s").empty();
	$(".obs .s").show();
	$(".day .s").removeClass("j_pic");
	let txt_sommet = t("timeline.peak_mucus");
	if (state.constante.nfp_method==3 || state.constante.nfp_method==4) txt_sommet = t("timeline.peak_fc");
	state.sommets.forEach(s => {
		let last = 3;
		if (!state.timeline_asc) last = $(`#o-${s}`).parent()[0].children.length - $(`#o-${s}`).index() - 1;
		else last = $(`#o-${s}`).index();
		peak_follow_days(s, last).forEach(({date, n}) => {
			$(`#o-${date} .s`).text(t("timeline.peak_offset", {n: n}));
			$(`#ro-${date} .s`).html(n);
		});
		$(`#o-${s} .s`).html(txt_sommet);
		$(`#ro-${s} .s`).html(txt_sommet);
		$(`#o-${s} .s`).addClass("j_pic");
		$(`#ro-${s} .s`).addClass("j_pic");
	});
	if (state.constante.nfp_method==3 || state.constante.nfp_method==4) return;
	$(".day .n").empty();
	$(".obs .n").empty();
	$(".obs .n").hide();
	$.each(state.counter_starts,function(d,c){
		counter_days(d, c).forEach(({date, n}) => {
			$(`#o-${date} .n`).text(t("timeline.peak_offset", {n: n}));
			if (($(`#ro-${date} .s`).text()).length==0) {
				$(`#ro-${date} .n`).html(n);
				$(`#ro-${date} .n`).show();
				$(`#ro-${date} .s`).hide();
			}
		});
	});
}

export function cycle_option(c_date_str, c_date_fin_str, discri) {
	let id_buts = c_date_str.replace("-", "_").replace("-", "_");
	let c_action = $(`<div class='cycle_options c_options_${c_date_str}' style='display:none'></div>`);
	// the address carries the format, the period and the option; a click fetches the file and saves it (download_export)
	c_action.append(`<a id='nfp_but_${id_buts}_${discri}' href='${moncycle_config.api_url("/export/nfp")}?from=${c_date_str}&to=${c_date_fin_str}&anonymous=false'><button>${t("timeline.but_export_nfp")}</button></a> `);
	c_action.append(`<a href='${moncycle_config.api_url("/export/csv")}?from=${c_date_str}&to=${c_date_fin_str}'><button>${t("timeline.but_export_csv")}</button></a> `);
	c_action.append(`<a id='pdf_but_${id_buts}_${discri}' href='${moncycle_config.api_url("/export/pdf")}?from=${c_date_str}&to=${c_date_fin_str}&anonymous=false'><button>${t("timeline.but_export_pdf")}</button></a> `);
	// the checkbox applies to every export that can carry the user's identity: the PDF
	// (name on the chart) and the NFP file (userInformation block). The CSV never does.
	let anonymous_checkbox = $(`<input type='checkbox' value='1' id='anonymous_${id_buts}_${discri}' name="privacy" />`);
	anonymous_checkbox.change(function () {
		let anonymous = $(this).is(':checked');
		c_action.find(`#nfp_but_${id_buts}_${discri}, #pdf_but_${id_buts}_${discri}`).each(function () {
			let url = $(this).attr("href").split('?');
			let params = new URLSearchParams(url[1]);
			params.set("anonymous", anonymous);
			url[1] = params.toString();
			$(this).attr("href", url.join("?"));
		});
	});
	// a keyword with no type has no field in the NFP format: its days carry it in their comment (nfp_export_day)
	let has_untyped = Object.keys(moncycle_store.days).some(function (date) {
		return date >= c_date_str && date <= c_date_fin_str && (moncycle_store.days[date].freeOther || []).length > 0;
	});
	if (has_untyped) c_action.append($("<p>", {class: "unknown_type_note"}).text(t("timeline.unknown_type_note")));
	c_action.append("<br />");
	c_action.append(anonymous_checkbox);
	c_action.append(`<label for='anonymous_${id_buts}_${discri}' class='label_anonymous_export'>${t("timeline.label_anonymous_export")}</label>`);
	return c_action;
}

export function cycle_title_click() {
	let c = $(this).attr("for");
	$(".cycle_options").hide();
	$(".mini_ruler").hide();
	if (state.cycle_title_opened == null || state.cycle_title_opened != c) {
		$("#ruler_" + c).show();
		$(`.c_options_${c}`).show();
		state.cycle_title_opened = c;
	}
	else state.cycle_title_opened = null;
}

export function cycle2timeline(c, nb, fin) {
	let c_id = "c-" + c;
	let cycle = $("<div>", {id: c_id, class: "cycle"});
	let c_date = dates.parse(c);
	let c_fin = new Date(fin);
	let c_title = $(`<h2 class='title title_${c}' for='${c}'></h2>`).append(cycle_title_node("timeline.cycle_title", "timeline.cycle_title_end", c_date, c_fin, nb));
	let c_graph = $(`<div class='graph pas_mucus pas_fc' id='graph-${c_id}' style='display:none' ><canvas id='canvas-${c_id}'></canvas></div>`);
	let c_content = $(`<div class='contenu' id='contenu-${c_id}'></div>`);
	c_title.click(cycle_title_click);
	cycle.append(c_title);
	cycle.append(cycle_option(c, dates.str(fin), "timeline"));
	cycle.append(c_graph);
	cycle.append(c_content);
	return cycle;
}

export function day_timeline2timeline(j) {
	let o_date = dates.parse(j.date_obs);
	let o_id = "o-" + dates.str(o_date);
	let o_class = "day";
	if (state.constante.nfp_method==3 || state.constante.nfp_method==4) o_class += " o_fc";
	else o_class += " o_mucus";
	if (j.observation_paused) o_class += " o_paused";
	let day_timeline = $("<div>", {id: o_id, class: o_class, date : dates.str(o_date)});
	let d_bold = o_date.getDay()==0 ? "bold" : "";
	day_timeline.append(`<span class='d ${d_bold}'>${date_row(o_date)}</span>`);
	let pos = $(`<span class='j'>${j.pos}</span>`);
	day_timeline.append(pos);
	day_timeline.click(open_menu);
	let tbd = true;
	if (j.observation_paused) {
		day_timeline.append(`<span class='e'>${t("timeline.observation_paused")}</span>`);
		day_timeline.append(`<span class='s'></span>`);
		day_timeline.append(`<span class='n'></span>`);
		tbd = false;
	}
	else {
		if (j.day_not_observed) {
			day_timeline.append(`<span class='g jcpas'>${t("timeline.not_observed_glyph")}</span>`);
			pos.addClass("j_jcpas");
			tbd = false;
		}
		else {
			if (j.stamp) {
				let contenu = "o";
				let color = j.stamp;
				if (j.stamp.includes("BB") && j.stamp.length>2){
					contenu = t_map("timeline.stamp_glyph")["BB"];
					color = j.stamp.replace("BB", "");
				}
				else {
					contenu = t_map("timeline.stamp_glyph")[j.stamp];
				}
				day_timeline.append(`<span class='g ${state.stamp_class[color]}'>${contenu}</span>`);
				pos.addClass("j_" + state.stamp_class[color]);
				tbd = false;
			}
			let html_fc_score = fc_note2html(j.fc_score || "");
			day_timeline.append(`<span class='fc pas_mucus pas_mucus_temp'>${html_fc_score}</span>`);
			if ((state.constante.nfp_method==1 || state.constante.nfp_method==4) && j.temperature) {
				let temp = parseFloat(j.temperature);
				let color = "#4169e1";
				if (temp > 37.5) color = "#b469e1";
				else if (temp <= 37.5 && temp >= 36.5) {
					let r = parseInt((1-(37.5-temp))*115)+65;
					color = `rgb(${r}, 105, 225)`;
				}
				day_timeline.append(`<span class='t pas_mucus pas_fc' style='background-color: ${color}'>${temp}</span>`);
				if (j.time_temp_taken) {
					let hm = j.time_temp_taken.substring(0,5).split(':');
					day_timeline.append(`<span class='th mucus pas_fc pas_mucus' style='color: ${color}'>${t("timeline.temperature_time", {hh: hm[0], mm: hm[1]})}</span>`);
				}
				tbd = false;
			}
			if ((state.constante.nfp_method==3 || state.constante.nfp_method==4) && j.fc_score) tbd = false;
		}
		if (tbd) {
			day_timeline.append(`<span class='g ar'>${t("timeline.to_fill_in_glyph")}</span>`);
			day_timeline.append(`<span class='s'></span>`);
			day_timeline.append(`<span class='r'>${t("timeline.to_fill_in")}</span>`);
			pos.addClass("j_ar");
			return day_timeline;
		}
		day_timeline.append(`<span class='s'>${j.is_peak ? t("timeline.peak_mucus") : ""}</span>`);
		day_timeline.append(`<span class='n'></span>`);
		if (!j.day_not_observed) {
			day_timeline.append(description_cell(j.description));
			if (state.arrow_id[j.fc_arrow]) day_timeline.append(`<span class='fle pas_mucus pas_mucus_temp'>${t_map("timeline.arrow_glyph")[j.fc_arrow] || ""}</span>`);
		}
		else day_timeline.append(`<span class='p'>${t("timeline.not_observed")}</span>`);
		day_timeline.append(`<span class='u'>${j.union_sex ? t("timeline.union") : ""}</span>`);
	}
	if (j.comment) {
		// free text: one text node per line, a <br> between, never HTML
		let cell = $("<span>", {class: "c"});
		j.comment.trim().split("\n").forEach((line, i) => {
			if (i > 0) cell.append($("<br>"));
			cell.append(document.createTextNode(line));
		});
		day_timeline.append(cell);
	}
	return day_timeline;
}

// A text as HTML, for the one place that still builds markup out of a stored value: the server only
// stores FertilityCare notes made of the notation's codes, so this is a second wall, not the first.
export function escape_html(text) {
	return $("<span>").text(text).html();
}

export function fc_note2html(note) {
	const should_be_red = ['VL', 'VH', 'H', 'M', 'B'];
	const less_important = ['RAP', 'LAP', 'AP', 'X1', 'X2', 'X3', 'AD',];
	// escaped after the upper-casing: the entities are lower case, so no code below can match inside one
	note = escape_html(note.toUpperCase());
	less_important.forEach(c => {
		note = note.replace(c,`<span class='note_not_imp'>${c}</span>`);
	});
	should_be_red.forEach(c => {
		note = note.replace(c,`<span class='note_rouge'>${c}</span>`);
	});
	if (note.startsWith('L')) {
		note = note.slice(1);
		note = `<span class='note_rouge'>L</span>` + note;
	}
	return note;
}
