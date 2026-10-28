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
import { t, t_map, locale } from "/js/core/i18n.js";
import { settings_text } from "/screens/settings/text.js";

const $ = globalThis.$;

/* ===========================================================================
** 2. SMALL HELPERS
** ======================================================================== */

// The API takes and gives JSON: this is the one place a request is made. `body` is sent as JSON when there is one.
export function settings_api(method, url, body) {
	const options = {type: method, url: url};
	if (body !== undefined) {
		options.contentType = "application/json";
		options.data = JSON.stringify(body);
	}
	return $.ajax(options);
}

// The value of a field of a form by its name (the checked one of a group of radios).
export function settings_read(form, name) {
	return form.find(`[name="${name}"]:not([type=radio]), [name="${name}"][type=radio]:checked`).val();
}

export function settings_is_checked(form, name) {
	return form.find(`[name="${name}"]`).is(":checked");
}

// A session that is over (401) goes back to the sign-in page. Only for what the page loads by itself: a 401 `invalid_password` on a form
// is a wrong password, not the end of the session.
export function settings_leave_if_signed_out(jqXHR) {
	if (jqXHR.status == 401) {
		moncycle_store.clear_storage();
		window.location.replace("/auth");
	}
}

// What went wrong, in French, for any failed request: the page's own words for the error (`own_map`, keyed like moncycle_store.error_pick),
// then the common ones, then no answer at all, then a server that did not speak the API's JSON, and at last the server's own message (English)
// with every problem of a validation_failed. Never empty, and without a final full stop: the caller adds its own punctuation.
export function settings_error(jqXHR, own_map = {}) {
	const known = moncycle_store.error_pick(jqXHR, own_map) || moncycle_store.error_pick(jqXHR, t_map("settings.common_errors"));
	if (known) return known.replace(/\.$/, "");
	if (jqXHR.status === 0) return t("settings.error_network");
	if (!(jqXHR.responseJSON || {}).error) return settings_text.error_server(jqXHR.status);
	return moncycle_store.error_text(jqXHR).replace(/\.$/, "");
}

// The same for what a refusal of POST /api/v2/account says.
export function settings_account_error(jqXHR) {
	return settings_error(jqXHR, t_map("settings.account_errors"));
}

// Report lines from /api/v2/import quote what was in the file -- a sensation name, the app that wrote it -- so they are never dropped
// into HTML as they come.
export function settings_escape_html(text) {
	return $("<span>").text(text === null || text === undefined ? "" : text).html();
}

// Every answer of the page -- a refusal, a success, "in progress" -- goes in a line of class form_msg, next to what it is about: under a
// form's button, under a control that saves by itself, in a keyword's row. kind: "busy", "ok" (green), "error" (red, with its ❌); "" empties
// the line. The message is text: the server's words can quote what the user typed (duplicate_name echoes the label), and are never read as
// HTML. A success of a control that saves by itself is not left there for good: it goes after a moment (`fades`).
export function settings_say(line, kind, message, fades = false) {
	clearTimeout(line.data("fade"));
	line.removeClass("vert rouge").empty();
	if (kind === "busy") line.text(message);
	if (kind === "ok") line.addClass("vert").text(message);
	if (kind === "error") line.addClass("rouge").text("❌ " + message);
	if (kind === "ok" && fades) line.data("fade", setTimeout(function () { line.empty(); }, 2500));
}

// The line of a form.
export function settings_form_say(form, kind, message) {
	settings_say(form.find(".form_msg").last(), kind, message);
}

// Something changed on the server that the local copy (js/store.js) shows: the copy is brought up to date once the changes stop coming
// (a name typed letter by letter is one change per letter).
let settings_sync_timer = null;
export function settings_sync_later() {
	clearTimeout(settings_sync_timer);
	settings_sync_timer = setTimeout(function () { moncycle_store.sync().catch(function () { }); }, 1500);
}

// 2026-09-20 in the user's own time zone (toISOString would be UTC: the day before, late in the evening)
export function settings_today() {
	return dates.str(new Date());
}

export function settings_local_date(ymd) {
	const parts = ymd.split("-");
	return t("calendar.date_numeric", {day: parts[2], month: parts[1], year: parts[0]});
}

export function settings_local_time(iso) {
	return iso ? new Date(iso).toLocaleString(locale(), {dateStyle: "short", timeStyle: "short"}) : "";
}

// A form that changes the account with the password asked again (an address, the password): POST /api/v2/account, its answer under the
// button. `build_payload(form)` reads the form when it is submitted; `on_done(ret)` says what went well; the server's refusal is said
// here. `check(form)` (optional) answers a text when the form must not be sent at all.
export function settings_confirmed_change(form, build_payload, on_done, check) {
	form.on("submit", function (event) {
		event.preventDefault();
		const button = form.find("button[type=submit]");
		settings_form_say(form, "", "");
		const problem = check ? check(form) : "";
		if (problem) return settings_form_say(form, "error", problem);
		button.prop("disabled", true);
		settings_api("POST", moncycle_config.api_url("/account"), build_payload(form)).done(function (ret) {
			on_done(ret);
		}).fail(function (jqXHR) {
			console.error(jqXHR);
			settings_form_say(form, "error", settings_account_error(jqXHR));
		}).always(function () {
			button.prop("disabled", false);
		});
	});
}

// The account of the screen, read once and kept up to date by what the panels save. One object, so that every module sees the same.
export const settings_state = {account: {}};
