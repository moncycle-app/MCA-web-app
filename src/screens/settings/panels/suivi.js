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
import { t } from "/js/core/i18n.js";
import { settings_account_error, settings_api, settings_is_checked, settings_read, settings_say, settings_state, settings_sync_later } from "/screens/settings/common.js";
import { settings_fill_notifications } from "/screens/settings/panels/notifications.js";
import { settings_show_method_entries } from "/screens/settings/settings.js";

const $ = globalThis.$;

/* ===========================================================================
** 5a. MON SUIVI: nickname, method, temperature, display, birth year, research. Each control saves by itself.
** ======================================================================== */

// What each autosaved control sends, by its name. The method and the temperature make one setting of the account: each change sends both.
export const settings_autosave = {
	nickname : function (form) { return {nickname: settings_read(form, "nickname")}; },
	method : function (form) { return {method: settings_read(form, "method"), temperatureTracking: settings_is_checked(form, "temperature_tracking")}; },
	temperature_tracking : function (form) { return settings_autosave.method(form); },
	timeline_asc : function (form) { return {timelineAscending: settings_is_checked(form, "timeline_asc")}; },
	age : function (form) { return {birthYear: parseInt(settings_read(form, "age"))}; },
	research : function (form) { return {research: settings_is_checked(form, "research")}; },
	auto_mail_export : function (form) { return {autoMailExport: settings_is_checked(form, "auto_mail_export")}; },
};

// The saves go one after the other, so that the server applies them in the order they were made: the method and the temperature are two
// controls of one setting, and two quick clicks would otherwise be free to arrive in reverse.
let settings_save_queue = Promise.resolve();
export function settings_save(payload, line) {
	settings_say(line, "busy", "⏳");
	settings_save_queue = settings_save_queue.then(function () {
		return settings_api("POST", moncycle_config.api_url("/account"), payload).then(function (ret) {
			settings_say(line, "ok", t("settings.saved"), true);
			Object.assign(settings_state.account, ret.data || {});
			if (ret.data && ret.data.nickname) $("#name").text(ret.data.nickname);
			settings_show_method_entries();
			settings_sync_later();
		}, function (jqXHR) {
			console.error(jqXHR);
			settings_say(line, "error", t("settings.not_saved") + settings_account_error(jqXHR));
			// the controls show what is saved, not what was refused
			settings_fill_suivi(settings_state.account);
			settings_fill_notifications(settings_state.account);
		});
	});
}

export function settings_autosave_changed(event) {
	const field = event.target;
	const form = $(field.form);
	// a nickname being typed is not saved while it is empty
	if (!field.checkValidity()) return;
	const build_payload = settings_autosave[field.name];
	// its answer goes in the line of its own group (the nearest fieldset, field or form that has one)
	if (build_payload) settings_save(build_payload(form), $(field).closest("fieldset, .field, form").find(".form_msg").first());
}

export function settings_setup_autosave() {
	const forms = $("#f_suivi, #f_auto_mail");
	// (the nickname is saved as it is typed, below, not again when the field is left)
	forms.on("change", "input:not([name=nickname]), select", settings_autosave_changed);
	// the nickname is saved as it is typed, once the typing pauses
	let timer = null;
	$("#i_nickname").on("input", function (event) {
		clearTimeout(timer);
		timer = setTimeout(function () { settings_autosave_changed(event); }, 600);
	});
	forms.on("submit", function (event) { event.preventDefault(); });
}

export function settings_fill_suivi(account) {
	const form = $("#f_suivi");
	form.find("[name=nickname]").val(account.nickname);
	form.find("[name=method]").each(function () { this.checked = this.value == account.method; });
	form.find("[name=temperature_tracking]").prop("checked", !!account.temperatureTracking);
	form.find("[name=timeline_asc]").prop("checked", !!account.timelineAscending);
	form.find("[name=research]").prop("checked", !!account.research);
	settings_fill_birth_years(form.find("[name=age]"), account.birthYear);
}

// The years are asked in blocks of five: "entre 1985 et 1989", saved as 1985. The stored year can be any year (1992): it selects the block
// it falls in, and a block outside the usual range is added rather than lost.
export function settings_fill_birth_years(select, birth_year) {
	const this_year = (new Date()).getFullYear();
	const blocks = [];
	for (let year = (this_year - this_year % 5) - 75; year < this_year - 5; year += 5) blocks.push(year);
	const own_block = birth_year ? birth_year - birth_year % 5 : null;
	if (own_block !== null && !blocks.includes(own_block)) blocks.push(own_block);
	blocks.sort(function (a, b) { return a - b; });

	select.empty();
	if (own_block === null) select.append(new Option(t("settings.birth_year_choose"), "", true, true)).find("option:first").prop("disabled", true);
	blocks.forEach(function (year) {
		select.append(new Option(`entre ${year} et ${year + 4}`, year, false, year == own_block));
	});
}
