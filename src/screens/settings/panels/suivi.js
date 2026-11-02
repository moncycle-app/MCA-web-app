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
import { moncycle_config } from "../../../js/core/config.js";
import { moncycle_store } from "../../../js/model/store.js";
import { t, set_language, fill_language_select } from "../../../js/core/i18n.js";
import { refresh } from "../../../js/core/router.js";
import { by_id, delegate } from "../../../js/core/dom.js";
import { settings_account_error, settings_api, settings_is_checked, settings_read, settings_say, settings_state, settings_sync_later } from "../common.js";
import { settings_fill_notifications } from "./notifications.js";
import { settings_fill_settings, settings_setup_setting_forms } from "./affichage.js";
import { settings_show_method_entries } from "../settings.js";

/* ===========================================================================
** 5a. MON SUIVI (method, temperature) and MON PROFIL (nickname, language, birth year, research). Each control saves by itself.
** The optional settings (display, automatic mail) are the forms of affichage.js, saved through the same settings_save.
** ======================================================================== */

// What each autosaved control sends, by its name. The method and the temperature make one setting of the account: each change sends both.
export const settings_autosave = {
	nickname : function (form) { return {nickname: settings_read(form, "nickname")}; },
	method : function (form) { return {method: settings_read(form, "method"), temperatureTracking: settings_is_checked(form, "temperature_tracking")}; },
	temperature_tracking : function (form) { return settings_autosave.method(form); },
	age : function (form) { return {birthYear: parseInt(settings_read(form, "age"))}; },
	language : function (form) { return {language: settings_read(form, "language")}; },
	research : function (form) { return {research: settings_is_checked(form, "research")}; },
};

// The saves go one after the other, so that the server applies them in the order they were made: the method and the temperature are two
// controls of one setting, and two quick clicks would otherwise be free to arrive in reverse.
let settings_save_queue = Promise.resolve();
// `on_refused()` (optional) undoes what was shown before the answer.
export function settings_save(payload, line, {on_refused} = {}) {
	settings_say(line, "busy", "⏳");
	settings_save_queue = settings_save_queue.then(function () {
		return settings_api("POST", moncycle_config.api_url("/account"), payload).then(function (ret) {
			settings_say(line, "ok", t("settings.saved"), true);
			Object.assign(settings_state.account, ret.data || {});
			// the copy of the timeline holds the account too: it takes the answer as it is (settings included)
			moncycle_store.account_saved(ret.data);
			settings_fill_settings(settings_state.account);
			if (ret.data && ret.data.nickname && by_id("name")) by_id("name").textContent = ret.data.nickname;
			settings_show_method_entries();
			settings_sync_later();
			// the language of the account is the one of the interface: the screen is drawn again in it
			if (payload.language) return set_language(payload.language.toLowerCase()).then(refresh).catch(console.error);
		}, function (failure) {
			console.error(failure);
			settings_say(line, "error", t("settings.not_saved") + settings_account_error(failure));
			// the controls show what is saved, not what was refused
			if (on_refused) on_refused();
			if (by_id("f_suivi")) {
				settings_fill_suivi(settings_state.account);
				settings_fill_profil(settings_state.account);
				settings_fill_settings(settings_state.account);
				settings_fill_notifications(settings_state.account);
			}
		});
	});
}

export function settings_autosave_changed(event) {
	const field = event.target;
	const form = field.form;
	// a nickname being typed is not saved while it is empty
	if (!field.checkValidity()) return;
	const build_payload = settings_autosave[field.name];
	// its answer goes in the line of its own group (the nearest fieldset, field or form that has one)
	if (build_payload) settings_save(build_payload(form), field.closest("fieldset, .field, form").querySelector(".form_msg"));
}

export function settings_setup_autosave() {
	const forms = [by_id("f_suivi"), by_id("f_profil")];
	forms.forEach(function (form) {
		// (the nickname is saved as it is typed, below, not again when the field is left)
		delegate(form, "change", "input:not([name=nickname]), select", settings_autosave_changed);
		form.addEventListener("submit", function (event) { event.preventDefault(); });
	});
	settings_setup_setting_forms(settings_save);
	// the nickname is saved as it is typed, once the typing pauses
	let timer = null;
	by_id("i_nickname").addEventListener("input", function (event) {
		clearTimeout(timer);
		timer = setTimeout(function () { settings_autosave_changed(event); }, 600);
	});
}

export function settings_fill_suivi(account) {
	const form = by_id("f_suivi");
	form.querySelectorAll("[name=method]").forEach(function (radio) { radio.checked = radio.value == account.method; });
	form.elements["temperature_tracking"].checked = !!account.temperatureTracking;
}

export function settings_fill_profil(account) {
	const form = by_id("f_profil");
	form.elements["nickname"].value = account.nickname ?? "";
	form.elements["research"].checked = !!account.research;
	settings_fill_birth_years(form.elements["age"], account.birthYear);
	fill_language_select(form.elements["language"], account.language);
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

	select.replaceChildren();
	if (own_block === null) {
		select.append(new Option(t("settings.birth_year_choose"), "", true, true));
		select.firstElementChild.disabled = true;
	}
	blocks.forEach(function (year) {
		select.append(new Option(t("settings.birth_band", {from: year, to: year + 4}), year, false, year == own_block));
	});
}
