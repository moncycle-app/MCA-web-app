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

/* The settings screen: a menu, and one panel per entry. Which panel is open is the hash of the address (/settings#notifications); no hash is
** the menu. The panels are in panels/*.js (each a form or two that save by themselves), the helpers they share in common.js. */
import { moncycle_config } from "/js/core/config.js";
import { moncycle_store } from "/js/model/store.js";
import { t } from "/js/core/i18n.js";
import { settings_state, settings_api, settings_error, settings_say, settings_leave_if_signed_out } from "/screens/settings/common.js";
import { settings_fill_suivi, settings_setup_autosave } from "/screens/settings/panels/suivi.js";
import { settings_descriptions_load, settings_setup_descriptions } from "/screens/settings/panels/descriptions.js";
import { settings_fill_notifications, settings_setup_notifications } from "/screens/settings/panels/notifications.js";
import { settings_fill_data, settings_setup_export, settings_setup_import } from "/screens/settings/panels/donnees.js";
import { settings_fill_connexion, settings_setup_login_email, settings_setup_password, settings_setup_totp } from "/screens/settings/panels/connexion.js";
import { settings_tokens_load, settings_setup_tokens } from "/screens/settings/panels/appareils.js";
import { settings_fill_about, settings_load_server_info, settings_setup_local_copy } from "/screens/settings/panels/apropos.js";
import { settings_setup_deletion } from "/screens/settings/panels/suppression.js";

const $ = globalThis.$;

/* ===========================================================================
** 3. THE ACCOUNT: read once, kept here, and kept up to date by what the panels save
** ======================================================================== */

export function settings_is_demo() {
	return moncycle_store.is_demo(settings_state.account.userId);
}

// Fills the panels that show something of the account, and hides the entries that make no sense for it.
export function settings_show_account(account) {
	settings_state.account = account;
	const demo = settings_is_demo();

	$("#name").text(account.nickname);
	document.title = t("settings.page_title", {nickname: account.nickname});
	$("#warning_demo").prop("hidden", !demo);
	// a demo account cannot change its sign-in, its connections, its mails, and cannot be deleted
	["connexion", "appareils", "notifications", "suppression"].forEach(function (panel) { $("#menu_" + panel).prop("hidden", demo); });
	settings_show_method_entries();

	settings_fill_suivi(account);
	settings_fill_notifications(account);
	settings_fill_data(account);
	settings_fill_connexion(account);
	settings_fill_about(account);
	settings_show_panel();
}

// FertilityCare has no sensation/observation keywords of its own to manage
export function settings_show_method_entries() {
	$("#menu_descriptions").prop("hidden", settings_state.account.method == "fertilityCare");
}

/* ===========================================================================
** 4. THE MENU: which panel is open is the address (#suivi); no address is the menu
** ======================================================================== */

// what a panel loads each time it opens
const settings_on_open = {
	descriptions : function () { settings_descriptions_load(); },
	donnees : function () { settings_descriptions_load(); },
	appareils : function () { settings_tokens_load(); },
};

export function settings_show_panel() {
	let name = location.hash.slice(1);
	const entry = $("#menu_" + name);
	if (entry.length == 0 || entry.prop("hidden")) name = "";

	$("#menu").prop("hidden", name !== "");
	$(".panel").prop("hidden", true);
	if (name !== "") {
		$("#panel_" + name).prop("hidden", false);
		if (settings_on_open[name] && settings_state.account.userId !== undefined) settings_on_open[name]();
	}
	window.scrollTo(0, 0);
}


export const screen = {
	name: "settings",
	path: "/settings",
	auth: true,
	html: "/screens/settings/settings.html",
	title: () => t("settings.document_title"),

	mount(root, ctx) {
		settings_state.account = {};

		// A session that has ended answers 401 `unauthorized` to anything: back to the sign-in page, whichever request it was. (A 401 with
		// another code is a wrong password or code on a form: the session goes on.)
		$(document).on("ajaxError.settings", function (event, jqXHR) {
			const error = (jqXHR.responseJSON || {}).error || {};
			if (jqXHR.status == 401 && error.code == "unauthorized") settings_leave_if_signed_out(jqXHR);
		});

		// logout: the server ends the session (and clears its cookie, which only it can), then the local copy goes with it
		$("#f_logout").on("submit", function (event) {
			event.preventDefault();
			$("#but_logout").prop("disabled", true);
			settings_api("DELETE", moncycle_config.api_url("/token")).done(function () {
				moncycle_store.clear_storage();
				window.location.replace("/auth");
			}).fail(function (jqXHR) {
				$("#but_logout").prop("disabled", false);
				alert(t("settings.logout_failed", {reason: settings_error(jqXHR)}));
			});
		});

		settings_setup_autosave();
		settings_setup_descriptions();
		settings_setup_local_copy();
		settings_setup_notifications();
		settings_setup_export();
		settings_setup_import();
		settings_setup_login_email();
		settings_setup_password();
		settings_setup_totp();
		settings_setup_tokens();
		settings_setup_deletion();

		settings_show_panel();

		settings_load_server_info();
		$.get(moncycle_config.api_url("/account")).done(function (ret) {
			settings_show_account(ret.data);
		}).fail(function (jqXHR) {
			settings_say($("#page_msg"), "error", t("settings.account_not_loaded") + settings_error(jqXHR));
		});
	},

	// the address changed inside the screen: another panel
	on_hash() { settings_show_panel(); },

	unmount() {
		$(document).off(".settings");
	},
};
