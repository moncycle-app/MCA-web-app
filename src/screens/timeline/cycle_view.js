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
import { by_id, el, display } from "/js/core/dom.js";
import { counter_days, peak_follow_days } from "/js/model/cycles.js";
import { description_cell } from "/screens/timeline/recap_view.js";
import { open_menu } from "/screens/timeline/day_form.js";
import { state } from "/screens/timeline/state.js";

// every element of the page that matches (none is fine: a day can be on one view and not the other)
function each(selector, action) {
	document.querySelectorAll(selector).forEach(action);
}

// What the method in use does not have is not shown (the classes pas_mucus, pas_fc... of the markup)
export function hide_method_parts() {
	each(`.pas_${state.constante.nfp_method_name}`, (part) => { part.style.display = "none"; });
}

// "Cycle du 3 mars au 29 mars de 27j": the end and the number are elements of their own (the stylesheet colours them)
export function cycle_title_node(key, key_end, start, end, nb) {
	const end_span = el("span", {class: "cycle_fin", text: t(key_end, {end: date_short(end)})});
	const nb_span = el("span", {class: "nb_jours", text: String(nb)});
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
	const date_input = el("input", {id: "nouveau_cycle_date", type: "date", max: max_date, min: min_date});
	date_input.value = max_date;
	const create_button = el("input", {type: "button", id: "but_creer_cycle", value: t("timeline.new_cycle_submit")});
	const form = el("div", {id: "nouveau_cycle", class: "cycle"},
		el("h2", {class: "title", text: t("timeline.new_cycle_title")}),
		el("div", {class: "nouveau_cycle_form"}, instruction, el("br"), date_input, " ", create_button));
	let nocycle = el("div", {id: "nocycle", text: t("timeline.all_cycles_shown")});
	if (state.cycle_curseur == 0) nocycle = el("div", {id: "nocycle", text: t("timeline.create_cycle_hint")});
	if (prepend && !state.timeline_asc) {
		by_id("charger_cycle").disabled = true;
		by_id("timeline").prepend(form);
		by_id("recap").prepend(nocycle);
	}
	else {
		by_id("timeline").append(form);
		if (state.cycle_curseur == 0) by_id("recap").append(nocycle);
	}
	create_button.addEventListener("click", function () {
		let nouveau_cycle_date = date_input.value;
		let max = dates.parse(date_input.getAttribute("max"));
		let min = dates.parse(date_input.getAttribute("min"));
		if (dates.parse(nouveau_cycle_date) > max || (!isNaN(min) && dates.parse(nouveau_cycle_date) < min)) {
			alert(t("timeline.new_cycle_date_error"));
			return;
		}
		moncycle_store.queue_day({date: nouveau_cycle_date, cycleFirstDay: true, lastWriteClientUtc: dates.now_in_utc()});
	});
}

export function trois_jours() {
	each(".day .s", (cell) => cell.replaceChildren());
	each(".obs .s", (cell) => { cell.replaceChildren(); display(cell, true); });
	each(".day .s", (cell) => cell.classList.remove("j_pic"));
	let txt_sommet = t("timeline.peak_mucus");
	if (state.constante.nfp_method==3 || state.constante.nfp_method==4) txt_sommet = t("timeline.peak_fc");
	state.sommets.forEach(s => {
		const peak_day = by_id(`o-${s}`);
		let last = 3;
		const siblings = [...peak_day.parentElement.children];
		const index = siblings.indexOf(peak_day);
		if (!state.timeline_asc) last = siblings.length - index - 1;
		else last = index;
		peak_follow_days(s, last).forEach(({date, n}) => {
			each(`#o-${date} .s`, (cell) => { cell.textContent = t("timeline.peak_offset", {n: n}); });
			each(`#ro-${date} .s`, (cell) => { cell.textContent = n; });
		});
		each(`#o-${s} .s, #ro-${s} .s`, (cell) => { cell.textContent = txt_sommet; cell.classList.add("j_pic"); });
	});
	if (state.constante.nfp_method==3 || state.constante.nfp_method==4) return;
	each(".day .n", (cell) => cell.replaceChildren());
	each(".obs .n", (cell) => { cell.replaceChildren(); display(cell, false); });
	Object.entries(state.counter_starts).forEach(([d, c]) => {
		counter_days(d, c).forEach(({date, n}) => {
			each(`#o-${date} .n`, (cell) => { cell.textContent = t("timeline.peak_offset", {n: n}); });
			const peak_cell = document.querySelector(`#ro-${date} .s`);
			if (peak_cell && peak_cell.textContent.length==0) {
				each(`#ro-${date} .n`, (cell) => { cell.textContent = n; display(cell, true); });
				display(peak_cell, false);
			}
		});
	});
}

export function cycle_option(c_date_str, c_date_fin_str, discri) {
	let id_buts = c_date_str.replace("-", "_").replace("-", "_");
	let c_action = el("div", {class: `cycle_options c_options_${c_date_str}`});
	c_action.style.display = "none";
	// the address carries the format, the period and the option; a click fetches the file and saves it (download_export)
	const nfp_link = el("a", {id: `nfp_but_${id_buts}_${discri}`, href: `${moncycle_config.api_url("/export/nfp")}?from=${c_date_str}&to=${c_date_fin_str}&anonymous=false`}, el("button", {text: t("timeline.but_export_nfp")}));
	const csv_link = el("a", {href: `${moncycle_config.api_url("/export/csv")}?from=${c_date_str}&to=${c_date_fin_str}`}, el("button", {text: t("timeline.but_export_csv")}));
	const pdf_link = el("a", {id: `pdf_but_${id_buts}_${discri}`, href: `${moncycle_config.api_url("/export/pdf")}?from=${c_date_str}&to=${c_date_fin_str}&anonymous=false`}, el("button", {text: t("timeline.but_export_pdf")}));
	c_action.append(nfp_link, " ", csv_link, " ", pdf_link, " ");
	// the checkbox applies to every export that can carry the user's identity: the PDF
	// (name on the chart) and the NFP file (userInformation block). The CSV never does.
	let anonymous_checkbox = el("input", {type: "checkbox", value: "1", id: `anonymous_${id_buts}_${discri}`, name: "privacy"});
	anonymous_checkbox.addEventListener("change", function () {
		let anonymous = anonymous_checkbox.checked;
		[nfp_link, pdf_link].forEach(function (link) {
			let url = link.getAttribute("href").split('?');
			let params = new URLSearchParams(url[1]);
			params.set("anonymous", anonymous);
			url[1] = params.toString();
			link.setAttribute("href", url.join("?"));
		});
	});
	// a keyword with no type has no field in the NFP format: its days carry it in their comment (nfp_export_day)
	let has_untyped = Object.keys(moncycle_store.days).some(function (date) {
		return date >= c_date_str && date <= c_date_fin_str && (moncycle_store.days[date].freeOther || []).length > 0;
	});
	if (has_untyped) c_action.append(el("p", {class: "unknown_type_note", text: t("timeline.unknown_type_note")}));
	c_action.append(el("br"), anonymous_checkbox, el("label", {for: `anonymous_${id_buts}_${discri}`, class: "label_anonymous_export", text: t("timeline.label_anonymous_export")}));
	return c_action;
}

export function cycle_title_click(event) {
	let c = event.currentTarget.getAttribute("for");
	each(".cycle_options", (options) => display(options, false));
	each(".mini_ruler", (ruler) => display(ruler, false));
	if (state.cycle_title_opened == null || state.cycle_title_opened != c) {
		each("#ruler_" + c, (ruler) => display(ruler, true));
		each(`.c_options_${c}`, (options) => display(options, true));
		state.cycle_title_opened = c;
	}
	else state.cycle_title_opened = null;
}

export function cycle2timeline(c, nb, fin) {
	let c_id = "c-" + c;
	let c_date = dates.parse(c);
	let c_fin = new Date(fin);
	let c_title = el("h2", {class: `title title_${c}`, for: c}, cycle_title_node("timeline.cycle_title", "timeline.cycle_title_end", c_date, c_fin, nb));
	let c_graph = el("div", {class: "graph pas_mucus pas_fc", id: `graph-${c_id}`}, el("canvas", {id: `canvas-${c_id}`}));
	c_graph.style.display = "none";
	c_title.addEventListener("click", cycle_title_click);
	return el("div", {id: c_id, class: "cycle"},
		c_title,
		cycle_option(c, dates.str(fin), "timeline"),
		c_graph,
		el("div", {class: "contenu", id: `contenu-${c_id}`}));
}

export function day_timeline2timeline(j) {
	let o_date = dates.parse(j.date_obs);
	let o_id = "o-" + dates.str(o_date);
	let o_class = "day";
	if (state.constante.nfp_method==3 || state.constante.nfp_method==4) o_class += " o_fc";
	else o_class += " o_mucus";
	if (j.observation_paused) o_class += " o_paused";
	let day_timeline = el("div", {id: o_id, class: o_class, date: dates.str(o_date)});
	let d_bold = o_date.getDay()==0 ? "bold" : "";
	day_timeline.append(el("span", {class: `d ${d_bold}`.trim(), text: date_row(o_date)}));
	let pos = el("span", {class: "j", text: String(j.pos)});
	day_timeline.append(pos);
	day_timeline.addEventListener("click", open_menu);
	let tbd = true;
	if (j.observation_paused) {
		day_timeline.append(el("span", {class: "e", text: t("timeline.observation_paused")}));
		day_timeline.append(el("span", {class: "s"}));
		day_timeline.append(el("span", {class: "n"}));
		tbd = false;
	}
	else {
		if (j.day_not_observed) {
			day_timeline.append(el("span", {class: "g jcpas", text: t("timeline.not_observed_glyph")}));
			pos.classList.add("j_jcpas");
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
				day_timeline.append(el("span", {class: `g ${state.stamp_class[color]}`, text: contenu}));
				pos.classList.add("j_" + state.stamp_class[color]);
				tbd = false;
			}
			day_timeline.append(el("span", {class: "fc pas_mucus pas_mucus_temp"}, ...fc_note2nodes(j.fc_score || "")));
			if ((state.constante.nfp_method==1 || state.constante.nfp_method==4) && j.temperature) {
				let temp = parseFloat(j.temperature);
				let color = "#4169e1";
				if (temp > 37.5) color = "#b469e1";
				else if (temp <= 37.5 && temp >= 36.5) {
					let r = parseInt((1-(37.5-temp))*115)+65;
					color = `rgb(${r}, 105, 225)`;
				}
				const temp_cell = el("span", {class: "t pas_mucus pas_fc", text: String(temp)});
				temp_cell.style.backgroundColor = color;
				day_timeline.append(temp_cell);
				if (j.time_temp_taken) {
					let hm = j.time_temp_taken.substring(0,5).split(':');
					const time_cell = el("span", {class: "th mucus pas_fc pas_mucus", text: t("timeline.temperature_time", {hh: hm[0], mm: hm[1]})});
					time_cell.style.color = color;
					day_timeline.append(time_cell);
				}
				tbd = false;
			}
			if ((state.constante.nfp_method==3 || state.constante.nfp_method==4) && j.fc_score) tbd = false;
		}
		if (tbd) {
			day_timeline.append(el("span", {class: "g ar", text: t("timeline.to_fill_in_glyph")}));
			day_timeline.append(el("span", {class: "s"}));
			day_timeline.append(el("span", {class: "r", text: t("timeline.to_fill_in")}));
			pos.classList.add("j_ar");
			return day_timeline;
		}
		day_timeline.append(el("span", {class: "s", text: j.is_peak ? t("timeline.peak_mucus") : ""}));
		day_timeline.append(el("span", {class: "n"}));
		if (!j.day_not_observed) {
			day_timeline.append(description_cell(j.description));
			if (state.arrow_id[j.fc_arrow]) day_timeline.append(el("span", {class: "fle pas_mucus pas_mucus_temp", text: t_map("timeline.arrow_glyph")[j.fc_arrow] || ""}));
		}
		else day_timeline.append(el("span", {class: "p", text: t("timeline.not_observed")}));
		day_timeline.append(el("span", {class: "u", text: j.union_sex ? t("timeline.union") : ""}));
	}
	if (j.comment) {
		// free text: one text node per line, a <br> between, never HTML
		let cell = el("span", {class: "c"});
		j.comment.trim().split("\n").forEach((line, i) => {
			if (i > 0) cell.append(el("br"));
			cell.append(document.createTextNode(line));
		});
		day_timeline.append(cell);
	}
	return day_timeline;
}

// A FertilityCare note for the page: its codes in colour, the rest as it is. The server only stores notes made of the notation's codes, but
// the note is text all the same: it comes out as text nodes and <span>s, never as HTML. The first occurrence of each code gets a span, in
// the order below, and a span made earlier can be inside a later one (the "AP" of an "RAP"), as it always was. Returns the nodes.
export function fc_note2nodes(note) {
	const should_be_red = ['VL', 'VH', 'H', 'M', 'B'];
	const less_important = ['RAP', 'LAP', 'AP', 'X1', 'X2', 'X3', 'AD',];
	// one entry per character, with the spans it is inside, outermost first: {id, css}
	const chars = [...note.toUpperCase()].map((character) => ({character: character, spans: []}));
	let span_count = 0;
	const mark = (code, css) => {
		const wanted = [...code];
		for (let start = 0; start + wanted.length <= chars.length; start++) {
			const run = chars.slice(start, start + wanted.length);
			// the code has to be in one piece: the same letters, all inside the same spans
			if (!run.every((one, i) => one.character === wanted[i] && one.spans.length === run[0].spans.length && one.spans.every((span, k) => span === run[0].spans[k]))) continue;
			const span = {id: ++span_count, css: css};
			run.forEach((one) => one.spans.push(span));
			return;
		}
	};
	less_important.forEach((code) => mark(code, "note_not_imp"));
	should_be_red.forEach((code) => mark(code, "note_rouge"));
	if (chars.length && chars[0].character === "L" && chars[0].spans.length === 0) chars[0].spans.push({id: ++span_count, css: "note_rouge"});

	const root = document.createDocumentFragment();
	let open = [];   // [{span, element}]
	chars.forEach((one) => {
		let common = 0;
		while (common < open.length && common < one.spans.length && open[common].span === one.spans[common]) common++;
		open = open.slice(0, common);
		for (let k = common; k < one.spans.length; k++) {
			const element = el("span", {class: one.spans[k].css});
			(open.length ? open[open.length - 1].element : root).append(element);
			open.push({span: one.spans[k], element: element});
		}
		const parent = open.length ? open[open.length - 1].element : root;
		if (parent.lastChild && parent.lastChild.nodeType === Node.TEXT_NODE) parent.lastChild.data += one.character;
		else parent.append(document.createTextNode(one.character));
	});
	return [...root.childNodes];
}
