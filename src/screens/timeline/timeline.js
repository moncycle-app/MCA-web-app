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
import { moncycle_news } from "/js/services/news.js";
import * as dates from "/js/model/dates.js";
import { t, t_map } from "/js/core/i18n.js";
import { blank_day, day_from_api } from "/js/model/day.js";
import { constante_from_api, cycle_line_length, cycle_of, cycle_span, structure_of } from "/js/model/cycles.js";
import { description_from_api } from "/js/model/descriptions.js";
import { bind_desc_add_forms, bulk_show_hide, bulk_submit_menu, close_menu, fc_note2form, go_blank_or_empty, open_menu, refresh_day, submit_menu, suppr_day_timeline } from "/screens/timeline/day_form.js";
import { cycle2graph, graph_preparation_data, graph_update } from "/screens/timeline/chart_view.js";
import { cycle2recap, day_timeline2recap } from "/screens/timeline/recap_view.js";
import { cycle2timeline, day_timeline2timeline, form_nouveau_cycle, trois_jours } from "/screens/timeline/cycle_view.js";
import { state, reset_state } from "/screens/timeline/state.js";

const $ = globalThis.$;

// the sentence of a refused or failed export (the API's own words are English)
function export_failed_text(failure) {
	const code = failure.issues.length ? failure.issues[0].code : failure.code;
	const reasons = t_map("timeline.export_reason");
	return t("timeline.export_failed", {reason: reasons[code] || (failure.status === 0 ? reasons.network : reasons.refused)});
}



/* -----------------------------------------------------------------------
** START
**
** The page is drawn from the local copy (js/store.js) at once, when there is one, and the sync
** that follows brings what changed elsewhere. A change of the user is applied to the copy first,
** then sent: the page shows an error when the server could not take it.
** ====================================================================== */
// What lives as long as the screen: the store's listeners (each gives back its way to stop) and the handlers on the window and the document,
// all under the namespace .timeline
let stop_listening = [];

function start_timeline(ctx) {
	reset_state();
	console.log(t("timeline.console_banner"));
	state.date_loaded = dates.str(dates.now());
	stop_listening = [
		moncycle_store.on("status", show_sync_status),
		moncycle_store.on("changed", store_changed),
		moncycle_store.on("sent", day_sent),
		moncycle_store.on("failed", day_failed),
	];
	$(document).on("click.timeline", ".cycle_options a", download_export);
	$("#charger_cycle").click(charger_cycle);
	$("#jour_form_close").click(close_menu);
	$("#jour_form_submit").click(submit_menu);
	$("#jour_form_next").click(open_menu);
	$("#jour_form_prev").click(open_menu);
	$("#bulk_but_submit").click(bulk_submit_menu);
	$("#jour_form_bulk_but").click(bulk_show_hide);
	$("#jour_form #form_data input:not(.desc_add_input), #jour_form textarea").on("change", submit_menu);
	$("#form_fc").on("keyup", fc_note2form);
	$("#jour_form_suppr").click(suppr_day_timeline);
	$("#sync_status").on("click", "#sync_retry", function () { moncycle_store.sync().catch(function () { }); });
	$("#sync_status").on("click", "#sync_dismiss", moncycle_store.dismiss_error);
	bind_desc_add_forms();
	$("#but_mini_maxi").click(mini_maxi_switch);
	$("#go_baby").click(go_blank_or_empty);
	if (localStorage.mini_maxi == "mini") state.mini_maxi = "maxi";
	else state.mini_maxi = "mini";
	mini_maxi_switch();
	$("#form_time_temp_taken").focus(function () {
		if($("#form_time_temp_taken").val().trim().length==0) {
			let d  = new Date();
			let h = d.getHours();
			let m = d.getMinutes();
			$("#form_time_temp_taken").val((h<10 ? "0"+h : h) + ":" + (m<10 ? "0"+m : m));
			submit_menu();
		}
	});
	$(window).on("scroll.timeline", function() {
		if(state.timeline_asc && $(window).scrollTop() + $(window).height() +50 >= $(document).height()){
			charger_cycle();
		}
	});
	$(window).on("focus.timeline", function() {
		if (dates.str(dates.now()) != state.date_loaded) location.reload(false);
		return false;
	});
	// another tab wrote its copy: nothing to do. It logged out, or logged in as someone else: leave.
	window.addEventListener("storage", function (event) {
		if (event.key !== null && event.key != "auth") return;
		if (localStorage.auth != state.constante.no_user_account) window.location.href = window.location.href;
	}, {signal: ctx.signal});
	if (moncycle_store.account) show_account();
}

function stop_timeline() {
	stop_listening.forEach((stop) => stop());
	stop_listening = [];
	$(document).off(".timeline");
	$(window).off(".timeline");
	clearTimeout(state.last_write_timer);
	Object.values(state.graphs).forEach((graph) => graph.destroy && graph.destroy());
}

export const screen = {
	name: "timeline",
	path: "/",
	auth: true,
	html: "/screens/timeline/timeline.html",
	title: () => t("timeline.document_title"),
	mount(root, ctx) { start_timeline(ctx); },
	unmount() { stop_timeline(); },
};

// what decides how the cycles are laid out: when it changes in the copy, they have to be drawn again
// The copy holds the account: draw the page header and the cycles from it.
export function show_account() {
	show_header();
	state.structure = structure_of(moncycle_store.account);
	state.cycle_columns = cycle_line_length(state.constante.all_cycles_1st_day, state.constante.all_observation_paused_dates);
	document.documentElement.style.setProperty("--cycle-cols", state.cycle_columns);
	if (state.cycle_curseur == 0) remplir_page_de_cycle();
}

export function show_header() {
	state.constante = constante_from_api(moncycle_store.account);
	state.timeline_asc = state.constante.timeline_asc;
	state.description = moncycle_store.all_descriptions().map(description_from_api);
	document.title = t("timeline.page_title", {name: state.constante.nickname});
	// the name is free text: text first, then the badge (markup of ours)
	$("#name").text(state.constante.nickname);
	if (state.constante.sponsor) $("#name").append(document.createTextNode(t("timeline.sponsor_badge")));
	charger_actu();
	$(".main_button").css("display","inline-block");
	if (state.timeline_asc) $("#charger_cycle").hide();
	else $("#charger_cycle").show();
}

// Draws every cycle again from the copy (the cycles changed, or the way they are laid out).
export function rebuild() {
	state.page_a_recharger = false;
	$.each(state.graphs, function (id, graph) { graph.destroy(); });
	state.graphs = {};
	state.graph_data = {};
	state.sommets = [];
	state.counter_starts = {};
	state.day_timeline = {};
	state.cycle_curseur = 0;
	state.form_nouveau_cycle_active = false;
	state.cycle_title_opened = null;
	$("#timeline").empty();
	$("#recap").empty();
	$("#charger_cycle").prop("disabled", false);
	show_account();
}

// What happened to the copy: the days that changed are drawn again, and the cycles when their
// structure moved (at once, or when the day form is closed if it is open).
export function store_changed(change) {
	if (change.descriptions) state.description = moncycle_store.all_descriptions().map(description_from_api);
	if (!moncycle_store.account) return;
	if (state.structure === null) {
		show_account();
		return;
	}
	if (change.account || change.source == "sync") {
		state.page_a_recharger = structure_of(moncycle_store.account) !== state.structure;
		if (state.page_a_recharger && state.menu_opened_date === null) {
			rebuild();
			return;
		}
		// the cycles stay as drawn: only the header (name, sponsor) can have changed
		if (!state.page_a_recharger) show_header();
	}
	change.days.forEach(refresh_day);
}

// The write of a day was taken by the server.
export function day_sent(detail) {
	if (state.menu_opened_date === null || moncycle_store.pending[state.menu_opened_date]) return;
	// the bulk form saves the days before the open one: nothing of the open day is waiting once the queue is empty
	if (detail.date != state.menu_opened_date && Object.keys(moncycle_store.pending).length > 0) return;
	$("#jour_form_saving").hide();
	$("#jour_form_unsent").hide();
	$("#jour_form_saved").show();
}

export function day_failed(detail) {
	if (detail.date != state.menu_opened_date && Object.keys(moncycle_store.pending).length > 0) return;
	$("#jour_form_saving").hide();
	$("#jour_form_unsent").hide();
}

// The bar at the bottom of the page, and the indicator of the day form. Silent unless something needs the user.
export function show_sync_status(status) {
	let text = "";
	let css = "sync_error";
	if (status.error && status.error.kind == "rejected") text = t("timeline.sync_rejected", {message: status.error.message});
	else if (status.pending > 0 && status.error) text = t("timeline.sync_not_sent", {count: status.pending});
	else if (status.error) {
		text = status.error.kind == "network" ? t("timeline.sync_offline") : t("timeline.sync_server_error");
		css = "sync_warning";
	}
	$("#sync_status").empty().attr("class", "sync_status " + css).toggle(text != "");
	if (text != "") {
		$("#sync_status").append($("<span>").text(text));
		if (status.error && status.error.kind == "rejected") $("#sync_status").append(" ").append($("<button>", {type: "button", id: "sync_dismiss"}).text(t("timeline.sync_dismiss")));
		else $("#sync_status").append(" ").append($("<button>", {type: "button", id: "sync_retry"}).text(t("timeline.sync_retry")));
	}
	let unsent = status.pending > 0 && status.error && status.error.kind != "rejected";
	if (unsent) $("#jour_form_saving").hide();
	$("#jour_form_unsent").toggle(!!(unsent && state.menu_opened_date !== null && moncycle_store.pending[state.menu_opened_date]));
}

export function mini_maxi_switch() {
	if (state.mini_maxi=="maxi"){
		$("#timeline").hide();
		$("#recap").show();
		$("#but_mini_maxi").text(t("timeline.but_view_maxi"));
		state.mini_maxi="mini";
		localStorage.mini_maxi="mini";
	}
	else {
		$("#timeline").show();
		$("#recap").hide();
		$("#but_mini_maxi").text(t("timeline.but_view_mini"));
		state.mini_maxi="maxi";
		localStorage.mini_maxi="maxi";
	}
	if (state.cycle_curseur == 0) remplir_page_de_cycle();
	if (state.timeline_asc && $(document).height()<=$(window).height()) remplir_page_de_cycle();
}

export function remplir_page_de_cycle() {
	if (!state.constante || !state.constante.all_cycles_1st_day) return;
	if (state.timeline_asc) {
		while ($(window).height() == $(document).height() && state.cycle_curseur < state.constante.all_cycles_1st_day.length) {
			charger_cycle();
		}
		charger_cycle();
		if ($(window).height() == $(document).height()) form_nouveau_cycle();
	}
	else charger_cycle();
}

export function charger_actu() {
	let url = moncycle_store.account ? moncycle_store.account.newsUrl : null;
	if (!url || state.news_requested) return;
	state.news_requested = true;
	moncycle_news.load(url).then(function (item) {
		if (item) show_actu(item);
	});
}

export function show_actu(item) {
	if (localStorage.actu_hidden === item.url) return;
	$("#actu_title").text(item.title);
	$("#actu_text").text(item.description);
	$("#lire_actu").off("click").click(function () {
		window.open(item.url, "_blank", "noopener,noreferrer");
	});
	$("#fermer_actu").off("click").click(function () {
		localStorage.actu_hidden = item.url;
		$("#actu").hide();
	});
	$("#actu").show();
}

export function charger_cycle() {
	if (state.cycle_curseur >= state.constante.all_cycles_1st_day.length) {
		form_nouveau_cycle();
		return;
	}
	let c = state.cycle_curseur;
	state.cycle_curseur += 1;
	const span = cycle_span(state.constante.all_cycles_1st_day, state.constante.all_observation_paused_dates, c);
	let date_cycle_str = span.start;
	let date_fin = span.end_date;
	let date_cycle = span.start_date;
	let form_nouv_cycle = span.new_cycle_form;
	if (form_nouv_cycle && state.timeline_asc) form_nouveau_cycle(false);
	let nb_jours = span.days;
	if (state.timeline_asc) {
		$("#timeline").append(cycle2timeline(date_cycle_str, nb_jours, date_fin));
		$("#recap").append(cycle2recap(date_cycle_str, nb_jours, date_fin));
	}
	else {
		$("#timeline").prepend(cycle2timeline(date_cycle_str, nb_jours, date_fin));
		$("#recap").prepend(cycle2recap(date_cycle_str, nb_jours, date_fin));
	}
	let dates_data_holder = {};
	for (let pas = 0; pas < nb_jours; pas++) {
		let date_obs = new Date(date_cycle);
		date_obs.setDate(date_obs.getDate()+pas);
		let date_obs_str = dates.str(date_obs);
		let data = view_day(date_obs_str, date_cycle_str, pas+1);
		dates_data_holder[date_obs_str] = data;
		state.day_timeline[date_obs_str] = data;
		if (state.timeline_asc) $(`#c-${date_cycle_str} .contenu`).prepend(day_timeline2timeline(data));
		else $(`#c-${date_cycle_str} .contenu`).append(day_timeline2timeline(data));
		$(`#rc-${date_cycle_str} .contenu`).append(day_timeline2recap(data));
		track_day(date_obs_str, data);
	}
	$(`.pas_${state.constante.nfp_method_name}`).css("display", "none");
	trois_jours();
	graph_preparation_data(dates_data_holder);
	if (state.constante.nfp_method == 1 || state.constante.nfp_method == 4) {
		cycle2graph(date_cycle_str);
		graph_update(date_cycle_str);
	}
	if (form_nouv_cycle && !state.timeline_asc) form_nouveau_cycle(false);
}

// A day of the local copy, in the flat shape the drawing functions read. A date that holds nothing is
// an empty day; $cycle and $pos say where it stands when the caller knows.
export function view_day(date, cycle, pos) {
	let day = moncycle_store.days[date];
	if (!day) {
		day = blank_day(date);
		Object.assign(day, cycle ? {cycleStartDate : cycle, cycleDay : pos} : cycle_of((moncycle_store.account || {}).allCyclesFirstDay, date));
	}
	return day_from_api(day, state.description);
}

// the peak days and the counters the "+1 +2 +3" marks of the other days come from
export function track_day(date, data) {
	if (data.is_peak && $.inArray(date, state.sommets)<0) state.sommets.push(date);
	else if (!data.is_peak && $.inArray(date, state.sommets)>=0) state.sommets.splice($.inArray(date, state.sommets), 1);
	if (data.counter_start) state.counter_starts[date] = data.counter_start;
	else if (date in state.counter_starts) delete state.counter_starts[date];
}

// A click on an export of a cycle: the file is fetched and saved, a failure is told (the API answers it in JSON, in English).
export function download_export(event) {
	event.preventDefault();
	moncycle_store.download($(this).attr("href")).catch(function (failure) {
		alert(export_failed_text(failure));
	});
}
