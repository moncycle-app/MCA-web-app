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

import { moncycle_store } from "/js/model/store.js";
import * as dates from "/js/model/dates.js";
import { t, date_short, date_long, clock } from "/js/core/i18n.js";
import { day_to_api } from "/js/model/day.js";
import { fc_note_regex } from "/js/model/fc_notation.js";
import { type_from_int, unsent_description } from "/js/model/descriptions.js";
import { day_timeline2recap } from "/screens/timeline/recap_view.js";
import { day_timeline2timeline, trois_jours } from "/screens/timeline/cycle_view.js";
import { graph_preparation_data } from "/screens/timeline/chart_view.js";
import { rebuild, track_day, view_day } from "/screens/timeline/timeline.js";
import { state } from "/screens/timeline/state.js";

const $ = globalThis.$;

export function bulk_show_hide() {
	if ($("#bulk_form").is(":hidden")) $("#bulk_form").show();
	else $("#bulk_form").hide();
}

// The moment of the last save of the open day, at the foot of its form (empty for a day never saved).
// A recent one says "maintenant" and the line is drawn again when the two minutes are over.
export function show_last_write(day) {
	clearTimeout(state.last_write_timer);
	let moment = day.last_write ? new Date(day.last_write) : null;
	let box = $("#jour_form_last_write").empty().attr("title", null);
	if (moment === null || isNaN(moment)) return;
	let age = Date.now() - moment.getTime();
	let recent = Math.abs(age) < state.last_write_recent_ms;
	box.attr("title", t("timeline.last_write_title", {date: date_long(moment), clock: clock(moment)}));
	box.append($("<span>").text(t("timeline.last_write_label")));
	box.append($("<b>").text(recent ? t("timeline.last_write_now") : t("timeline.last_write", {date: date_short(moment), year: moment.getFullYear(), clock: clock(moment)})));
	if (recent) state.last_write_timer = setTimeout(() => show_last_write(day), state.last_write_recent_ms - age);
}

// A day changed in the copy: draw it again, if it is on the page.
export function refresh_day(date) {
	let shown = state.day_timeline[date];
	if (!shown) return;
	let data = view_day(date, shown.cycle, shown.pos);
	state.day_timeline[date] = data;
	if (date == state.menu_opened_date) show_last_write(data);
	$(`#o-${date}`).replaceWith(day_timeline2timeline(data));
	$(`#ro-${date}`).replaceWith(day_timeline2recap(data));
	track_day(date, data);
	$(`.pas_${state.constante.nfp_method_name}`).css("display", "none");
	trois_jours();
	graph_preparation_data({[date]: data});
}

export function go_blank_or_empty() {
	if ($("#go_baby")[0].checked) $("#blank_or_empty").text(t("timeline.target_blank"));
	else $("#blank_or_empty").text(t("timeline.target_empty"));
}

// A chip is the description's name (see day_to_api); its id only ties the label to the box.
export function render_desc_chip(sdesc, active) {
	let id = "i_desc_" + state.desc_chip_count++;
	return $("<span>", {"class": "desc_chip"})
		.append($("<input>", {type: "checkbox", name: "description[]", value: sdesc.name, id: id, "class": "i_desc"}).prop("checked", !!active))
		.append($("<label>", {"for": id}).text(sdesc.name));
}

// wires the "+ nouvelle sensation/observation" affordances in jour_form; there is no
// equivalent for "autre" since that legacy type can't be created or converted to (see open_menu)
export function bind_desc_add_forms() {
	$(".desc_add_toggle").on("click", function () {
		$(this).hide();
		$(this).siblings(".desc_add_form").show().find(".desc_add_input").val("").focus();
	});
	$(".desc_add_cancel").on("click", function () {
		let form = $(this).closest(".desc_add_form");
		form.hide().find(".desc_add_status").empty();
		form.siblings(".desc_add_toggle").show();
	});
	$(".desc_add_submit").on("click", function () {
		desc_add_submit($(this).closest(".desc_add_form"));
	});
	$(".desc_add_input").on("keydown", function (event) {
		if (event.key !== "Enter") return;
		event.preventDefault();
		desc_add_submit($(this).closest(".desc_add_form"));
	});
}

export function desc_add_submit(form) {
	let desc_type = parseInt(form.data("desc-type"));
	let name = form.find(".desc_add_input").val().trim().toLowerCase();
	let status = form.find(".desc_add_status");
	if (name == "") return;
	let duplicate = state.description.some(d => d.name.toLowerCase() == name);
	if (duplicate) {
		status.text(t("timeline.desc_add_duplicate", {name: name}));
		return;
	}
	// kept here and sent when the server can be reached (js/store.js): the chip is there at once, offline too
	moncycle_store.queue_description(name, type_from_int[desc_type], dates.now_in_utc());
	let desc = state.description.find(d => d.name == name) || unsent_description(name, desc_type);
	let chip = render_desc_chip(desc, false);
	$(state.desc_container_id[desc_type]).append(chip);
	chip.find(".i_desc").on("change", submit_menu);
	form.find(".desc_add_input").val("").focus();
	status.text(t("timeline.desc_add_saved"));
}

export function open_menu(e, date = null) {
	let o_date;
	if (date) o_date = dates.parse(date);
	else o_date = dates.parse($(this).attr('date'));
	date = dates.str(o_date);
	state.menu_opened_date = date;
	let j = state.day_timeline[state.menu_opened_date];
	let stamp = j.stamp? j.stamp : "";
	$("#jour_form_titre").empty().append(document.createTextNode(date_long(o_date) + " "), $("<span>").text(t("timeline.day_number", {n: j.pos})));
	let arrow = {"next" : t("timeline.arrow_up"), "prev" : t("timeline.arrow_down")};
	if (!state.timeline_asc) arrow = {"next" : t("timeline.arrow_down"), "prev" : t("timeline.arrow_up")};
	$("#jour_form_prev").text(t("timeline.but_day_step", {arrow: arrow["prev"], day: t("timeline.day_number", {n: j.pos-1})}));
	$("#jour_form_next").text(t("timeline.but_day_step", {arrow: arrow["next"], day: t("timeline.day_number", {n: j.pos+1})}));
	let date_cursor = new Date(j.date_obs);
	date_cursor.setDate(date_cursor.getDate()+1);
	let str_date_cursor = dates.str(date_cursor);
	if (state.day_timeline[str_date_cursor] && !state.day_timeline[str_date_cursor].cycle_1st_day) {
		$("#jour_form_next").attr("date", str_date_cursor);
		$("#jour_form_next").show();
	}
	else $("#jour_form_next").hide();
	date_cursor.setDate(date_cursor.getDate()-2);
	str_date_cursor = dates.str(date_cursor);
	if (j.pos-1 > 0 && state.day_timeline[str_date_cursor]) {
		$("#jour_form_prev").attr("date", str_date_cursor);
		$("#jour_form_prev").show();
	}
	else $("#jour_form_prev").hide();
	$("#jour_form #form_data")[0].reset();
	$("#fc_msg").empty();
	$("#jour_form_saving").hide();
	$("#jour_form_saved").hide();
	$("#jour_form_unsent").toggle(!!moncycle_store.pending[date]);
	$("#form_date").val(j.date_obs);
	if (j.fc_score && (state.constante.nfp_method==3 || state.constante.nfp_method==4)) {
		$("#form_fc").val(j.fc_score);
		fc_note2form();
		fc_test_note();
	}
	if (j.fc_arrow && (state.constante.nfp_method==3 || state.constante.nfp_method==4)) $("#fc_f" + state.arrow_id[j.fc_arrow]).prop('checked', true);
	if (stamp.includes("BB") && stamp.length>2) {
		$("#go_" + state.stamp_class["BB"]).prop('checked', true);
		stamp = stamp.replace("BB", "");
	}
	if (state.stamp_class[stamp]) $("#go_" + state.stamp_class[stamp]).prop('checked', true);
	go_blank_or_empty();
	$("#form_temp").val(j.temperature);
	$("#form_time_temp_taken").val(j.time_temp_taken);
	$("#menu_observation_container").empty();
	$("#menu_sensation_container").empty();
	$("#menu_autre_container").empty();
	let active_desc = [];
	for (const adesc of j.description) active_desc.push(adesc.name);
	let has_autre = false;
	for (const sdesc of state.description) {
		let active = active_desc.includes(sdesc.name);
		let container_id = state.desc_container_id[sdesc.type];
		if (!container_id) continue;
		if (sdesc.type == 0) has_autre = true;
		$(container_id).append(render_desc_chip(sdesc, active));
	}
	// "autre" is a legacy type new descriptions can't be created as or converted to;
	// only show the category when a legacy description of that type still exists
	$("#desc_category_other").toggle(has_autre);
	$(".i_desc").on("change", submit_menu);
	$(".desc_add_form").hide().find(".desc_add_status").empty();
	$(".desc_add_toggle").show();
	if (j.cycle_1st_day) $("#ev_cycle_1st_day").prop('checked', true);
	if (j.union_sex) $("#ev_union").prop('checked', true);
	if (j.is_peak) $("#ev_is_peak").prop('checked', true);
	if (j.counter_start && j.counter_start > 0) {
		$("#ev_counter_start_actif").prop('checked', true);
		$("#ev_counter_start_nb").val(j.counter_start);
		$("#ev_hidden_counter_start").val(j.counter_start)
	}
	if (j.day_not_observed) $("#ev_jesaispas").prop('checked', true);
	if (j.observation_paused) $("#ev_observation_paused").prop('checked', true);
	$("#from_com").val(j.comment);
	show_last_write(j);
	$("html, body").css({
		"overflow": "hidden",
		"touch-action": "none"
	});
	$("#jour_form").show();
	$("#jour_form").scrollTop(0);
	$("#timeline").addClass("flou");
	$("#recap").addClass("flou");
}

export function close_menu(e) {
	$("html, body").css({
		"overflow": "visible",
		"touch-action": "auto"
	});
	$("#timeline").removeClass("flou");
	$("#recap").removeClass("flou");
	$("#bulk_form").hide();
	$("#jour_form").hide();
	state.menu_opened_date = null;
	// the cycles moved while the form was open: draw them again from the copy
	if (state.page_a_recharger) rebuild();
}

// The form is the full state of the day: it goes into the local copy at once and the page draws it
// (store_changed), then the store sends it; day_sent / day_failed / show_sync_status say how it went.
export function submit_menu() {
	$("#jour_form_saving").show();
	$("#jour_form_saved").hide();
	$("#jour_form_unsent").hide();
	$("#form_save_time").val(dates.now_in_utc());
	if (this && this.id == "form_fc") fc_note2form();
	else fc_form2note();
	fc_test_note();
	if ($("#ev_counter_start_actif")[0].checked) $("#ev_hidden_counter_start").val($("#ev_counter_start_nb").val());
	else $("#ev_hidden_counter_start").val(0);
	let d = $("#jour_form #form_data").serializeArray();
	if (state.menu_opened_date != null) {
		let j = 0;
		while (j<d.length && d[j]["name"]!="date") j += 1;
		if (j == d.length) d.push({"date" : state.menu_opened_date});
		else d[j]["value"] = state.menu_opened_date;
	}
	moncycle_store.queue_day(day_to_api(d, state.description));
}

export function bulk_submit_menu() {
	let nb_of_days = $("#i_bulk_count").val();
	if (nb_of_days > 365) {
		alert(t("timeline.bulk_too_many_days", {max: 365}));
		return;
	}
	let menu_current_date = state.menu_opened_date;
	let menu_current_1st_day = $("#ev_cycle_1st_day").is(':checked');
	let date_cursor = dates.parse(menu_current_date);
	let j = 1;
	while (j <= nb_of_days && state.menu_opened_date!=state.day_timeline[menu_current_date]["cycle"]) {
		date_cursor.setDate(date_cursor.getDate()-1);
		state.menu_opened_date = dates.str(date_cursor);
		if (state.menu_opened_date==state.day_timeline[menu_current_date]["cycle"]) $("#ev_cycle_1st_day").prop('checked', true);
		else $("#ev_cycle_1st_day").prop('checked', false);
		submit_menu();
		j += 1;
	}
	state.menu_opened_date = menu_current_date;
	if (menu_current_1st_day) $("#ev_cycle_1st_day").prop('checked', true);
}

export function suppr_day_timeline() {
	let date = dates.parse($("#form_date").val());
	date.setHours(9);
	if (confirm(t("timeline.confirm_delete_day", {date: date_long(date)}))) {
		moncycle_store.queue_delete(dates.str(date), dates.now_in_utc());
		close_menu();
	}
}

export function fc_test_note() {
	if (!$("#form_fc").val()) {
		$("#fc_msg").empty();
	}
	else if (fc_note_regex.test($("#form_fc").val().toUpperCase())) {
		$("#fc_msg").text(t("timeline.fc_syntax_valid"));
		$("#fc_msg").addClass("vert");
		$("#fc_msg").removeClass("rouge");
	}
	else {
		$("#fc_msg").text(t("timeline.fc_syntax_invalid"));
		$("#fc_msg").addClass("rouge");
		$("#fc_msg").removeClass("vert");
	}
}

export function fc_form2note() {
	let note = $('input[name="fc_regles"]:checked').map(function(){ return this.value }).get().join("");
	if (note.length && !note.endsWith(' ')) note += " ";
	note += $('.fc_sens:checked').map(function(){ return this.value }).get().join("");
	note += $(".fc_obs:checked").map(function(){ return this.value }).get().join("");
	note += $('.fc_sens_L:checked').val() ? $('.fc_sens_L:checked').val() : "";
	if (note.length && !note.endsWith(' ')) note += " ";
	note += $('input[name="fc_rec"]:checked').map(function(){ return this.value }).get().join("");
	if (note.length && !note.endsWith(' ')) note += " ";
	note += $('input[name="fc_dou"]:checked').map(function(){ return this.value }).get().join("");
	$("#form_fc").val(note.trim());
	return note;
}

export function fc_note2form() {
	let note = $("#form_fc").val().trim().toUpperCase();
	if (note.startsWith('L') && !note.startsWith('LAP')) {
		$("#fc_rl").prop("checked", true);
		note = note.slice(1);
	}
	else {
		$("#fc_rl").prop("checked", false);
	}
	['10DL', '10SL', '10WL', 'RAP', 'LAP', 'X1', 'X2', 'X3', 'AD', 'AP', 'VL', 'VH', '2W', '10', 'H', 'M', 'L', 'B', '0', '2', '4', '6', '8', 'C', 'G', 'K', 'P', 'Y', 'R'].forEach(c => {
		if (note.includes(c)) {
			$("#fc_" + c.toLowerCase()).prop("checked", true);
			note = note.replace(c,'');
		}
		else $("#fc_" + c.toLowerCase()).prop("checked", false);
	});
	note = $("#form_fc").val().trim().toUpperCase();
	['10DL', '10SL', '10WL', '10', '2W'].forEach(c => {
		note = note.replace(c,'');
	});
	['RAP', 'LAP', 'AP'].forEach(c => {
		note = note.replace(c,'');
	});
	['X1', 'X2', 'X3', 'AD'].forEach(c => {
		note = note.replace(c,'');
	});
	['VL', 'VH', 'H', 'M', 'L'].forEach(c => {
		note = note.replace(c,'');
	});
	['0', '2', '4', '6', '8'].forEach(c => {
		note = note.replace(c,'');
	});
	return note;
}
