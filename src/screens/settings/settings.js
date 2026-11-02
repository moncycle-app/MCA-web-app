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
/* The settings screen: a menu, and one panel per entry. Which panel is open is the hash of the address (#/settings/notifications); no panel is
** the menu. The panels are in panels/*.js (each a form or two that save by themselves), the helpers they share in common.js. */
import { parse_route, restart } from "../../js/core/router.js";
import { moncycle_config } from "../../js/core/config.js";
import { moncycle_store } from "../../js/model/store.js";
import { t } from "../../js/core/i18n.js";
import { by_id } from "../../js/core/dom.js";
import { settings_state, settings_api, settings_error, settings_say } from "./common.js";
import { settings_fill_suivi, settings_fill_profil, settings_setup_autosave } from "./panels/suivi.js";
import { settings_fill_settings } from "./panels/affichage.js";
import { settings_descriptions_load, settings_setup_descriptions } from "./panels/descriptions.js";
import { settings_fill_notifications, settings_setup_notifications } from "./panels/notifications.js";
import { settings_fill_data, settings_setup_export, settings_setup_import } from "./panels/donnees.js";
import { settings_fill_connexion, settings_setup_login_email, settings_setup_password, settings_setup_totp } from "./panels/connexion.js";
import { settings_tokens_load, settings_setup_tokens } from "./panels/appareils.js";
import { settings_fill_about, settings_load_server_info, settings_setup_local_copy } from "./panels/apropos.js";
import { settings_setup_deletion } from "./panels/suppression.js";


/* ===========================================================================
** 3. THE ACCOUNT: read once, kept here, and kept up to date by what the panels save
** ======================================================================== */

export function settings_is_demo() {
	return moncycle_store.is_demo(settings_state.account.userId);
}

// Fills the panels that show something of the account, and hides the entries that make no sense for it.
export function settings_show_account(account) {
	// the screen can be left before the account arrives
	if (!by_id("name")) return;
	settings_state.account = account;
	const demo = settings_is_demo();

	by_id("name").textContent = account.nickname;
	document.title = t("settings.page_title", {nickname: account.nickname});
	by_id("warning_demo").hidden = !demo;
	// a demo account cannot change its sign-in, its connections, its mails, and cannot be deleted
	["connexion", "appareils", "notifications", "suppression"].forEach(function (panel) { by_id("menu_" + panel).hidden = demo; });
	settings_show_method_entries();

	settings_fill_suivi(account);
	settings_fill_profil(account);
	settings_fill_settings(account);
	settings_fill_notifications(account);
	settings_fill_data(account);
	settings_fill_connexion(account);
	settings_fill_about(account);
	settings_show_panel();
}

// FertilityCare has no sensation/observation keywords of its own to manage
export function settings_show_method_entries() {
	by_id("menu_descriptions").hidden = settings_state.account.method == "fertilityCare";
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
	let name = parse_route(location.hash).sub;
	const entry = by_id("menu_" + name);
	if (!entry || entry.hidden) name = "";

	by_id("menu").hidden = name !== "";
	document.querySelectorAll(".panel").forEach(function (panel) { panel.hidden = true; });
	if (name !== "") {
		by_id("panel_" + name).hidden = false;
		if (settings_on_open[name] && settings_state.account.userId !== undefined) settings_on_open[name]();
	}
	window.scrollTo(0, 0);
}

export const screen = {
	name: "settings",
	path: "/settings",
	auth: true,
	html: "screens/settings/settings.html",
	title: () => t("settings.document_title"),

	mount(root, ctx) {
		settings_state.account = {};
		settings_state.signal = ctx.signal;

		// logout: the server ends the session (and clears its cookie, which only it can), then the local copy goes with it
		by_id("f_logout").addEventListener("submit", function (event) {
			event.preventDefault();
			by_id("but_logout").disabled = true;
			settings_api("DELETE", moncycle_config.api_url("/token")).then(function () {
				moncycle_store.clear_storage();
				restart("/auth");
			}, function (failure) {
				by_id("but_logout").disabled = false;
				alert(t("settings.logout_failed", {reason: settings_error(failure)}));
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
		settings_api("GET", moncycle_config.api_url("/account")).then(function (ret) {
			settings_show_account(ret.data);
		}, function (failure) {
			settings_say(by_id("page_msg"), "error", t("settings.account_not_loaded") + settings_error(failure));
		});
	},

	// the address changed inside the screen: another panel
	on_hash(sub) { settings_show_panel(); },

	unmount() {
		settings_state.signal = undefined;
	},
};
