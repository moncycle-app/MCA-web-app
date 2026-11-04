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
import { moncycle_config } from "../../js/core/config.js";
import { moncycle_store } from "../../js/model/store.js";
import * as dates from "../../js/model/dates.js";
import { t, t_map, t_node, format_number } from "../../js/core/i18n.js";
import { date_compact, temperature_unit, format_temperature } from "../../js/model/format.js";
import { to_unit } from "../../js/model/temperature.js";
import { by_id, el, display } from "../../js/core/dom.js";
import { counter_days, peak_follow_days } from "../../js/model/cycles.js";
import { cycle_stats, fill_level, filled_percent, percent, previous_cycles, todo_runs } from "../../js/model/cycle_stats.js";
import { description_cell } from "./recap_view.js";
import { open_menu } from "./day_form.js";
import { state } from "./state.js";

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
	const end_span = el("span", {class: "cycle_fin", text: t(key_end, {end: date_compact(end, false)})});
	const nb_span = el("span", {class: "nb_jours", text: String(nb)});
	return t_node(key, {start: date_compact(start, false), end: end_span, nb: nb_span});
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
	const options = el("div", {class: `cycle_options c_options_${c_date_str}`});
	// the grid row of the options goes from 0 to its height (timeline.css), so what is inside sits in a block that can shrink to nothing
	const c_action = el("div", {class: "cycle_options_inner"});
	options.append(c_action);
	// the address carries the format, the period and the option; a click fetches the file and saves it (download_export)
	const nfp_link = el("a", {id: `nfp_but_${id_buts}_${discri}`, class: "button", href: `${moncycle_config.api_url("/export/nfp")}?from=${c_date_str}&to=${c_date_fin_str}&anonymous=false`, text: t("timeline.but_export_nfp")});
	const csv_link = el("a", {class: "button", href: `${moncycle_config.api_url("/export/csv")}?from=${c_date_str}&to=${c_date_fin_str}`, text: t("timeline.but_export_csv")});
	const pdf_link = el("a", {id: `pdf_but_${id_buts}_${discri}`, class: "button", href: `${moncycle_config.api_url("/export/pdf")}?from=${c_date_str}&to=${c_date_fin_str}&anonymous=false`, text: t("timeline.but_export_pdf")});
	c_action.append(el("div", {class: "cycle_exports"}, nfp_link, csv_link, pdf_link));
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
	c_action.append(el("div", {class: "cycle_anonymous"}, anonymous_checkbox, el("label", {for: `anonymous_${id_buts}_${discri}`, class: "label_anonymous_export", text: t("timeline.label_anonymous_export")})));
	// the figures are drawn when the box opens (fill_cycle_stats), from the days as they are then
	c_action.append(el("div", {class: "cycle_stats", "data-from": c_date_str, "data-to": c_date_fin_str}));
	return options;
}

// --- the figures of a cycle -----------------------------------------------------------------------------------------------------------
// They read the same everywhere: a number, a share in percent, a number of days, a day of the cycle (short: "J12", "D12"), a run of
// days ("J12–J17"), and after a figure, in brackets and lighter, what goes with it (a share, a range, the days it is about).
const number = (n) => format_number(n);
const share = (n) => format_number(n / 100, {style: "percent"});
const days_text = (count) => t("timeline.stats_days", {count: count});
const day_text = (n) => t("timeline.stats_day", {n: n});
const run_text = (first, last) => first == last ? day_text(first) : t("timeline.stats_day_range", {first: first, last: last});

function aside_node(parts) {
	return el("span", {class: "stats_aside", text: t("timeline.stats_aside", {text: parts.join(", ")})});
}
// a figure and what goes with it (the empty parts are left out), as nodes
function figure(main, ...aside) {
	const parts = aside.filter((part) => part);
	return parts.length ? [main, " ", aside_node(parts)] : [main];
}
function stats_row(list, label, main, ...aside) {
	list.append(el("dt", {text: label}), el("dd", {}, ...figure(main, ...aside)));
}

// The kinds of day (cycle_stats.js day_kind), the class of their colour (timeline.css) and their name. The order here is only the one of
// kinds with as many days as each other.
const DAY_KINDS = [
	{kind: "R", css: "stamp_rouge", key: "timeline.stats_kind_red"},
	{kind: "G", css: "stamp_vert", key: "timeline.stats_kind_green"},
	{kind: "Y", css: "stamp_jaune", key: "timeline.stats_kind_yellow"},
	{kind: "BB", css: "stamp_baby", key: "timeline.stats_kind_baby"},
	{kind: "none", css: "stamp_none", key: "timeline.stats_kind_none"},
	{kind: "not_observed", css: "stamp_jcpas", key: "timeline.stats_kind_not_observed"},
	{kind: "to_fill", css: "stamp_ar", key: "timeline.stats_kind_to_fill"},
	{kind: "paused", css: "stamp_pause", key: "timeline.stats_kind_paused"},
];

// one bar, one segment per kind of day, as wide as its days and the largest first (the sort is stable: equals keep the order of DAY_KINDS);
// the legend follows the bar and gives the days and their share of the cycle
function kinds_nodes(stats) {
	const days = (kind) => stats.kinds[kind.kind];
	const bar = el("div", {class: "stats_bar", "aria-hidden": "true"});
	const legend = el("ul", {class: "stats_legend"});
	DAY_KINDS.filter((kind) => days(kind)).sort((a, b) => days(b) - days(a)).forEach((kind) => {
		const segment = el("span", {class: `stats_seg ${kind.css}`});
		segment.style.flexGrow = String(days(kind));
		bar.append(segment);
		legend.append(el("li", {class: "stats_key"}, el("span", {class: `stats_dot ${kind.css}`}),
			el("span", {}, el("b", {text: number(days(kind))}), " " + t(kind.key, {count: days(kind)}) + " ", aside_node([share(percent(days(kind), stats.total))]))));
	});
	return [bar, legend];
}

// How much of the cycle is filled in and a word about it, then the days still to fill in: a tap on one opens it in the day form
const FILL_MESSAGES = {"95": "timeline.stats_fill_95", "90": "timeline.stats_fill_90", "80": "timeline.stats_fill_80", "60": "timeline.stats_fill_60", "low": "timeline.stats_fill_low"};
const TODO_SHOWN = 10;

function fill_node(stats, from, ongoing) {
	const left = stats.kinds.to_fill;
	const filled = stats.total - left;
	const rows = el("dl", {class: "stats_rows"});
	stats_row(rows, t("timeline.stats_filled"), t("timeline.stats_fraction", {part: number(filled), whole: number(stats.total)}), share(filled_percent(stats)));
	// the days filled in a row, when the cycle has a gap: up to today in the cycle under way, the most of them in another
	const in_a_row = ongoing ? stats.streak : stats.longest;
	if (in_a_row > 1 && in_a_row < filled) stats_row(rows, t(ongoing ? "timeline.stats_streak" : "timeline.stats_longest_run"), days_text(in_a_row));
	let message;
	if (!left) message = t(ongoing ? "timeline.stats_fill_full_ongoing" : "timeline.stats_fill_full");
	else if (ongoing && left == 1 && stats.to_fill[0] == stats.total) message = t("timeline.stats_fill_today");
	else message = t(FILL_MESSAGES[fill_level(filled_percent(stats))], {count: left});
	const box = el("div", {class: left ? "stats_fill" : "stats_fill full"}, rows, el("p", {class: "stats_message", text: message}));
	if (!left) return box;
	const runs = todo_runs(stats.to_fill);
	const todo = el("div", {class: "stats_todo", role: "group", "aria-label": t("timeline.stats_todo_label")});
	runs.slice(0, TODO_SHOWN).forEach((run) => {
		const button = el("button", {type: "button", text: run_text(run.first, run.last), title: t("timeline.stats_todo_open", {day: day_text(run.first)})});
		button.addEventListener("click", () => open_menu(null, dates.add_days(from, run.first - 1)));
		todo.append(button);
	});
	const more = runs.slice(TODO_SHOWN).reduce((sum, run) => sum + run.last - run.first + 1, 0);
	if (more) todo.append(el("span", {class: "stats_aside", text: t("timeline.stats_todo_more", {count: more})}));
	box.append(todo);
	return box;
}

// This cycle beside the complete cycles before it (previous_cycles): its length, its peak day and the days after it; for the cycles before,
// the mean, then the shortest and the longest, and how many of them have a peak when not all do. A cycle ended by a pause has no length.
function compare_node(stats, from, fc) {
	const account = moncycle_store.account || {};
	const before = previous_cycles(account.allCyclesFirstDay, account.allObservationPausedDates, moncycle_store.days, from);
	const has_peak = stats.peak !== null || before.peak !== null;
	// nothing before it and no peak: the length alone, which the title gives
	if (!before.cycles && !has_peak) return null;
	const complete = !stats.kinds.paused;
	const head = el("tr", {}, el("td"), el("th", {scope: "col", text: t("timeline.stats_this_cycle")}));
	if (before.cycles) head.append(el("th", {scope: "col", text: t("timeline.stats_previous", {count: before.cycles})}));
	const body = el("tbody");
	const line = (label, mine, theirs, text, range) => {
		const row = el("tr", {}, el("th", {scope: "row", text: label}), el("td", {text: mine === null ? t("timeline.stats_none") : text(mine)}));
		if (before.cycles) {
			const cell = el("td", {text: theirs ? null : t("timeline.stats_none")});
			if (theirs) cell.append(...figure(text(Math.round(theirs.mean)), theirs.min != theirs.max ? range(theirs.min, theirs.max) : "", theirs.count < before.cycles ? t("timeline.stats_cycles", {count: theirs.count}) : ""));
			row.append(cell);
		}
		body.append(row);
	};
	const days_range = (min, max) => t("timeline.stats_range", {min: number(min), max: number(max)});
	line(t("timeline.stats_length"), complete ? stats.total : null, before.length, days_text, days_range);
	if (has_peak) {
		line(t(fc ? "timeline.stats_peak_fc" : "timeline.stats_peak_mucus"), stats.peak, before.peak, day_text, run_text);
		line(t(fc ? "timeline.stats_after_peak_fc" : "timeline.stats_after_peak_mucus"), stats.peak !== null && complete ? stats.total - stats.peak : null, before.after_peak, days_text, days_range);
	}
	return el("table", {class: "stats_compare"}, el("thead", {}, head), body);
}

// The figures of one cycle (cycle_stats.js), from the local copy: its days by kind, how much of it is filled in, how it compares with the
// cycles before it, its baby period, temperatures and keywords. Every figure is text; the keywords are the user's own words
// and go in as text.
function cycle_stats_node(from, to) {
	const nfp_method = state.constante.nfp_method;
	const fc = nfp_method == 3 || nfp_method == 4;
	const stats = cycle_stats(moncycle_store.days, from, to, {fc: fc, temperature: nfp_method == 1 || nfp_method == 4});
	// the cycle under way: it ends today, and no pause closed it
	const ongoing = to == dates.str(dates.now()) && !stats.kinds.paused;
	const root = el("div", {class: "cycle_stats_body"}, ...kinds_nodes(stats), fill_node(stats, from, ongoing));
	const compare = compare_node(stats, from, fc);
	if (compare) root.append(compare);
	const rows = el("dl", {class: "stats_rows"});
	if (stats.baby) stats_row(rows, t("timeline.stats_baby_span"), run_text(stats.baby.first, stats.baby.last), days_text(stats.baby.days));
	if (stats.temperature) {
		const degrees = (value) => t("timeline.stats_degrees", {unit: temperature_unit(), value: format_number(to_unit(value), {minimumFractionDigits: 2, maximumFractionDigits: 2})});
		const {count, mean, min, max} = stats.temperature;
		stats_row(rows, t("timeline.stats_temperature", {count: count}), t("timeline.stats_mean", {value: degrees(mean)}), min != max ? t("timeline.stats_range", {min: degrees(min), max: degrees(max)}) : "");
	}
	if (stats.words.length) stats_row(rows, t("timeline.stats_words"), stats.words.map(([word, days]) => t("timeline.stats_word", {word: word, count: days})).join(", "));
	root.append(rows);
	return root;
}

function fill_cycle_stats(options) {
	const box = options.querySelector(".cycle_stats");
	if (box) box.replaceChildren(cycle_stats_node(box.dataset.from, box.dataset.to));
}

// A tap on a cycle's title opens its options (and its ruler in the mini view) under it; a second tap, a tap elsewhere or Escape closes them.
export function cycle_title_click(event) {
	let c = event.currentTarget.getAttribute("for");
	const was_open = state.cycle_title_opened == c;
	close_cycle_options();
	if (!was_open) {
		each("#ruler_" + c, (ruler) => display(ruler, true));
		each(`.c_options_${c}`, (options) => { fill_cycle_stats(options); options.classList.add("open"); });
		state.cycle_title_opened = c;
	}
}

export function close_cycle_options() {
	each(".cycle_options", (options) => options.classList.remove("open"));
	each(".mini_ruler", (ruler) => display(ruler, false));
	state.cycle_title_opened = null;
}

export function cycle2timeline(c, nb, fin) {
	let c_id = "c-" + c;
	let c_date = dates.parse(c);
	let c_fin = new Date(fin);
	let c_title = el("h2", {class: `title title_${c}`, for: c}, cycle_title_node("timeline.cycle_title", "timeline.cycle_title_end", c_date, c_fin, nb));
	let c_graph = el("div", {class: "graph pas_mucus pas_fc", id: `graph-${c_id}`}, el("canvas", {id: `canvas-${c_id}`}));
	c_graph.style.display = "none";
	c_title.addEventListener("click", cycle_title_click);
	// the title and its options stick together at the top of the page: they open where the title is, however far down the cycle
	return el("div", {id: c_id, class: "cycle"},
		el("div", {class: "cycle_head"}, c_title, cycle_option(c, dates.str(fin), "timeline")),
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
	// the stamp of the day colours its whole row (timeline.css, .stamp_*): its square, its tint, its day number
	const tint = (name) => day_timeline.classList.add("stamp_" + name);
	let d_bold = o_date.getDay()==0 ? "bold" : "";
	day_timeline.append(el("span", {class: `d ${d_bold}`.trim(), text: date_compact(o_date)}));
	let pos = el("span", {class: "j", text: String(j.pos)});
	day_timeline.append(pos);
	day_timeline.addEventListener("click", open_menu);
	let tbd = true;
	if (j.observation_paused) {
		day_timeline.append(el("span", {class: "g pink"}));
		day_timeline.append(el("span", {class: "e", text: t("timeline.observation_paused")}));
		day_timeline.append(el("span", {class: "s"}));
		day_timeline.append(el("span", {class: "n"}));
		tbd = false;
	}
	else {
		if (j.day_not_observed) {
			day_timeline.append(el("span", {class: "g jcpas", text: t("timeline.not_observed_glyph")}));
			pos.classList.add("j_jcpas");
			tint("jcpas");
			tbd = false;
		}
		else {
			if (j.stamp) {
				let contenu = "o";
				let color = j.stamp;
				let with_baby = false;
				if (j.stamp.includes("BB") && j.stamp.length>2){
					contenu = t_map("timeline.stamp_glyph")["BB"];
					color = j.stamp.replace("BB", "");
					with_baby = true;
				}
				else {
					contenu = t_map("timeline.stamp_glyph")[j.stamp];
				}
				day_timeline.append(el("span", {class: `g ${state.stamp_class[color]}${with_baby ? " with_baby" : ""}`, text: contenu}));
				pos.classList.add("j_" + state.stamp_class[color]);
				tint(state.stamp_class[color]);
				tbd = false;
			}
			// no stamp (a note or a temperature only): an empty square, so that the squares stay in one column
			else day_timeline.append(el("span", {class: "g g_none"}));
			day_timeline.append(el("span", {class: "fc pas_mucus pas_mucus_temp"}, ...fc_note2nodes(j.fc_score || "")));
			if ((state.constante.nfp_method==1 || state.constante.nfp_method==4) && j.temperature) {
				let temp = parseFloat(j.temperature);
				// how warm, from 0 (36.5° and under) to 1 (37.5° and over): the colours are in timeline.css
				const heat = String(Math.min(1, Math.max(0, temp - 36.5)) || 0);
				const temp_cell = el("span", {class: "t pas_mucus pas_fc", text: format_temperature(temp)});
				temp_cell.style.setProperty("--heat", heat);
				day_timeline.append(temp_cell);
				if (j.time_temp_taken) {
					let hm = j.time_temp_taken.substring(0,5).split(':');
					const time_cell = el("span", {class: "th mucus pas_fc pas_mucus", text: t("timeline.temperature_time", {hh: hm[0], mm: hm[1]})});
					time_cell.style.setProperty("--heat", heat);
					day_timeline.append(time_cell);
				}
				tbd = false;
			}
			if ((state.constante.nfp_method==3 || state.constante.nfp_method==4) && j.fc_score) tbd = false;
		}
		if (tbd) {
			day_timeline.querySelector(".g_none")?.remove();
			day_timeline.append(el("span", {class: "g ar", text: t("timeline.to_fill_in_glyph")}));
			tint("ar");
			day_timeline.append(el("span", {class: "s"}));
			day_timeline.append(el("span", {class: "r", text: t("timeline.to_fill_in")}));
			pos.classList.add("j_ar");
			return with_body(day_timeline);
		}
		day_timeline.append(el("span", {class: "s", text: j.is_peak ? t("timeline.peak_mucus") : ""}));
		day_timeline.append(el("span", {class: "n"}));
		day_timeline.append(el("span", {class: "u", text: j.union_sex ? t("timeline.union") : ""}));
		if (!j.day_not_observed) {
			day_timeline.append(description_cell(j.description));
			if (state.arrow_id[j.fc_arrow]) day_timeline.append(el("span", {class: "fle pas_mucus pas_mucus_temp", text: t_map("timeline.arrow_glyph")[j.fc_arrow] || ""}));
		}
		else day_timeline.append(el("span", {class: "p", text: t("timeline.not_observed")}));
	}
	if (j.comment) {
		// free text: one text node per line, a <br> between, never HTML. A comment of several lines goes under the rest (timeline.css).
		let cell = el("span", {class: j.comment.trim().includes("\n") ? "c c_lines" : "c"});
		j.comment.trim().split("\n").forEach((line, i) => {
			if (i > 0) cell.append(el("br"));
			cell.append(document.createTextNode(line));
		});
		day_timeline.append(cell);
	}
	return with_body(day_timeline);
}

// The row is a grid: day number, square, what the day holds, date (timeline.css). What it holds is one cell: its marks and keywords
// in a block that stays on the first line (long keywords wrap inside it), then the comment, which moves under them when it does not
// fit beside them. The date stays on the first line.
function with_body(row) {
	const main = el("span", {class: "m"});
	const body = el("span", {class: "b"}, main);
	[...row.children].forEach((cell) => {
		if (cell.matches(".c")) body.append(cell);
		else if (!cell.matches(".d, .j, .g")) main.append(cell);
	});
	row.append(body);
	return row;
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
