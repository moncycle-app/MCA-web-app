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
import { t, t_map, ready as i18n_ready } from "/js/core/i18n.js";

const $ = globalThis.$;

await Promise.all([moncycle_config.ready, i18n_ready]);

// The page of the link in a mail (verify_email.html), as a file of its own: the CSP is script-src 'self', so no inline script.
// The address holds the purpose and the token in its fragment ("#purpose=resetPassword&t=..."): a fragment is never sent to a server,
// written in a log or given as a Referer, and a mail scanner that only fetches the link does not run this script, so it uses nothing
// up. The fragment is read once and then taken off the address; the form below carries the purpose and the token (hidden fields) and
// is what is sent to POST /api/v2/verify_email.

$(document).ready(function(){
	// the password policy is a setting of the server (PASSWORD_POLICY_REGEX, told by server_info); the server checks it again
	$.get(moncycle_config.api_url("/server_info")).done(function(ret) {
		const policy = ((ret || {}).data || {}).passwordPolicyRegex;
		if (policy) $("#i_new_password, #i_new_password_conf").attr("pattern", policy);
	});
	// the texts of each purpose are in the catalog: verify_email.page.<purpose>.title, text, button, done
	const purposes = {accountCreation: {}, resetPassword: {password: true}, changeEmail: {}};
	const text_of = (purpose, part) => t("verify_email.page." + purpose + "." + part);

	const fragment = new URLSearchParams(window.location.hash.slice(1));
	window.history.replaceState(null, "", window.location.pathname + window.location.search);
	const purpose = fragment.get("purpose");
	const page = Object.prototype.hasOwnProperty.call(purposes, purpose) ? purposes[purpose] : null;
	if (page === null || !fragment.get("t")) {
		$("#et_invalid").show();
		return;
	}

	$("#i_purpose").val(purpose);
	$("#i_token").val(fragment.get("t"));
	$("#et_title").text(text_of(purpose, "title"));
	$("#et_text").text(text_of(purpose, "text"));
	$("#but_et").val(text_of(purpose, "button"));
	if (page.password) {
		$("#et_password_block").show();
		$("#i_new_password, #i_new_password_conf").prop("required", true);
	}
	$("#et_form_box").show();

	$("#f_verify_email").on("submit", function(event) {
		event.preventDefault();
		$("#et_error_msg").text("");
		if (page.password && $("#i_new_password").val() != $("#i_new_password_conf").val()) {
			$("#et_error_msg").text(t("verify_email.password_mismatch"));
			return;
		}
		$("#but_et").prop("disabled", true);
		var payload = {purpose: $("#i_purpose").val(), token: $("#i_token").val()};
		if (page.password) payload.newPassword = $("#i_new_password").val();
		$.ajax({
			type: "POST",
			url: moncycle_config.api_url("/verify_email"),
			contentType: "application/json",
			data: JSON.stringify(payload),
		}).done(function(ret) {
			console.log(ret);
			$("#i_new_password, #i_new_password_conf, #i_token").val("");
			$("#et_form_box").hide();
			$("#et_done_text").text(text_of(purpose, "done"));
			// the address to sign in with, as the server knows it now
			$("#et_login_link").attr("href", "auth?login_email=" + encodeURIComponent(ret.data.loginEmail));
			$("#et_done").show();
		}).fail(function(jqXHR) {
			console.error(jqXHR);
			$("#but_et").prop("disabled", false);
			var err = (jqXHR.responseJSON || {}).error || {};
			const return_codes = t_map("verify_email.errors");
			$("#et_error_msg").text(moncycle_store.error_pick(jqXHR, return_codes) || moncycle_store.error_text(jqXHR));
		});
	});
});
