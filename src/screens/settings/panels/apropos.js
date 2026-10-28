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
import { t, locale } from "/js/core/i18n.js";
import { settings_leave_if_signed_out, settings_say } from "/screens/settings/common.js";
import { settings_load_news } from "/screens/settings/panels/actualites.js";

const $ = globalThis.$;

/* ===========================================================================
** 5g. À PROPOS: the application, the terms, the numbers of the account
** ======================================================================== */

export function settings_fill_about(account) {
	$("#tech_info_no").text(account.userId);
	$("#tech_info_id").text(account.loginEmail);
	const since = new Date(account.inscriptionDate);
	$("#tech_info_insc").text(since.toLocaleDateString(locale(), {day: "2-digit", month: "2-digit", year: "numeric"}));
}

// The version, and the terms of service: their page is a setting of the server (TERMS_OF_SERVICE_URL, told by server_info). None told: the
// paragraph that sums them up is not shown.
export function settings_load_server_info() {
	moncycle_store.load_webapp().then(function (webapp) { $("#tech_info_webapp").text(webapp ? webapp.version : "?"); });
	$.get(moncycle_config.api_url("/server_info")).done(function (ret) {
		const info = (ret || {}).data || {};
		$("#tech_info_ver").text(info.appVersion ?? "?");
		if (info.passwordPolicyRegex) $("#i_pw1, #i_pw2").attr("pattern", info.passwordPolicyRegex);
		if (info.newsUrl) settings_load_news(info.newsUrl);
		else console.info("news: server_info tells no newsUrl (NEWS_URL is empty or not https), no news entry");
		if (!/^https:\/\//i.test(info.termsOfServiceUrl || "")) return;
		$("#a_terms").attr("href", info.termsOfServiceUrl);
		$("#terms_about").prop("hidden", false);
	}).fail(settings_leave_if_signed_out);
}

/* ===========================================================================
** 5f. DÉPANNAGE: the local copy, emptied or synchronised by hand
** ======================================================================== */

export function settings_setup_local_copy() {
	const line = $("#local_msg");
	const buttons = $("#but_local_reset, #but_local_sync");
	const run = function (busy, done, before) {
		buttons.prop("disabled", true);
		settings_say(line, "busy", busy);
		if (before) before();
		moncycle_store.sync().then(function () {
			settings_say(line, "ok", done, true);
		}, function (jqXHR) {
			// a session that is over has already left the page
			if (jqXHR && jqXHR.status !== undefined) console.error(jqXHR);
			settings_say(line, "error", t("settings.local_failed"));
		}).finally(function () { buttons.prop("disabled", false); });
	};
	$("#but_local_sync").on("click", function () { run(t("settings.local_sync_running"), t("settings.local_sync_done")); });
	$("#but_local_reset").on("click", function () {
		if (!confirm(t("settings.local_reset_confirm"))) return;
		run(t("settings.local_reset_running"), t("settings.local_reset_done"), moncycle_store.reset_local);
	});
}
