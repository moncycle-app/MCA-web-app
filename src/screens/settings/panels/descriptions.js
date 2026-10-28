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
import { t, t_map } from "/js/core/i18n.js";
import { description_from_api, type_from_int, exists } from "/js/model/descriptions.js";
import { settings_api, settings_error, settings_form_say, settings_read, settings_say, settings_sync_later } from "/screens/settings/common.js";
import { settings_text } from "/screens/settings/text.js";

const $ = globalThis.$;

/* ===========================================================================
** 5b. SENSATIONS & OBSERVATIONS: the keywords of the cervical mucus method
** ======================================================================== */

// The API says "sensation"; the page keeps the integer of the old forms.
// shown before a keyword's name, so that its type is known without opening it
export const settings_desc_type_icon = {0: "❓", 1: "👀", 2: "🧠"};

let settings_descriptions = [];   // {id, name, type, use_count, sent}; `sent` is the last name and type sent, before the answer
let settings_desc_last_edit = 0;
let settings_desc_move_run = null;   // while a move into the comments runs: {dates: {date: true}, done, refused: [dates]}


export function settings_desc_find(id) {
	return settings_descriptions.find(function (known) { return known.id === id; });
}

// another_than: the keyword being edited, which is not a duplicate of itself (its saved name can be the one typed back while the answer
// to the change that took it away is still on its way)
export function settings_desc_exists(name, type, another_than) {
	return exists(settings_descriptions, name, type, another_than);
}

export function settings_descriptions_load() {
	return $.get(moncycle_config.api_url("/description")).done(function (ret) {
		settings_descriptions = ret.data.map(description_from_api);
		settings_desc_draw();
		settings_desc_unknown_update();
	}).fail(function (jqXHR) {
		settings_say($("#desc_msg"), "error", settings_error(jqXHR));
	});
}

export function settings_desc_draw() {
	const container = $("#desc_froms_container").empty();
	if (settings_descriptions.length == 0) {
		container.append($("<i>", {class: "tech_info"}).text(t("settings.desc_none")));
		return;
	}
	settings_descriptions.forEach(function (description) { container.append(settings_desc_row(description)); });
}

// The notice about keywords with no type shows only while one exists (here, in the list and above the export).
export function settings_desc_unknown_update() {
	$(".desc_unknown_note").prop("hidden", !settings_descriptions.some(function (known) { return known.type == 0; }));
}

// The keywords a row can be merged into: every other one, listed again each time the row is touched (others come and go).
export function settings_desc_merge_options(row) {
	const select = row.find(".desc_merge");
	if (select.length == 0) return;
	const id = row.data("id");
	const wanted = [["", t("settings.desc_merge_placeholder")]];
	settings_descriptions.forEach(function (known) {
		if (known.id !== id) wanted.push([String(known.id), settings_desc_type_icon[known.type] + " " + known.name]);
	});
	// left alone when it is already right: rebuilding a list while it is open drops the choice being made
	const shown = select.children("option").map(function () { return this.value + "\n" + this.textContent; }).get().join("\n");
	if (shown == wanted.map(function (one) { return one.join("\n"); }).join("\n")) return;
	select.empty();
	wanted.forEach(function (one) { select.append($("<option>", {value: one[0]}).text(one[1])); });
}

// A keyword is a form: its line (type's emoji, name, count) and, under it while it is the one being edited, its type and its two buttons.
// Built with the DOM, never as HTML: a name is free text and would break out of value="...".
export function settings_desc_row(description) {
	const type_select = $("<select>", {name: "type", class: "desc_type", "aria-label": "Type"}).append(
		$("<option>", {value: "2", selected: description.type == 2}).text(t("settings.desc_type_sensation_option")),
		$("<option>", {value: "1", selected: description.type == 1}).text(t("settings.desc_type_observation_option")),
		$("<option>", {value: "0", selected: description.type == 0, disabled: true}).text(t("settings.desc_type_undefined_option")));
	const line = $("<div>", {class: "desc_line"}).append(
		$("<span>", {class: "desc_icon", title: t_map("settings.desc_type_name")[description.type]}).text(settings_desc_type_icon[description.type]),
		$("<input>", {class: "desc_name", type: "text", name: "name", maxlength: 256, title: description.name, "aria-label": "Nom"}).val(description.name),
		$("<span>", {class: "desc_count", title: t("settings.desc_count_title")}).text(description.use_count));
	const actions = $("<div>", {class: "desc_actions"}).append(
		type_select,
		$("<select>", {class: "desc_merge", name: "merge", title: t("settings.desc_merge_title"), "aria-label": t("settings.desc_merge_title")}),
		$("<button>", {type: "submit", name: "action", value: "comment", class: "desc_comment", title: t("settings.desc_comment_button_title"), "aria-label": t("settings.desc_comment_button_title")}).text("💬"),
		$("<button>", {type: "submit", name: "action", value: "delete", class: "desc_delete", title: t("settings.desc_delete_button_title"), "aria-label": t("settings.desc_delete_button_title")}).text("❌"));
	// the first submit button is the one Enter presses in the name field: it does nothing (the name is saved as it is typed)
	const enter_button = $("<button>", {type: "submit", name: "action", value: "none", hidden: true});
	const message = $("<p>", {class: "form_msg", role: "status"});
	return $("<form>", {class: "desc_row", id: "desc_row_" + description.id}).data("id", description.id).append(enter_button, line, actions, message);
}

// A description is kept trimmed and in lower case (the server does the same): what is typed is compared and sent that way.
export function settings_desc_row_name(row) {
	return row.find(".desc_name").val().trim().toLowerCase();
}

// Name or type changed: save it. Only a difference is sent (focus, Tab and arrows make events with none): what is typed is compared with
// what was sent last, or else what is saved.
export function settings_desc_save(row) {
	const id = row.data("id");
	const known = settings_desc_find(id);
	const name = settings_desc_row_name(row);
	// the whole name is in the tooltip: the field shows what fits
	row.find(".desc_name").attr("title", name);
	// the option selected, not the value of the select: the "à définir" option is disabled, and the select answers nothing for it
	const type = parseInt(row.find("select option:selected").val());
	const last = known.sent || known;
	if (last.name == name && last.type == type) return;

	const edit = ++settings_desc_last_edit;
	const line = row.find(".form_msg");
	if (name == "") return settings_say(line, "error", t("settings.desc_name_empty"));
	if (settings_desc_exists(name, type, id)) return settings_say(line, "error", t("settings.desc_duplicate"));

	settings_say(line, "busy", "⏳");
	known.sent = {name: name, type: type};
	settings_api("POST", moncycle_config.api_url("/description/" + encodeURIComponent(id)), {name: name, type: type_from_int[type]}).done(function () {
		if (edit == settings_desc_last_edit) settings_say(line, "ok", t("settings.saved"), true);
		// what the page holds of the keyword follows what was saved (the duplicate check, the emoji)
		known.name = name;
		known.type = type;
		settings_desc_unknown_update();
		row.find(".desc_icon").text(settings_desc_type_icon[type]).attr("title", t_map("settings.desc_type_name")[type]);
		settings_sync_later();
	}).fail(function (jqXHR) {
		console.error(jqXHR);
		if (edit == settings_desc_last_edit) {
			settings_say(line, "error", settings_error(jqXHR, t_map("settings.desc_errors")));
			// refused or lost: the next key sends it again
			known.sent = null;
		}
	});
}

export function settings_desc_delete(row) {
	const id = row.data("id");
	const known = settings_desc_find(id);
	if (known.use_count > 1 && !confirm(settings_text.desc_confirm_delete_many(known.name, known.use_count))) return;
	if (known.use_count == 1 && !confirm(settings_text.desc_confirm_delete_one(known.name))) return;
	settings_say(row.find(".form_msg"), "busy", "⏳");
	settings_api("DELETE", moncycle_config.api_url("/description/" + encodeURIComponent(id))).done(function () {
		settings_descriptions = settings_descriptions.filter(function (other) { return other.id !== id; });
		row.remove();
		settings_desc_unknown_update();
		// the row is gone: the line of the list says it
		settings_say($("#desc_msg"), "ok", t("settings.desc_deleted"), true);
		settings_sync_later();
	}).fail(function (jqXHR) {
		console.error(jqXHR);
		settings_say(row.find(".form_msg"), "error", settings_error(jqXHR, t_map("settings.desc_errors")));
	});
}

// A keyword moved into the comment of its days, then deleted. All in the browser: the days come from the local copy (js/store.js),
// brought up to date first, and go back through its queue like any write of a day. Once the server has every one of them, the keyword is
// deleted. The server sees ordinary writes of days and one delete of a description.
export async function settings_desc_move_to_comments(row) {
	if (settings_desc_move_run) return;
	const line = row.find(".form_msg");
	settings_desc_move_run = {dates: {}, done: 0, refused: [], line: line};
	const run = settings_desc_move_run;
	const id = row.data("id");
	const button = row.find(".desc_comment");
	let button_after = "💬";
	button.prop("disabled", true).text("⏳");
	settings_say(line, "busy", t("settings.desc_comment_syncing"));
	try {
		// the days to change are the ones the server holds now
		try { await moncycle_store.sync(); }
		catch (e) {
			settings_say(line, "error", t("settings.desc_comment_sync_failed"));
			return;
		}
		settings_say(line, "", "");
		const description = moncycle_store.descriptions.find(function (known) { return known.id === id; });
		if (!description) return alert(t("settings.desc_comment_gone"));
		// the name that will be written is the one saved, which must be the one the user sees
		if (description.name !== settings_desc_row_name(row)) return alert(t("settings.desc_comment_unsaved"));
		const plan = moncycle_store.plan_description_to_comments(description);
		// all or nothing: a day that cannot take the name would lose the description with the others
		if (plan.too_long.length) return alert(settings_text.desc_comment_too_long(description.name, plan.too_long, moncycle_store.comment_max_chars));
		if (plan.change.length + plan.kept.length == 0) return alert(settings_text.desc_comment_nothing(description.name));
		if (!confirm(settings_text.desc_comment_confirm(description.name, plan))) return;

		if (plan.change.length) {
			plan.change.forEach(function (one) { run.dates[one.date] = true; });
			settings_say(line, "busy", settings_text.desc_comment_progress(0, plan.change.length));
			moncycle_store.queue_comments(plan.change, new Date().toISOString().replace(/\.\d+Z$/, "Z"));
			try { await moncycle_store.flush(); }
			catch (e) { /* what the server could not take stays in the queue, and is sent again */ }
			// the description is deleted only when every day has the name in its comment
			const waiting = plan.change.filter(function (one) { return moncycle_store.pending[one.date]; }).length;
			const refused = run.refused.length;
			if (waiting || refused) {
				settings_say(line, "error", waiting ? t("settings.desc_comment_offline") : settings_text.desc_comment_refused(plan.change.length - refused, refused));
				button_after = "⚠️";
				return;
			}
		}

		settings_say(line, "busy", t("settings.desc_comment_deleting"));
		try { await moncycle_store.request("DELETE", moncycle_config.api_url("/description/" + encodeURIComponent(id))); }
		catch (jqXHR) {
			console.error(jqXHR);
			settings_say(line, "error", t("settings.desc_comment_delete_failed"));
			button_after = "⚠️";
			return;
		}
		// the copy follows what the server did (the descriptions, the days that carried this one)
		try { await moncycle_store.sync(); }
		catch (e) { /* at the next sync */ }
		settings_descriptions = settings_descriptions.filter(function (other) { return other.id !== id; });
		settings_desc_unknown_update();
		// the row is a message now: what it said is in the comments
		row.attr("class", "desc_moved").removeAttr("id").removeData("id").empty().append(document.createTextNode(settings_text.desc_comment_moved(description.name, plan)));
		settings_say($("#desc_msg"), "ok", t("settings.desc_comment_done"), true);
	}
	finally {
		settings_desc_move_run = null;
		button.prop("disabled", false).text(button_after);
		if (button_after != "💬") setTimeout(function () { button.text("💬"); }, 3000);
	}
}

// A keyword merged into another: its days take the other (written through the queue of js/store.js like any day), then it is deleted.
// Same course as the move into the comments; the server sees ordinary writes of days and one delete.
export async function settings_desc_merge(row, target_id) {
	if (settings_desc_move_run) return;
	const line = row.find(".form_msg");
	settings_desc_move_run = {dates: {}, done: 0, refused: [], line: line};
	const run = settings_desc_move_run;
	const id = row.data("id");
	const select = row.find(".desc_merge");
	select.prop("disabled", true);
	settings_say(line, "busy", t("settings.desc_comment_syncing"));
	try {
		try { await moncycle_store.sync(); }
		catch (e) {
			settings_say(line, "error", t("settings.desc_comment_sync_failed"));
			return;
		}
		settings_say(line, "", "");
		const source = moncycle_store.descriptions.find(function (known) { return known.id === id; });
		const target = moncycle_store.descriptions.find(function (known) { return known.id === target_id; });
		if (!source || !target) return alert(t("settings.desc_merge_gone"));
		if (source.name !== settings_desc_row_name(row)) return alert(t("settings.desc_comment_unsaved"));
		const change = moncycle_store.plan_description_merge(source, target);
		if (!confirm(settings_text.desc_merge_confirm(source.name, target.name, change.length))) return;

		if (change.length) {
			change.forEach(function (one) { run.dates[one.date] = true; });
			settings_say(line, "busy", settings_text.desc_comment_progress(0, change.length));
			moncycle_store.queue_merge(change, new Date().toISOString().replace(/\.\d+Z$/, "Z"));
			try { await moncycle_store.flush(); }
			catch (e) { /* what the server could not take stays in the queue, and is sent again */ }
			const waiting = change.filter(function (one) { return moncycle_store.pending[one.date]; }).length;
			const refused = run.refused.length;
			if (waiting || refused) {
				settings_say(line, "error", waiting ? t("settings.desc_comment_offline") : settings_text.desc_comment_refused(change.length - refused, refused));
				return;
			}
		}

		settings_say(line, "busy", t("settings.desc_comment_deleting"));
		try { await moncycle_store.request("DELETE", moncycle_config.api_url("/description/" + encodeURIComponent(id))); }
		catch (jqXHR) {
			console.error(jqXHR);
			settings_say(line, "error", t("settings.desc_comment_delete_failed"));
			return;
		}
		try { await moncycle_store.sync(); }
		catch (e) { /* at the next sync */ }
		settings_descriptions = settings_descriptions.filter(function (other) { return other.id !== id; });
		settings_desc_unknown_update();
		row.attr("class", "desc_moved").removeAttr("id").removeData("id").empty().append(document.createTextNode(settings_text.desc_merge_done(source.name, target.name, change.length)));
		settings_say($("#desc_msg"), "ok", t("settings.saved"), true);
		// the counts of the other rows are stale: the list is read again
		settings_descriptions_load();
	}
	finally {
		settings_desc_move_run = null;
		select.prop("disabled", false).val("");
	}
}

export function settings_setup_descriptions() {
	const container = $("#desc_froms_container");
	$(".desc_unknown_note").text(t("settings.desc_unknown_note"));

	// What acts on a keyword shows under the one being edited, and stays while the focus or the pointer is in that row. Not :focus-within:
	// a click on a button does not focus it in Safari and Firefox on macOS, and the row would close under the finger.
	$(document).on("focusin.settings mousedown.settings", function (event) {
		const row = $(event.target).closest(".desc_row");
		$(".desc_row.desc_active").not(row).removeClass("desc_active");
		row.addClass("desc_active");
		// not while the merge list itself is used: a browser aims its events at the <option> clicked, which is inside it
		if (row.length && $(event.target).closest(".desc_merge").length == 0) settings_desc_merge_options(row);
	});

	container.on("input", ".desc_name", function () { settings_desc_save($(this).closest(".desc_row")); });
	container.on("change", ".desc_type", function () { settings_desc_save($(this).closest(".desc_row")); });
	container.on("change", ".desc_merge", function () {
		const target_id = parseInt($(this).val());
		if (!isNaN(target_id)) settings_desc_merge($(this).closest(".desc_row"), target_id);
	});
	container.on("submit", ".desc_row", function (event) {
		event.preventDefault();
		const row = $(this);
		const action = event.originalEvent && event.originalEvent.submitter ? event.originalEvent.submitter.value : "";
		if (action == "comment") settings_desc_move_to_comments(row);
		else if (action == "delete") settings_desc_delete(row);
	});

	// the progress of a move: each day the queue sends
	moncycle_store.on("sent", function (detail) {
		const run = settings_desc_move_run;
		if (!run || !run.dates[detail.date]) return;
		run.done += 1;
		settings_say(run.line, "busy", settings_text.desc_comment_progress(run.done, Object.keys(run.dates).length));
	});
	moncycle_store.on("failed", function (detail) {
		if (settings_desc_move_run && settings_desc_move_run.dates[detail.date]) settings_desc_move_run.refused.push(detail.date);
	});

	$("#f_new_description").on("submit", function (event) {
		event.preventDefault();
		const form = $(this);
		const name = settings_read(form, "name");
		const type = parseInt(settings_read(form, "type"));
		if (settings_desc_exists(name, type)) return settings_form_say(form, "error", t("settings.desc_duplicate"));
		settings_form_say(form, "busy", "⏳");
		settings_api("POST", moncycle_config.api_url("/description"), {name: name, type: type_from_int[type]}).done(function () {
			settings_form_say(form, "ok", t("settings.saved"));
			form[0].reset();
			settings_descriptions_load();
			settings_sync_later();
		}).fail(function (jqXHR) {
			console.error(jqXHR);
			settings_form_say(form, "error", settings_error(jqXHR, t_map("settings.desc_errors")));
		});
	});
}
