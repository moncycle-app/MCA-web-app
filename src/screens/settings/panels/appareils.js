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
import { moncycle_captcha } from "/js/services/captcha.js";
import { t, t_map } from "/js/core/i18n.js";
import { settings_api, settings_error, settings_leave_if_signed_out, settings_local_time, settings_read, settings_say } from "/screens/settings/common.js";
import { settings_text } from "/screens/settings/text.js";

const $ = globalThis.$;

/* ===========================================================================
** 5f. APPAREILS ET ACCÈS: the connections, and the access tokens made by hand
** ======================================================================== */

// Everything the server says of a token (a name, a user agent) is the device's own word: text nodes only, never HTML.
export function settings_token_card(token) {
	const head = $("<div>", {class: "token_title"}).append($("<b>").text(token.name));
	// the first characters of the token (null for an old one that started like another): what tells two connections of one app apart
	if (token.prefix) head.append($("<code>", {class: "token_prefix", title: t("settings.tokens_prefix_title")}).text(token.prefix + "…"));
	head.append($("<span>", {class: "label_info"}).text(" — " + t_map("settings.tokens_scope")[token.scope]));
	if (token.current) head.append($("<b>", {class: "vert"}).text(" (" + t("settings.tokens_current") + ")"));

	// key / value rows: the date in bold, then the address, and the device's own words under it in small
	const facts = $("<dl>", {class: "kv"});
	const add_fact = function (key, value, ip, agent) {
		const cell = $("<dd>").text(value);
		const where = [ip, agent].filter(Boolean).join(" · ");
		if (where) cell.append($("<small>").text(where));
		facts.append($("<dt>").text(key), cell);
	};
	add_fact(t("settings.tokens_created"), settings_local_time(token.createdAt), token.createdIp, token.createdUserAgent);
	if (token.lastUsedAt) add_fact(t("settings.tokens_last_used"), settings_local_time(token.lastUsedAt), token.lastUsedIp, token.lastUsedUserAgent);
	else add_fact(t("settings.tokens_last_used"), t("settings.tokens_never_used"));
	if (token.expiresAt) add_fact(t("settings.tokens_expires"), settings_local_time(token.expiresAt));
	const card = $("<div>", {class: "token_row"}).append(head, facts);

	// this connection is the one in use: it ends with the logout button, not here
	if (!token.current && token.prefix) {
		const revoke = $("<form>", {class: "f_token_revoke", action: moncycle_config.api_url("/token/" + encodeURIComponent(token.prefix)), method: "delete"});
		revoke.append($("<button>", {type: "submit", class: "rouge"}).text("🗑️ " + t("settings.tokens_revoke")));
		card.append(revoke);
	}
	return card;
}

export function settings_tokens_load() {
	return $.get(moncycle_config.api_url("/token")).done(function (ret) {
		const container = $("#tokens_container").empty();
		if (ret.data.length === 0) container.text(t("settings.tokens_none"));
		ret.data.forEach(function (token) { container.append(settings_token_card(token)); });
	}).fail(function (jqXHR) {
		settings_leave_if_signed_out(jqXHR);
		settings_say($("#tokens_msg"), "error", settings_error(jqXHR));
	});
}

// The form says what to revoke by its address: api/v2/token/{prefix} for one connection, api/v2/token?others=true for all the others.
export function settings_tokens_revoke(form) {
	settings_say($("#tokens_msg"), "busy", "⏳");
	settings_api("DELETE", form.attr("action")).done(function (ret) {
		settings_say($("#tokens_msg"), "ok", settings_text.tokens_revoked(ret.data.revoked));
	}).fail(function (jqXHR) {
		settings_leave_if_signed_out(jqXHR);
		settings_say($("#tokens_msg"), "error", settings_error(jqXHR));
	}).always(settings_tokens_load);
}

export function settings_setup_tokens() {
	$("#tokens_container").on("submit", ".f_token_revoke", function (event) {
		event.preventDefault();
		settings_tokens_revoke($(this));
	});
	$("#f_tokens_revoke_all").on("submit", function (event) {
		event.preventDefault();
		if (confirm(t("settings.tokens_confirm_revoke_all"))) settings_tokens_revoke($(this));
	});

	// A token is made like a sign-in that sets no cookie: the password (and the code, and the captcha once the account asks for one) is
	// asked again.
	const form = $("#f_token_create");
	const captcha_field = $("#token_new_captcha_wrapper");
	const captcha = moncycle_captcha.attach({
		purpose: "login",
		email: $("#i_token_new_email")[0],
		image: $("#i_token_new_captcha_img")[0],
		token: $("#i_token_new_captcha_token")[0],
		answer: $("#i_token_new_captcha")[0],
		active: function () { return !captcha_field.prop("hidden"); },
		error: moncycle_captcha.message_in($("#token_new_err")[0]),
	});

	form.on("submit", function (event) {
		event.preventDefault();
		const button = $("#but_token_create");
		const payload = {
			email: settings_read(form, "email"),
			password: settings_read(form, "password"),
			name: settings_read(form, "name"),
			scope: settings_read(form, "scope"),
			expiresInDays: parseInt(settings_read(form, "expiresInDays")),
			cookie: settings_read(form, "cookie") === "true",
		};
		if (settings_read(form, "code")) payload.code = settings_read(form, "code");
		if (!captcha_field.prop("hidden")) {
			payload.captcha = settings_read(form, "captcha");
			payload.captchaToken = settings_read(form, "captchaToken");
		}
		settings_say($("#token_new_err"), "", "");
		$("#token_new_result").prop("hidden", true);
		button.prop("disabled", true).text("🔑 " + t("settings.token_creating"));
		settings_api("POST", moncycle_config.api_url("/token"), payload).done(function (ret) {
			$("#i_token_new_value").val(ret.data.token);
			$("#token_copy_ok").text("");
			$("#token_new_result").prop("hidden", false);
			form.find("[name=password], [name=code], [name=name]").val("");
			settings_tokens_load();
		}).fail(function (jqXHR) {
			const error = (jqXHR.responseJSON || {}).error || {};
			// the server asks for a captcha once the account has failed too often (a wrong password here counts like a wrong sign-in)
			if ((error.details || {}).captchaRequired) captcha_field.prop("hidden", false);
			const shown = settings_error(jqXHR, t_map("settings.token_errors"));
			settings_say($("#token_new_err"), "error", shown);
		}).always(function () {
			button.prop("disabled", false).text(t("settings.token_create_button"));
			// the captcha is tied to the account's counters, which this attempt may have moved: a new one whenever it is shown
			captcha.reload(true);
		});
	});

	$("#but_token_copy").on("click", function () {
		navigator.clipboard.writeText($("#i_token_new_value").val()).then(function () {
			$("#token_copy_ok").text(t("settings.token_copied"));
		}, function () {
			$("#token_copy_ok").text(t("settings.token_copy_failed"));
		});
	});
}
