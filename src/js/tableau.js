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

import { moncycle_config } from "/js/config.js";
import { moncycle_store } from "/js/model/store.js";
import * as dates from "/js/model/dates.js";
import { fc_note_regex } from "/js/model/fc_notation.js";
import { day_from_api, day_to_api, blank_day } from "/js/model/day.js";
import { description_from_api, unsent_description, type_to_int, type_from_int } from "/js/model/descriptions.js";
import { cycle_of, cycle_span, cycle_line_length, constante_from_api, structure_of, peak_follow_days, counter_days } from "/js/model/cycles.js";
import { moncycle_news } from "/js/news.js";
import { t, t_map, t_node, date_short, date_long, date_row, clock, ready as i18n_ready } from "/js/core/i18n.js";

const $ = globalThis.$;

// "Cycle du 3 mars au 29 mars de 27j": the end and the number are elements of their own (the stylesheet colours them)
function cycle_title_node(key, key_end, start, end, nb) {
	const end_span = $("<span>", {class: "cycle_fin"}).text(t(key_end, {end: date_short(end)}))[0];
	const nb_span = $("<span>", {class: "nb_jours"}).text(nb)[0];
	return t_node(key, {start: date_short(start), end: end_span, nb: nb_span});
}
// the sentence of a refused or failed export (the API's own words are English)
function export_failed_text(failure) {
	const code = failure.issues.length ? failure.issues[0].code : failure.code;
	const reasons = t_map("timeline.export_reason");
	return t("timeline.export_failed", {reason: reasons[code] || (failure.status === 0 ? reasons.network : reasons.refused)});
}

export const moncycle_app = {
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

	/* -----------------------------------------------------------------------
	** START
	**
	** The page is drawn from the local copy (js/store.js) at once, when there is one, and the sync
	** that follows brings what changed elsewhere. A change of the user is applied to the copy first,
	** then sent: the page shows an error when the server could not take it.
	** ====================================================================== */
	letsgo : function() {
		console.log(t("timeline.console_banner"));
		if (!localStorage.auth) {
			window.location.replace('/auth');
			return;
		}
		moncycle_app.date_loaded = dates.str(dates.now());
		moncycle_store.init();
		moncycle_store.on("status", moncycle_app.show_sync_status);
		moncycle_store.on("changed", moncycle_app.store_changed);
		moncycle_store.on("sent", moncycle_app.day_sent);
		moncycle_store.on("failed", moncycle_app.day_failed);
		$(document).on("click", ".cycle_options a", moncycle_app.download_export);
		$("#charger_cycle").click(moncycle_app.charger_cycle);
		$("#jour_form_close").click(moncycle_app.close_menu);
		$("#jour_form_submit").click(moncycle_app.submit_menu);
		$("#jour_form_next").click(moncycle_app.open_menu);
		$("#jour_form_prev").click(moncycle_app.open_menu);
		$("#bulk_but_submit").click(moncycle_app.bulk_submit_menu);
		$("#jour_form_bulk_but").click(moncycle_app.bulk_show_hide);
		$("#jour_form #form_data input:not(.desc_add_input), #jour_form textarea").on("change", moncycle_app.submit_menu);
		$("#form_fc").on("keyup", moncycle_app.fc_note2form);
		$("#jour_form_suppr").click(moncycle_app.suppr_day_timeline);
		$("#sync_status").on("click", "#sync_retry", function () { moncycle_store.sync().catch(function () { }); });
		$("#sync_status").on("click", "#sync_dismiss", moncycle_store.dismiss_error);
		moncycle_app.bind_desc_add_forms();
		$("#but_mini_maxi").click(moncycle_app.mini_maxi_switch);
		$("#go_baby").click(moncycle_app.go_blank_or_empty);
		if (localStorage.mini_maxi == "mini") moncycle_app.mini_maxi = "maxi";
		else moncycle_app.mini_maxi = "mini";
		moncycle_app.mini_maxi_switch();
		$("#form_time_temp_taken").focus(function () {
			if($("#form_time_temp_taken").val().trim().length==0) {
				let d  = new Date();
				let h = d.getHours();
				let m = d.getMinutes();
				$("#form_time_temp_taken").val((h<10 ? "0"+h : h) + ":" + (m<10 ? "0"+m : m));
				moncycle_app.submit_menu();
			}
		});
		$(window).scroll(function() {
			if(moncycle_app.timeline_asc && $(window).scrollTop() + $(window).height() +50 >= $(document).height()){
				moncycle_app.charger_cycle();
			}
		});
		$(window).focus(function() {
			if (dates.str(dates.now()) != moncycle_app.date_loaded) location.reload(false);
			return false;
		})
		// another tab wrote its copy: nothing to do. It logged out, or logged in as someone else: leave.
		window.addEventListener("storage", function (event) {
			if (event.key !== null && event.key != "auth") return;
			if (localStorage.auth != moncycle_app.constante.no_user_account) window.location.href = window.location.href;
		}, false);
		if (moncycle_store.account) moncycle_app.show_account();
		moncycle_store.sync().catch(function () { });
	},
	// what decides how the cycles are laid out: when it changes in the copy, they have to be drawn again
	// The copy holds the account: draw the page header and the cycles from it.
	show_account : function () {
		moncycle_app.show_header();
		moncycle_app.structure = structure_of(moncycle_store.account);
		moncycle_app.cycle_columns = cycle_line_length(moncycle_app.constante.all_cycles_1st_day, moncycle_app.constante.all_observation_paused_dates);
		document.documentElement.style.setProperty("--cycle-cols", moncycle_app.cycle_columns);
		if (moncycle_app.cycle_curseur == 0) moncycle_app.remplir_page_de_cycle();
	},
	cycle_columns : 35,
	show_header : function () {
		moncycle_app.constante = constante_from_api(moncycle_store.account);
		moncycle_app.timeline_asc = moncycle_app.constante.timeline_asc;
		moncycle_app.description = moncycle_store.all_descriptions().map(description_from_api);
		document.title = t("timeline.page_title", {name: moncycle_app.constante.nickname});
		// the name is free text: text first, then the badge (markup of ours)
		$("#name").text(moncycle_app.constante.nickname);
		if (moncycle_app.constante.sponsor) $("#name").append(document.createTextNode(t("timeline.sponsor_badge")));
		moncycle_app.charger_actu();
		$(".main_button").css("display","inline-block");
		if (moncycle_app.timeline_asc) $("#charger_cycle").hide();
		else $("#charger_cycle").show();
	},
	// Draws every cycle again from the copy (the cycles changed, or the way they are laid out).
	rebuild : function () {
		moncycle_app.page_a_recharger = false;
		$.each(moncycle_app.graphs, function (id, graph) { graph.destroy(); });
		moncycle_app.graphs = {};
		moncycle_app.graph_data = {};
		moncycle_app.sommets = [];
		moncycle_app.counter_starts = {};
		moncycle_app.day_timeline = {};
		moncycle_app.cycle_curseur = 0;
		moncycle_app.form_nouveau_cycle_active = false;
		moncycle_app.cycle_title_opened = null;
		$("#timeline").empty();
		$("#recap").empty();
		$("#charger_cycle").prop("disabled", false);
		moncycle_app.show_account();
	},
	// What happened to the copy: the days that changed are drawn again, and the cycles when their
	// structure moved (at once, or when the day form is closed if it is open).
	store_changed : function (change) {
		if (change.descriptions) moncycle_app.description = moncycle_store.all_descriptions().map(description_from_api);
		if (!moncycle_store.account) return;
		if (moncycle_app.structure === null) {
			moncycle_app.show_account();
			return;
		}
		if (change.account || change.source == "sync") {
			moncycle_app.page_a_recharger = structure_of(moncycle_store.account) !== moncycle_app.structure;
			if (moncycle_app.page_a_recharger && moncycle_app.menu_opened_date === null) {
				moncycle_app.rebuild();
				return;
			}
			// the cycles stay as drawn: only the header (name, sponsor) can have changed
			if (!moncycle_app.page_a_recharger) moncycle_app.show_header();
		}
		change.days.forEach(moncycle_app.refresh_day);
	},
	// The write of a day was taken by the server.
	day_sent : function (detail) {
		if (moncycle_app.menu_opened_date === null || moncycle_store.pending[moncycle_app.menu_opened_date]) return;
		// the bulk form saves the days before the open one: nothing of the open day is waiting once the queue is empty
		if (detail.date != moncycle_app.menu_opened_date && Object.keys(moncycle_store.pending).length > 0) return;
		$("#jour_form_saving").hide();
		$("#jour_form_unsent").hide();
		$("#jour_form_saved").show();
	},
	day_failed : function (detail) {
		if (detail.date != moncycle_app.menu_opened_date && Object.keys(moncycle_store.pending).length > 0) return;
		$("#jour_form_saving").hide();
		$("#jour_form_unsent").hide();
	},
	// The bar at the bottom of the page, and the indicator of the day form. Silent unless something needs the user.
	show_sync_status : function (state) {
		let text = "";
		let css = "sync_error";
		if (state.error && state.error.kind == "rejected") text = t("timeline.sync_rejected", {message: state.error.message});
		else if (state.pending > 0 && state.error) text = t("timeline.sync_not_sent", {count: state.pending});
		else if (state.error) {
			text = state.error.kind == "network" ? t("timeline.sync_offline") : t("timeline.sync_server_error");
			css = "sync_warning";
		}
		$("#sync_status").empty().attr("class", "sync_status " + css).toggle(text != "");
		if (text != "") {
			$("#sync_status").append($("<span>").text(text));
			if (state.error && state.error.kind == "rejected") $("#sync_status").append(" ").append($("<button>", {type: "button", id: "sync_dismiss"}).text(t("timeline.sync_dismiss")));
			else $("#sync_status").append(" ").append($("<button>", {type: "button", id: "sync_retry"}).text(t("timeline.sync_retry")));
		}
		let unsent = state.pending > 0 && state.error && state.error.kind != "rejected";
		if (unsent) $("#jour_form_saving").hide();
		$("#jour_form_unsent").toggle(!!(unsent && moncycle_app.menu_opened_date !== null && moncycle_store.pending[moncycle_app.menu_opened_date]));
	},

	mini_maxi : "mini",
	mini_maxi_switch : function () {
		if (moncycle_app.mini_maxi=="maxi"){
			$("#timeline").hide();
			$("#recap").show();
			$("#but_mini_maxi").text(t("timeline.but_view_maxi"));
			moncycle_app.mini_maxi="mini";
			localStorage.mini_maxi="mini";
		}
		else {
			$("#timeline").show();
			$("#recap").hide();
			$("#but_mini_maxi").text(t("timeline.but_view_mini"));
			moncycle_app.mini_maxi="maxi";
			localStorage.mini_maxi="maxi";
		}
		if (moncycle_app.cycle_curseur == 0) moncycle_app.remplir_page_de_cycle();
		if (moncycle_app.timeline_asc && $(document).height()<=$(window).height()) moncycle_app.remplir_page_de_cycle();
	},
	bulk_show_hide : function () {
		if ($("#bulk_form").is(":hidden")) $("#bulk_form").show();
		else $("#bulk_form").hide();
	},
	remplir_page_de_cycle : function() {
		if (!moncycle_app.constante || !moncycle_app.constante.all_cycles_1st_day) return;
		if (moncycle_app.timeline_asc) {
			while ($(window).height() == $(document).height() && moncycle_app.cycle_curseur < moncycle_app.constante.all_cycles_1st_day.length) {
				moncycle_app.charger_cycle();
			}
			moncycle_app.charger_cycle();
			if ($(window).height() == $(document).height()) moncycle_app.form_nouveau_cycle();
		}
		else moncycle_app.charger_cycle();
	},
	// The news banner: the French item of the news file (js/news.js), once per page. "OK merci" hides the article whose link it was
	// clicked on, so a new article shows again.
	news_requested : false,
	charger_actu : function() {
		let url = moncycle_store.account ? moncycle_store.account.newsUrl : null;
		if (!url || moncycle_app.news_requested) return;
		moncycle_app.news_requested = true;
		moncycle_news.load(url).then(function (item) {
			if (item) moncycle_app.show_actu(item);
		});
	},
	show_actu : function(item) {
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
	},
	charger_cycle : function() {
		if (moncycle_app.cycle_curseur >= moncycle_app.constante.all_cycles_1st_day.length) {
			moncycle_app.form_nouveau_cycle();
			return;
		}
		let c = moncycle_app.cycle_curseur;
		moncycle_app.cycle_curseur += 1;
		const span = cycle_span(moncycle_app.constante.all_cycles_1st_day, moncycle_app.constante.all_observation_paused_dates, c);
		let date_cycle_str = span.start;
		let date_fin = span.end_date;
		let date_cycle = span.start_date;
		let form_nouv_cycle = span.new_cycle_form;
		if (form_nouv_cycle && moncycle_app.timeline_asc) moncycle_app.form_nouveau_cycle(false);
		let nb_jours = span.days;
		if (moncycle_app.timeline_asc) {
			$("#timeline").append(moncycle_app.cycle2timeline(date_cycle_str, nb_jours, date_fin));
			$("#recap").append(moncycle_app.cycle2recap(date_cycle_str, nb_jours, date_fin));
		}
		else {
			$("#timeline").prepend(moncycle_app.cycle2timeline(date_cycle_str, nb_jours, date_fin));
			$("#recap").prepend(moncycle_app.cycle2recap(date_cycle_str, nb_jours, date_fin));
		}
		let dates_data_holder = {};
		for (let pas = 0; pas < nb_jours; pas++) {
			let date_obs = new Date(date_cycle);
			date_obs.setDate(date_obs.getDate()+pas);
			let date_obs_str = dates.str(date_obs);
			let data = moncycle_app.view_day(date_obs_str, date_cycle_str, pas+1);
			dates_data_holder[date_obs_str] = data;
			moncycle_app.day_timeline[date_obs_str] = data;
			if (moncycle_app.timeline_asc) $(`#c-${date_cycle_str} .contenu`).prepend(moncycle_app.day_timeline2timeline(data));
			else $(`#c-${date_cycle_str} .contenu`).append(moncycle_app.day_timeline2timeline(data));
			$(`#rc-${date_cycle_str} .contenu`).append(moncycle_app.day_timeline2recap(data));
			moncycle_app.track_day(date_obs_str, data);
		}
		$(`.pas_${moncycle_app.constante.nfp_method_name}`).css("display", "none");
		moncycle_app.trois_jours();
		moncycle_app.graph_preparation_data(dates_data_holder);
		if (moncycle_app.constante.nfp_method == 1 || moncycle_app.constante.nfp_method == 4) {
			moncycle_app.cycle2graph(date_cycle_str);
			moncycle_app.graph_update(date_cycle_str);
		}
		if (form_nouv_cycle && !moncycle_app.timeline_asc) moncycle_app.form_nouveau_cycle(false);
	},
	// A day of the local copy, in the flat shape the drawing functions read. A date that holds nothing is
	// an empty day; $cycle and $pos say where it stands when the caller knows.
	view_day : function (date, cycle, pos) {
		let day = moncycle_store.days[date];
		if (!day) {
			day = blank_day(date);
			Object.assign(day, cycle ? {cycleStartDate : cycle, cycleDay : pos} : cycle_of((moncycle_store.account || {}).allCyclesFirstDay, date));
		}
		return day_from_api(day, moncycle_app.description);
	},
	// the peak days and the counters the "+1 +2 +3" marks of the other days come from
	track_day : function (date, data) {
		if (data.is_peak && $.inArray(date, moncycle_app.sommets)<0) moncycle_app.sommets.push(date);
		else if (!data.is_peak && $.inArray(date, moncycle_app.sommets)>=0) moncycle_app.sommets.splice($.inArray(date, moncycle_app.sommets), 1);
		if (data.counter_start) moncycle_app.counter_starts[date] = data.counter_start;
		else if (date in moncycle_app.counter_starts) delete moncycle_app.counter_starts[date];
	},
	// a save less than this long ago reads "maintenant"
	last_write_recent_ms : 2 * 60 * 1000,
	last_write_timer : null,
	// The moment of the last save of the open day, at the foot of its form (empty for a day never saved).
	// A recent one says "maintenant" and the line is drawn again when the two minutes are over.
	show_last_write : function (day) {
		clearTimeout(moncycle_app.last_write_timer);
		let moment = day.last_write ? new Date(day.last_write) : null;
		let box = $("#jour_form_last_write").empty().attr("title", null);
		if (moment === null || isNaN(moment)) return;
		let age = Date.now() - moment.getTime();
		let recent = Math.abs(age) < moncycle_app.last_write_recent_ms;
		box.attr("title", t("timeline.last_write_title", {date: date_long(moment), clock: clock(moment)}));
		box.append($("<span>").text(t("timeline.last_write_label")));
		box.append($("<b>").text(recent ? t("timeline.last_write_now") : t("timeline.last_write", {date: date_short(moment), year: moment.getFullYear(), clock: clock(moment)})));
		if (recent) moncycle_app.last_write_timer = setTimeout(() => moncycle_app.show_last_write(day), moncycle_app.last_write_recent_ms - age);
	},
	// A day changed in the copy: draw it again, if it is on the page.
	refresh_day : function (date) {
		let shown = moncycle_app.day_timeline[date];
		if (!shown) return;
		let data = moncycle_app.view_day(date, shown.cycle, shown.pos);
		moncycle_app.day_timeline[date] = data;
		if (date == moncycle_app.menu_opened_date) moncycle_app.show_last_write(data);
		$(`#o-${date}`).replaceWith(moncycle_app.day_timeline2timeline(data));
		$(`#ro-${date}`).replaceWith(moncycle_app.day_timeline2recap(data));
		moncycle_app.track_day(date, data);
		$(`.pas_${moncycle_app.constante.nfp_method_name}`).css("display", "none");
		moncycle_app.trois_jours();
		moncycle_app.graph_preparation_data({[date]: data});
	},
	form_nouveau_cycle_active: false,
	form_nouveau_cycle: function (prepend=true) {
		if (moncycle_app.form_nouveau_cycle_active) return;
		moncycle_app.form_nouveau_cycle_active = true;
		let max_date = dates.str(dates.now());
		let min_date = "";
		if (prepend && moncycle_app.cycle_curseur>0) {
			max_date = moncycle_app.constante.all_cycles_1st_day[moncycle_app.cycle_curseur-1];
			max_date = dates.str(new Date(dates.parse(max_date) - (1000*60*60*24)));
		}
		else if (!prepend) {
			let min_calc = dates.parse(moncycle_app.constante.all_observation_paused_dates[0]);
			min_calc.setDate(min_calc.getDate()+1);
			min_date = dates.str(min_calc);
		}
		let instruction = t("timeline.new_cycle_ask_1st_day");
		if (!prepend) instruction = t("timeline.new_cycle_ask_restart");
		let html = `<div class="cycle" id="nouveau_cycle"><h2 class="title">${t("timeline.new_cycle_title")}</h2><div class="nouveau_cycle_form">${instruction}<br><input id="nouveau_cycle_date" type="date" value="${max_date}" max="${max_date}" min="${min_date}" /> <input type="button" id="but_creer_cycle" value="${t("timeline.new_cycle_submit")}" /></div></div>`;
		let nocycle = `<div id="nocycle">${t("timeline.all_cycles_shown")}</div>`;
		if (moncycle_app.cycle_curseur == 0) nocycle = `<div id="nocycle">${t("timeline.create_cycle_hint")}</div>`;
		if (prepend && !moncycle_app.timeline_asc) {
			$("#charger_cycle").prop("disabled", true);
			$("#timeline").prepend(html);
			$("#recap").prepend(nocycle);
		}
		else {
			$("#timeline").append(html);
			if (moncycle_app.cycle_curseur == 0) $("#recap").append(nocycle);
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
	},
	trois_jours : function() {
		$(".day .s").empty();
		$(".obs .s").empty();
		$(".obs .s").show();
		$(".day .s").removeClass("j_pic");
		let txt_sommet = t("timeline.peak_mucus");
		if (moncycle_app.constante.nfp_method==3 || moncycle_app.constante.nfp_method==4) txt_sommet = t("timeline.peak_fc");
		moncycle_app.sommets.forEach(s => {
			let last = 3;
			if (!moncycle_app.timeline_asc) last = $(`#o-${s}`).parent()[0].children.length - $(`#o-${s}`).index() - 1;
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
		if (moncycle_app.constante.nfp_method==3 || moncycle_app.constante.nfp_method==4) return;
		$(".day .n").empty();
		$(".obs .n").empty();
		$(".obs .n").hide();
		$.each(moncycle_app.counter_starts,function(d,c){
			counter_days(d, c).forEach(({date, n}) => {
				$(`#o-${date} .n`).text(t("timeline.peak_offset", {n: n}));
				if (($(`#ro-${date} .s`).text()).length==0) {
					$(`#ro-${date} .n`).html(n);
					$(`#ro-${date} .n`).show();
					$(`#ro-${date} .s`).hide();
				}
			});
		});
	},
	cycle_option : function (c_date_str, c_date_fin_str, discri) {
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
	},
	// A click on an export of a cycle: the file is fetched and saved, a failure is told (the API answers it in JSON, in English).
	download_export : function (event) {
		event.preventDefault();
		moncycle_store.download($(this).attr("href")).catch(function (failure) {
			alert(export_failed_text(failure));
		});
	},
	cycle_title_opened : null,
	cycle_title_click : function () {
		let c = $(this).attr("for");
		$(".cycle_options").hide();
		$(".mini_ruler").hide();
		if (moncycle_app.cycle_title_opened == null || moncycle_app.cycle_title_opened != c) {
			$("#ruler_" + c).show();
			$(`.c_options_${c}`).show();
			moncycle_app.cycle_title_opened = c;
		}
		else moncycle_app.cycle_title_opened = null;
	},
	cycle2timeline : function (c, nb, fin) {
		let c_id = "c-" + c;
		let cycle = $("<div>", {id: c_id, class: "cycle"});
		let c_date = dates.parse(c);
		let c_fin = new Date(fin);
		let c_title = $(`<h2 class='title title_${c}' for='${c}'></h2>`).append(cycle_title_node("timeline.cycle_title", "timeline.cycle_title_end", c_date, c_fin, nb));
		let c_graph = $(`<div class='graph pas_mucus pas_fc' id='graph-${c_id}' style='display:none' ><canvas id='canvas-${c_id}'></canvas></div>`);
		let c_content = $(`<div class='contenu' id='contenu-${c_id}'></div>`);
		c_title.click(moncycle_app.cycle_title_click);
		cycle.append(c_title);
		cycle.append(moncycle_app.cycle_option(c, dates.str(fin), "timeline"));
		cycle.append(c_graph);
		cycle.append(c_content);
		return cycle;
	},
	cycle2recap : function (c, nb, fin) {
		let c_id = "rc-" + c;
		let cycle = $("<div>", {id: c_id, class: "cycle_recap"});
		let c_date = dates.parse(c);
		let c_fin = new Date(fin);
		let c_title = $(`<h5 class='title title_${c}' for='${c}'></h5>`).append(cycle_title_node("timeline.cycle_title_recap", "timeline.cycle_title_recap_end", c_date, c_fin, nb));
		c_title.click(moncycle_app.cycle_title_click);
		cycle.append(c_title);
		cycle.append(moncycle_app.cycle_option(c, dates.str(fin), "recap"));
		let c_ruler = $("<div>", {id: "ruler_" + c, class: "mini_ruler", style: "display:none"});
		let odd = true;
		for (let n=1; n<=moncycle_app.cycle_columns; n++) {
			let ruler_num = $(`<span>${n}</span>`);
			if (odd) ruler_num.addClass("odd");
			c_ruler.append(ruler_num);
			odd = !odd;
		}
		cycle.append(c_ruler);
		cycle.append($("<div>", {id: "rc_contenu_" + c, class: "contenu"}));
		return cycle;
	},
	cycle2graph : function (id) {
		const temp_chart = new Chart($(`#canvas-c-${id}`), {
			type: 'line',
			data: {
				datasets: [{
					data: moncycle_app.graph_data[id],
					fill: false,
					borderColor: '#1e824c',
					tension: 0.1,
				}]
			},
			options: {
				responsive:true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false
					}
				}
			}
		});
		moncycle_app.graphs[id] = temp_chart;
	},
	graph_update : function(id) {
		let vide = true;
		for (let k in moncycle_app.graph_data[id]) if (vide && !isNaN(moncycle_app.graph_data[id][k])) vide = false;
		$("#graph-c-" + id).attr("vide", vide ? 1 : 0);
		if (vide) $("#graph-c-" + id).hide();
		else {
			if (!$("#contenu-c-" + id).is(":hidden")) $("#graph-c-" + id).show();
			moncycle_app.graphs[id].data.datasets[0].data = moncycle_app.graph_data[id];
			moncycle_app.graphs[id].update();
		}
		if (!vide && (moncycle_app.constante.nfp_method==1 || moncycle_app.constante.nfp_method==4)) {
			moncycle_app.graphs[id].data.datasets = moncycle_app.graphs[id].data.datasets.slice(0,1);
			moncycle_app.graphs[id].update();
		}
	},
	day_timeline2recap : function(j) {
		let o_date = dates.parse(j.date_obs);
		let o_id = "ro-" + dates.str(o_date);
		let o_class = "obs";
		if (j.observation_paused) o_class += " o_paused";
		let day_timeline = $("<div>", {id: o_id, class: o_class, date: dates.str(o_date)});
		day_timeline.click(moncycle_app.open_menu);
		let color = "vide";
		let index_couleur = j.stamp;
		let baby = (j.stamp == "BB");
		if (j.stamp && j.stamp.includes("BB") && j.stamp.length>2) {
			color = moncycle_app.stamp_class["BB"];
			index_couleur = index_couleur.replace("BB", "");
			baby = true;
		}
		if (moncycle_app.stamp_class[index_couleur]) color = moncycle_app.stamp_class[index_couleur];
		let car_du_milieu = baby ? t_map("timeline.stamp_glyph")["BB"] : "";
		let car_du_bas = j.union_sex ? t("timeline.union") : "";
		if (j.err && j.err.includes("no data")) car_du_milieu = t("timeline.to_fill_in_glyph");
		let recap_note = j.fc_score;
		if ((moncycle_app.constante.nfp_method==3 || moncycle_app.constante.nfp_method==4) && j.fc_score) {
			recap_note = recap_note.toUpperCase();
			recap_note = recap_note.replace('RAP','').replace('LAP','').replace('AD','').replace('AP','').replace('B','');
		}
		else recap_note = "";
		if ((moncycle_app.constante.nfp_method==3 || moncycle_app.constante.nfp_method==4) && car_du_milieu == "" && j.fc_score) {
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
		if (moncycle_app.constante.nfp_method==1 || moncycle_app.constante.nfp_method==2) day_timeline.append(`<span class='n'></span>`);
		day_timeline.append(`<span class='g ${color}'>${car_du_milieu}</span>`);
		if ((moncycle_app.constante.nfp_method==3 || moncycle_app.constante.nfp_method==4) && !j.observation_paused && !j.day_not_observed && j.fc_score){
			recap_note = recap_note.replace('X1','').replace('X2','').replace('X3','');
			let fc_glaire = recap_note.match(/\d+/);
			if (fc_glaire) recap_note = recap_note.replace(fc_glaire[0], '');
			day_timeline.append($("<span>", {class: "fc"}).text(fc_glaire? fc_glaire[0] : ""));
			recap_note = recap_note.trim().replace(/\s+/g, '')
			if (recap_note.length>2) recap_note = t("timeline.fc_note_overflow");
			day_timeline.append($("<span>", {class: "fc"}).text(recap_note));
		}
		else if (moncycle_app.constante.nfp_method==3 || moncycle_app.constante.nfp_method==4) {
			day_timeline.append(`<span class='fc'></span>`);
			day_timeline.append(`<span class='fc'></span>`);
		}
		day_timeline.append(`<span class='c'>${car_du_bas}</span>`);
		return day_timeline;
	},
	// The "o" cell of a cervical mucus day: observations as they are, sensations in bold, then the
	// descriptions with no type yet, struck through (css/tableau.css). Built with the DOM, never as
	// HTML: a name is free text. <b> and <s> and text nodes on purpose, `.day span` styles every span
	// as a cell and `.day span:empty` hides it, so a day with no description keeps an empty cell.
	description_cell : function (descriptions) {
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
	},
	day_timeline2timeline : function(j) {
		let o_date = dates.parse(j.date_obs);
		let o_id = "o-" + dates.str(o_date);
		let o_class = "day";
		if (moncycle_app.constante.nfp_method==3 || moncycle_app.constante.nfp_method==4) o_class += " o_fc";
		else o_class += " o_mucus";
		if (j.observation_paused) o_class += " o_paused";
		let day_timeline = $("<div>", {id: o_id, class: o_class, date : dates.str(o_date)});
		let d_bold = o_date.getDay()==0 ? "bold" : "";
		day_timeline.append(`<span class='d ${d_bold}'>${date_row(o_date)}</span>`);
		let pos = $(`<span class='j'>${j.pos}</span>`);
		day_timeline.append(pos);
		day_timeline.click(moncycle_app.open_menu);
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
					day_timeline.append(`<span class='g ${moncycle_app.stamp_class[color]}'>${contenu}</span>`);
					pos.addClass("j_" + moncycle_app.stamp_class[color]);
					tbd = false;
				}
				let html_fc_score = moncycle_app.fc_note2html(j.fc_score || "");
				day_timeline.append(`<span class='fc pas_mucus pas_mucus_temp'>${html_fc_score}</span>`);
				if ((moncycle_app.constante.nfp_method==1 || moncycle_app.constante.nfp_method==4) && j.temperature) {
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
				if ((moncycle_app.constante.nfp_method==3 || moncycle_app.constante.nfp_method==4) && j.fc_score) tbd = false;
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
				day_timeline.append(moncycle_app.description_cell(j.description));
				if (moncycle_app.arrow_id[j.fc_arrow]) day_timeline.append(`<span class='fle pas_mucus pas_mucus_temp'>${t_map("timeline.arrow_glyph")[j.fc_arrow] || ""}</span>`);
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
	},
	go_blank_or_empty : function () {
		if ($("#go_baby")[0].checked) $("#blank_or_empty").text(t("timeline.target_blank"));
		else $("#blank_or_empty").text(t("timeline.target_empty"));
	},
	// container holding the chips for each description type: 2=sensation, 1=observation, 0=autre (legacy)
	desc_container_id : {2 : "#menu_sensation_container", 1 : "#menu_observation_container", 0 : "#menu_autre_container"},
	desc_chip_count : 0,
	// A chip is the description's name (see day_to_api); its id only ties the label to the box.
	render_desc_chip : function (sdesc, active) {
		let id = "i_desc_" + moncycle_app.desc_chip_count++;
		return $("<span>", {"class": "desc_chip"})
			.append($("<input>", {type: "checkbox", name: "description[]", value: sdesc.name, id: id, "class": "i_desc"}).prop("checked", !!active))
			.append($("<label>", {"for": id}).text(sdesc.name));
	},
	// wires the "+ nouvelle sensation/observation" affordances in jour_form; there is no
	// equivalent for "autre" since that legacy type can't be created or converted to (see open_menu)
	bind_desc_add_forms : function () {
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
			moncycle_app.desc_add_submit($(this).closest(".desc_add_form"));
		});
		$(".desc_add_input").on("keydown", function (event) {
			if (event.key !== "Enter") return;
			event.preventDefault();
			moncycle_app.desc_add_submit($(this).closest(".desc_add_form"));
		});
	},
	desc_add_submit : function (form) {
		let desc_type = parseInt(form.data("desc-type"));
		let name = form.find(".desc_add_input").val().trim().toLowerCase();
		let status = form.find(".desc_add_status");
		if (name == "") return;
		let duplicate = moncycle_app.description.some(d => d.name.toLowerCase() == name);
		if (duplicate) {
			status.text(t("timeline.desc_add_duplicate", {name: name}));
			return;
		}
		// kept here and sent when the server can be reached (js/store.js): the chip is there at once, offline too
		moncycle_store.queue_description(name, type_from_int[desc_type], dates.now_in_utc());
		let desc = moncycle_app.description.find(d => d.name == name) || unsent_description(name, desc_type);
		let chip = moncycle_app.render_desc_chip(desc, false);
		$(moncycle_app.desc_container_id[desc_type]).append(chip);
		chip.find(".i_desc").on("change", moncycle_app.submit_menu);
		form.find(".desc_add_input").val("").focus();
		status.text(t("timeline.desc_add_saved"));
	},
	menu_opened_date : null,
	open_menu : function(e, date = null) {
		let o_date;
		if (date) o_date = dates.parse(date);
		else o_date = dates.parse($(this).attr('date'));
		date = dates.str(o_date);
		moncycle_app.menu_opened_date = date;
		let j = moncycle_app.day_timeline[moncycle_app.menu_opened_date];
		let stamp = j.stamp? j.stamp : "";
		$("#jour_form_titre").empty().append(document.createTextNode(date_long(o_date) + " "), $("<span>").text(t("timeline.day_number", {n: j.pos})));
		let arrow = {"next" : t("timeline.arrow_up"), "prev" : t("timeline.arrow_down")};
		if (!moncycle_app.timeline_asc) arrow = {"next" : t("timeline.arrow_down"), "prev" : t("timeline.arrow_up")};
		$("#jour_form_prev").text(t("timeline.but_day_step", {arrow: arrow["prev"], day: t("timeline.day_number", {n: j.pos-1})}));
		$("#jour_form_next").text(t("timeline.but_day_step", {arrow: arrow["next"], day: t("timeline.day_number", {n: j.pos+1})}));
		let date_cursor = new Date(j.date_obs);
		date_cursor.setDate(date_cursor.getDate()+1);
		let str_date_cursor = dates.str(date_cursor);
		if (moncycle_app.day_timeline[str_date_cursor] && !moncycle_app.day_timeline[str_date_cursor].cycle_1st_day) {
			$("#jour_form_next").attr("date", str_date_cursor);
			$("#jour_form_next").show();
		}
		else $("#jour_form_next").hide();
		date_cursor.setDate(date_cursor.getDate()-2);
		str_date_cursor = dates.str(date_cursor);
		if (j.pos-1 > 0 && moncycle_app.day_timeline[str_date_cursor]) {
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
		if (j.fc_score && (moncycle_app.constante.nfp_method==3 || moncycle_app.constante.nfp_method==4)) {
			$("#form_fc").val(j.fc_score);
			moncycle_app.fc_note2form();
			moncycle_app.fc_test_note();
		}
		if (j.fc_arrow && (moncycle_app.constante.nfp_method==3 || moncycle_app.constante.nfp_method==4)) $("#fc_f" + moncycle_app.arrow_id[j.fc_arrow]).prop('checked', true);
		if (stamp.includes("BB") && stamp.length>2) {
			$("#go_" + moncycle_app.stamp_class["BB"]).prop('checked', true);
			stamp = stamp.replace("BB", "");
		}
		if (moncycle_app.stamp_class[stamp]) $("#go_" + moncycle_app.stamp_class[stamp]).prop('checked', true);
		moncycle_app.go_blank_or_empty();
		$("#form_temp").val(j.temperature);
		$("#form_time_temp_taken").val(j.time_temp_taken);
		$("#menu_observation_container").empty();
		$("#menu_sensation_container").empty();
		$("#menu_autre_container").empty();
		let active_desc = [];
		for (const adesc of j.description) active_desc.push(adesc.name);
		let has_autre = false;
		for (const sdesc of moncycle_app.description) {
			let active = active_desc.includes(sdesc.name);
			let container_id = moncycle_app.desc_container_id[sdesc.type];
			if (!container_id) continue;
			if (sdesc.type == 0) has_autre = true;
			$(container_id).append(moncycle_app.render_desc_chip(sdesc, active));
		}
		// "autre" is a legacy type new descriptions can't be created as or converted to;
		// only show the category when a legacy description of that type still exists
		$("#desc_category_other").toggle(has_autre);
		$(".i_desc").on("change", moncycle_app.submit_menu);
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
		moncycle_app.show_last_write(j);
		$("html, body").css({
			"overflow": "hidden",
			"touch-action": "none"
		});
		$("#jour_form").show();
		$("#jour_form").scrollTop(0);
		$("#timeline").addClass("flou");
		$("#recap").addClass("flou");
	},
	close_menu : function (e) {
		$("html, body").css({
			"overflow": "visible",
			"touch-action": "auto"
		});
		$("#timeline").removeClass("flou");
		$("#recap").removeClass("flou");
		$("#bulk_form").hide();
		$("#jour_form").hide();
		moncycle_app.menu_opened_date = null;
		// the cycles moved while the form was open: draw them again from the copy
		if (moncycle_app.page_a_recharger) moncycle_app.rebuild();
	},
	// The form is the full state of the day: it goes into the local copy at once and the page draws it
	// (store_changed), then the store sends it; day_sent / day_failed / show_sync_status say how it went.
	submit_menu : function () {
		$("#jour_form_saving").show();
		$("#jour_form_saved").hide();
		$("#jour_form_unsent").hide();
		$("#form_save_time").val(dates.now_in_utc());
		if (this.id == "form_fc") moncycle_app.fc_note2form();
		else moncycle_app.fc_form2note();
		moncycle_app.fc_test_note();
		if ($("#ev_counter_start_actif")[0].checked) $("#ev_hidden_counter_start").val($("#ev_counter_start_nb").val());
		else $("#ev_hidden_counter_start").val(0);
		let d = $("#jour_form #form_data").serializeArray();
		if (moncycle_app.menu_opened_date != null) {
			let j = 0;
			while (j<d.length && d[j]["name"]!="date") j += 1;
			if (j == d.length) d.push({"date" : moncycle_app.menu_opened_date});
			else d[j]["value"] = moncycle_app.menu_opened_date;
		}
		moncycle_store.queue_day(day_to_api(d, moncycle_app.description));
	},
	bulk_submit_menu : function () {
		let nb_of_days = $("#i_bulk_count").val();
		if (nb_of_days > 365) {
			alert(t("timeline.bulk_too_many_days", {max: 365}));
			return;
		}
		let menu_current_date = moncycle_app.menu_opened_date;
		let menu_current_1st_day = $("#ev_cycle_1st_day").is(':checked');
		let date_cursor = dates.parse(menu_current_date);
		let j = 1;
		while (j <= nb_of_days && moncycle_app.menu_opened_date!=moncycle_app.day_timeline[menu_current_date]["cycle"]) {
			date_cursor.setDate(date_cursor.getDate()-1);
			moncycle_app.menu_opened_date = dates.str(date_cursor);
			if (moncycle_app.menu_opened_date==moncycle_app.day_timeline[menu_current_date]["cycle"]) $("#ev_cycle_1st_day").prop('checked', true);
			else $("#ev_cycle_1st_day").prop('checked', false);
			moncycle_app.submit_menu();
			j += 1;
		}
		moncycle_app.menu_opened_date = menu_current_date;
		if (menu_current_1st_day) $("#ev_cycle_1st_day").prop('checked', true);
	},
	suppr_day_timeline : function () {
		let date = dates.parse($("#form_date").val());
		date.setHours(9);
		if (confirm(t("timeline.confirm_delete_day", {date: date_long(date)}))) {
			moncycle_store.queue_delete(dates.str(date), dates.now_in_utc());
			moncycle_app.close_menu();
		}
	},
	graph_preparation_data : function (data) {
		$.each(data, function(o_date, o_data) {
			if (moncycle_app.graph_data[o_data.cycle] == undefined) moncycle_app.graph_data[o_data.cycle] = {};
			let date = dates.parse(o_date);
			let label = date_short(date);
			moncycle_app.graph_data[o_data.cycle][label] = parseFloat(o_data.temperature);
			if (moncycle_app.graphs[o_data.cycle]) moncycle_app.graph_update(o_data.cycle);
		});
	},
	fc_test_note : function() {
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
	},
	fc_form2note : function() {
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
	},
	// A text as HTML, for the one place that still builds markup out of a stored value: the server only
	// stores FertilityCare notes made of the notation's codes, so this is a second wall, not the first.
	escape_html (text) {
		return $("<span>").text(text).html();
	},
	fc_note2html (note) {
		const should_be_red = ['VL', 'VH', 'H', 'M', 'B'];
		const less_important = ['RAP', 'LAP', 'AP', 'X1', 'X2', 'X3', 'AD',];
		// escaped after the upper-casing: the entities are lower case, so no code below can match inside one
		note = moncycle_app.escape_html(note.toUpperCase());
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
	},
	fc_note2form : function() {
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
}

// start once the page is loaded (no inline script: the CSP is script-src 'self')
window.addEventListener("load", function () { Promise.all([moncycle_config.ready, i18n_ready]).then(moncycle_app.letsgo); });
