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
import { moncycle_store } from "../../js/model/store.js";
import * as dates from "../../js/model/dates.js";
import { t, clock, format_number } from "../../js/core/i18n.js";
import { date_compact, date_long, date_long_node, weekday_name, format_temperature, temperature_unit } from "../../js/model/format.js";
import { by_id, el, display, is_hidden } from "../../js/core/dom.js";
import { day_to_api } from "../../js/model/day.js";
import { fc_boxes_from_note, fc_boxes_unticked_by, fc_note_from_boxes, fc_note_regex } from "../../js/model/fc_notation.js";
import { type_from_int, unsent_description } from "../../js/model/descriptions.js";
import { day_timeline2recap } from "./recap_view.js";
import { day_timeline2timeline, hide_method_parts, trois_jours } from "./cycle_view.js";
import { graph_preparation_data } from "./chart_view.js";
import { rebuild, track_day, view_day } from "./timeline.js";
import { state } from "./state.js";

// the siblings of a node that match a selector
function siblings(node, selector) {
	return [...node.parentElement.children].filter((other) => other !== node && other.matches(selector));
}

// check or uncheck the box of that id, if the page has one
function check(id, checked = true) {
	const box = by_id(id);
	if (box) box.checked = checked;
}

// the values of the boxes ticked
function checked_values(selector) {
	return [...document.querySelectorAll(selector)].filter((box) => box.checked).map((box) => box.value);
}

export function bulk_show_hide() {
	display(by_id("bulk_form"), is_hidden(by_id("bulk_form")));
}

// The moment of the last save of the open day, at the foot of its form (empty for a day never saved).
// A recent one says "maintenant" and the line is drawn again when the two minutes are over.
export function show_last_write(day) {
	clearTimeout(state.last_write_timer);
	let moment = day.last_write ? new Date(day.last_write) : null;
	let box = by_id("jour_form_last_write");
	box.replaceChildren();
	box.removeAttribute("title");
	if (moment === null || isNaN(moment)) return;
	let age = Date.now() - moment.getTime();
	let recent = Math.abs(age) < state.last_write_recent_ms;
	box.setAttribute("title", t("timeline.last_write_title", {date: date_long(moment), clock: clock(moment)}));
	box.append(el("span", {text: t("timeline.last_write_label")}));
	box.append(el("b", {text: recent ? t("timeline.last_write_now") : t("timeline.last_write", {date: date_compact(moment, false), clock: clock(moment)})}));
	if (recent) state.last_write_timer = setTimeout(() => show_last_write(day), state.last_write_recent_ms - age);
}

// A day changed in the copy: draw it again, if it is on the page.
export function refresh_day(date) {
	let shown = state.day_timeline[date];
	if (!shown) return;
	let data = view_day(date, shown.cycle, shown.pos);
	state.day_timeline[date] = data;
	if (date == state.menu_opened_date) show_last_write(data);
	by_id(`o-${date}`)?.replaceWith(day_timeline2timeline(data));
	by_id(`ro-${date}`)?.replaceWith(day_timeline2recap(data));
	track_day(date, data);
	hide_method_parts();
	trois_jours();
	graph_preparation_data({[date]: data});
}

export function go_blank_or_empty() {
	by_id("blank_or_empty").textContent = by_id("go_baby").checked ? t("timeline.target_blank") : t("timeline.target_empty");
}

// A chip is the description's name (see day_to_api); its id only ties the label to the box. A change of the box saves the day.
export function render_desc_chip(sdesc, active) {
	let id = "i_desc_" + state.desc_chip_count++;
	const box = el("input", {type: "checkbox", name: "description[]", value: sdesc.name, id: id, class: "i_desc"});
	box.checked = !!active;
	box.addEventListener("change", submit_menu);
	return el("span", {class: "desc_chip"}, box, el("label", {for: id, text: sdesc.name}));
}

// wires the "+ nouvelle sensation/observation" affordances in jour_form; there is no
// equivalent for "autre" since that legacy type can't be created or converted to (see open_menu)
export function bind_desc_add_forms() {
	document.querySelectorAll(".desc_add_toggle").forEach(function (toggle) {
		toggle.addEventListener("click", function () {
			display(toggle, false);
			siblings(toggle, ".desc_add_form").forEach(function (form) {
				display(form, true);
				const input = form.querySelector(".desc_add_input");
				input.value = "";
				input.focus();
			});
		});
	});
	document.querySelectorAll(".desc_add_cancel").forEach(function (cancel) {
		cancel.addEventListener("click", function () {
			const form = cancel.closest(".desc_add_form");
			display(form, false);
			form.querySelector(".desc_add_status").replaceChildren();
			siblings(form, ".desc_add_toggle").forEach((toggle) => display(toggle, true));
		});
	});
	document.querySelectorAll(".desc_add_submit").forEach(function (submit) {
		submit.addEventListener("click", function () { desc_add_submit(submit.closest(".desc_add_form")); });
	});
	document.querySelectorAll(".desc_add_input").forEach(function (input) {
		input.addEventListener("keydown", function (event) {
			if (event.key !== "Enter") return;
			event.preventDefault();
			desc_add_submit(input.closest(".desc_add_form"));
		});
	});
}

export function desc_add_submit(form) {
	let desc_type = parseInt(form.dataset.descType);
	const input = form.querySelector(".desc_add_input");
	let name = input.value.trim().toLowerCase();
	let status = form.querySelector(".desc_add_status");
	if (name == "") return;
	let duplicate = state.description.some(d => d.name.toLowerCase() == name);
	if (duplicate) {
		status.textContent = t("timeline.desc_add_duplicate", {name: name});
		return;
	}
	// kept here and sent when the server can be reached (js/store.js): the chip is there at once, offline too
	moncycle_store.queue_description(name, type_from_int[desc_type], dates.now_in_utc());
	let desc = state.description.find(d => d.name == name) || unsent_description(name, desc_type);
	document.querySelector(state.desc_container_id[desc_type]).append(render_desc_chip(desc, false));
	input.value = "";
	input.focus();
	status.textContent = t("timeline.desc_add_saved");
}

export function open_menu(e, date = null) {
	let o_date;
	if (date) o_date = dates.parse(date);
	else o_date = dates.parse(e.currentTarget.getAttribute('date'));
	date = dates.str(o_date);
	state.menu_opened_date = date;
	let j = state.day_timeline[state.menu_opened_date];
	let stamp = j.stamp? j.stamp : "";
	// the long date with its weekday in a span of its own (not bold), then the day of the cycle as a badge
	const long_date = date_long_node(o_date, el("span", {class: "jf_weekday", text: weekday_name(o_date)}));
	by_id("jour_form_titre").replaceChildren(el("span", {class: "jf_date"}, long_date), el("span", {class: "jf_day", text: t("timeline.day_number", {n: j.pos})}));
	let arrow = {"next" : t("timeline.arrow_up"), "prev" : t("timeline.arrow_down")};
	if (!state.timeline_asc) arrow = {"next" : t("timeline.arrow_down"), "prev" : t("timeline.arrow_up")};
	by_id("jour_form_prev").textContent = t("timeline.but_day_step", {arrow: arrow["prev"], day: t("timeline.day_number", {n: j.pos-1})});
	by_id("jour_form_next").textContent = t("timeline.but_day_step", {arrow: arrow["next"], day: t("timeline.day_number", {n: j.pos+1})});
	let date_cursor = new Date(j.date_obs);
	date_cursor.setDate(date_cursor.getDate()+1);
	let str_date_cursor = dates.str(date_cursor);
	if (state.day_timeline[str_date_cursor] && !state.day_timeline[str_date_cursor].cycle_1st_day) {
		by_id("jour_form_next").setAttribute("date", str_date_cursor);
		display(by_id("jour_form_next"), true);
	}
	else display(by_id("jour_form_next"), false);
	date_cursor.setDate(date_cursor.getDate()-2);
	str_date_cursor = dates.str(date_cursor);
	if (j.pos-1 > 0 && state.day_timeline[str_date_cursor]) {
		by_id("jour_form_prev").setAttribute("date", str_date_cursor);
		display(by_id("jour_form_prev"), true);
	}
	else display(by_id("jour_form_prev"), false);
	by_id("form_data").reset();
	by_id("fc_msg").replaceChildren();
	display(by_id("jour_form_saving"), false);
	display(by_id("jour_form_saved"), false);
	display(by_id("jour_form_unsent"), !!moncycle_store.pending[date]);
	by_id("form_date").value = j.date_obs;
	by_id("form_fc_saved").value = state.constante.nfp_method==3 || state.constante.nfp_method==4 ? j.fc_score ?? "" : "";
	if (j.fc_score && (state.constante.nfp_method==3 || state.constante.nfp_method==4)) {
		by_id("form_fc").value = j.fc_score;
		fc_note2form();
		fc_test_note();
	}
	if (j.fc_arrow && (state.constante.nfp_method==3 || state.constante.nfp_method==4)) check("fc_f" + state.arrow_id[j.fc_arrow]);
	if (stamp.includes("BB") && stamp.length>2) {
		check("go_" + state.stamp_class["BB"]);
		stamp = stamp.replace("BB", "");
	}
	if (state.stamp_class[stamp]) check("go_" + state.stamp_class[stamp]);
	go_blank_or_empty();
	show_temperature_unit();
	by_id("form_temp").value = format_temperature(j.temperature);
	by_id("form_time_temp_taken").value = j.time_temp_taken ?? "";
	Object.values(state.desc_container_id).forEach((selector) => document.querySelector(selector).replaceChildren());
	let active_desc = [];
	for (const adesc of j.description) active_desc.push(adesc.name);
	let has_autre = false;
	for (const sdesc of state.description) {
		let active = active_desc.includes(sdesc.name);
		let container_id = state.desc_container_id[sdesc.type];
		if (!container_id) continue;
		if (sdesc.type == 0) has_autre = true;
		document.querySelector(container_id).append(render_desc_chip(sdesc, active));
	}
	// "autre" is a legacy type new descriptions can't be created as or converted to;
	// only show the category when a legacy description of that type still exists
	display(by_id("desc_category_other"), has_autre);
	document.querySelectorAll(".desc_add_form").forEach(function (form) {
		display(form, false);
		form.querySelector(".desc_add_status").replaceChildren();
	});
	document.querySelectorAll(".desc_add_toggle").forEach((toggle) => display(toggle, true));
	if (j.cycle_1st_day) check("ev_cycle_1st_day");
	if (j.union_sex) check("ev_union");
	if (j.is_peak) check("ev_is_peak");
	if (j.counter_start && j.counter_start > 0) {
		check("ev_counter_start_actif");
		by_id("ev_counter_start_nb").value = j.counter_start;
		by_id("ev_hidden_counter_start").value = j.counter_start;
	}
	if (j.day_not_observed) check("ev_jesaispas");
	if (j.observation_paused) check("ev_observation_paused");
	by_id("from_com").value = j.comment ?? "";
	by_id("from_com").maxLength = moncycle_store.comment_max_chars;
	show_last_write(j);
	[document.documentElement, document.body].forEach((page) => {
		page.style.overflow = "hidden";
		page.style.touchAction = "none";
	});
	display(by_id("jour_form"), true);
	by_id("jour_form").scrollTop = 0;
	by_id("timeline").classList.add("flou");
	by_id("recap").classList.add("flou");
}

export function close_menu(e) {
	[document.documentElement, document.body].forEach((page) => {
		page.style.overflow = "visible";
		page.style.touchAction = "auto";
	});
	by_id("timeline").classList.remove("flou");
	by_id("recap").classList.remove("flou");
	display(by_id("bulk_form"), false);
	display(by_id("jour_form"), false);
	state.menu_opened_date = null;
	// the cycles moved while the form was open: draw them again from the copy
	if (state.page_a_recharger) rebuild();
}

// The fields of the day form as {name, value}: what is ticked, filled or chosen, as a form sends them (a line break of a comment is CRLF)
function day_form_fields(form) {
	return Array.from(new FormData(form), ([name, value]) => ({name: name, value: typeof value === "string" ? value.replace(/\r?\n/g, "\r\n") : value}));
}

// The form is the full state of the day: it goes into the local copy at once and the page draws it
// (store_changed), then the store sends it; day_sent / day_failed / show_sync_status say how it went.
export function submit_menu(event) {
	display(by_id("jour_form_saving"), true);
	display(by_id("jour_form_saved"), false);
	display(by_id("jour_form_unsent"), false);
	by_id("form_save_time").value = dates.now_in_utc();
	const source = event && event.currentTarget;
	if (source && source.id == "form_fc") fc_note2form();
	else if (source && source.matches('input.fc_form_note[type="checkbox"]')) {
		if (source.checked) fc_boxes_unticked_by(source.id).forEach((id) => check(id, false));
		fc_form2note();
	}
	// any other field: the note stays as typed while it is not valid, the boxes would save only the part of it they could read
	else if (fc_note_regex.test(by_id("form_fc").value)) fc_form2note();
	fc_test_note();
	const note_is_valid = fc_note_regex.test(by_id("form_fc").value);
	if (note_is_valid) by_id("form_fc_saved").value = by_id("form_fc").value;
	if (by_id("ev_counter_start_actif").checked) by_id("ev_hidden_counter_start").value = by_id("ev_counter_start_nb").value;
	else by_id("ev_hidden_counter_start").value = 0;
	let d = day_form_fields(by_id("form_data"));
	// a note that is not valid is not sent: the day keeps the note it has, the rest of the form is saved
	if (!note_is_valid) d.find((field) => field.name == "fc_score").value = by_id("form_fc_saved").value;
	if (state.menu_opened_date != null) {
		let j = d.findIndex((field) => field.name == "date");
		if (j < 0) d.push({name: "date", value: state.menu_opened_date});
		else d[j].value = state.menu_opened_date;
	}
	moncycle_store.queue_day(day_to_api(d, state.description, state.form_temperature_unit || temperature_unit()));
}

export function bulk_submit_menu() {
	let nb_of_days = by_id("i_bulk_count").value;
	if (nb_of_days > 365) {
		alert(t("timeline.bulk_too_many_days", {max: 365}));
		return;
	}
	let menu_current_date = state.menu_opened_date;
	let menu_current_1st_day = by_id("ev_cycle_1st_day").checked;
	let date_cursor = dates.parse(menu_current_date);
	let j = 1;
	while (j <= nb_of_days && state.menu_opened_date!=state.day_timeline[menu_current_date]["cycle"]) {
		date_cursor.setDate(date_cursor.getDate()-1);
		state.menu_opened_date = dates.str(date_cursor);
		by_id("ev_cycle_1st_day").checked = state.menu_opened_date==state.day_timeline[menu_current_date]["cycle"];
		submit_menu();
		j += 1;
	}
	state.menu_opened_date = menu_current_date;
	if (menu_current_1st_day) by_id("ev_cycle_1st_day").checked = true;
}

// The temperature field in the unit of the account (the form carries what is typed; the body sent is in Celsius, see day_to_api). The unit
// the form was filled in is kept, so that a change of the setting while the form is open never reinterprets what was typed.
function show_temperature_unit() {
	const unit = temperature_unit();
	state.form_temperature_unit = unit;
	const field = by_id("form_temp");
	field.max = unit === "F" ? "210" : "99";
	field.placeholder = t("timeline.temperature_placeholder", {example: format_number(unit === "F" ? 97.7 : 36.5, {minimumFractionDigits: 1})});
	by_id("form_temp_unit").textContent = t("timeline.temperature_unit", {unit: unit});
}

export function suppr_day_timeline() {
	let date = dates.parse(by_id("form_date").value);
	date.setHours(9);
	if (confirm(t("timeline.confirm_delete_day", {date: date_long(date)}))) {
		moncycle_store.queue_delete(dates.str(date), dates.now_in_utc());
		close_menu();
	}
}

export function fc_test_note() {
	const note = by_id("form_fc").value;
	const message = by_id("fc_msg");
	if (!note) {
		message.replaceChildren();
	}
	else if (fc_note_regex.test(note.toUpperCase())) {
		message.textContent = t("timeline.fc_syntax_valid");
		message.classList.add("vert");
		message.classList.remove("rouge");
	}
	else {
		message.textContent = t("timeline.fc_syntax_invalid");
		message.classList.add("rouge");
		message.classList.remove("vert");
	}
}

function fc_boxes() {
	return by_id("form_data").querySelectorAll('input.fc_form_note[type="checkbox"]');
}

// The note the boxes make.
export function fc_form2note() {
	const ticked = [...fc_boxes()].filter((box) => box.checked).map((box) => box.id);
	by_id("form_fc").value = fc_note_from_boxes(ticked, by_id("form_fc").value);
}

// The boxes the note makes.
export function fc_note2form() {
	const ticked = fc_boxes_from_note(by_id("form_fc").value);
	fc_boxes().forEach((box) => { box.checked = ticked.includes(box.id); });
}
