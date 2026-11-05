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
import { moncycle_captcha } from "../../../js/services/captcha.js";
import { t, t_map } from "../../../js/core/i18n.js";
import { by_id, el, delegate } from "../../../js/core/dom.js";
import { settings_api, settings_error, settings_local_time, settings_read, settings_say } from "../common.js";
import { settings_text } from "../text.js";

/* ===========================================================================
** 5f. APPAREILS ET ACCÈS: the connections, and the access tokens made by hand
** ======================================================================== */

// Everything the server says of a token (a name, a user agent) is the device's own word: text nodes only, never HTML.
export function settings_token_card(token) {
	const head = el("div", {class: "token_title"}, el("b", {text: token.name}));
	// the first characters of the token (null for an old one that started like another): what tells two connections of one app apart
	if (token.prefix) head.append(el("code", {class: "token_prefix", title: t("settings.tokens_prefix_title"), text: token.prefix + "…"}));
	head.append(el("span", {class: "label_info", text: " — " + t_map("settings.tokens_scope")[token.scope]}));
	if (token.current) head.append(el("b", {class: "green", text: " (" + t("settings.tokens_current") + ")"}));

	// key / value rows: the date in bold, then the address, and the device's own words under it in small
	const facts = el("dl", {class: "kv"});
	const add_fact = function (key, value, ip, agent) {
		const cell = el("dd", {text: value});
		const where = [ip, agent].filter(Boolean).join(" · ");
		if (where) cell.append(el("small", {text: where}));
		facts.append(el("dt", {text: key}), cell);
	};
	add_fact(t("settings.tokens_created"), settings_local_time(token.createdAt), token.createdIp, token.createdUserAgent);
	if (token.lastUsedAt) add_fact(t("settings.tokens_last_used"), settings_local_time(token.lastUsedAt), token.lastUsedIp, token.lastUsedUserAgent);
	else add_fact(t("settings.tokens_last_used"), t("settings.tokens_never_used"));
	if (token.expiresAt) add_fact(t("settings.tokens_expires"), settings_local_time(token.expiresAt));
	const card = el("div", {class: "token_row"}, head, facts);

	// this connection is the one in use: it ends with the logout button, not here
	if (!token.current && token.prefix) {
		const revoke = el("form", {class: "f_token_revoke", action: moncycle_config.api_url("/token/" + encodeURIComponent(token.prefix)), method: "delete"});
		revoke.append(el("button", {type: "submit", class: "red", text: "🗑️ " + t("settings.tokens_revoke")}));
		card.append(revoke);
	}
	return card;
}

export function settings_tokens_load() {
	return settings_api("GET", moncycle_config.api_url("/token")).then(function (ret) {
		const container = by_id("tokens_container");
		if (!container) return;
		container.replaceChildren();
		if (ret.data.length === 0) container.textContent = t("settings.tokens_none");
		ret.data.forEach(function (token) { container.append(settings_token_card(token)); });
	}, function (failure) {
		if (by_id("tokens_msg")) settings_say(by_id("tokens_msg"), "error", settings_error(failure));
	});
}

// The form says what to revoke by its address: api/v3/token/{prefix} for one connection, api/v3/token?others=true for all the others.
export function settings_tokens_revoke(form) {
	settings_say(by_id("tokens_msg"), "busy", "⏳");
	settings_api("DELETE", form.getAttribute("action")).then(function (ret) {
		settings_say(by_id("tokens_msg"), "ok", settings_text.tokens_revoked(ret.data.revoked));
	}, function (failure) {
		settings_say(by_id("tokens_msg"), "error", settings_error(failure));
	}).finally(settings_tokens_load);
}

export function settings_setup_tokens() {
	delegate(by_id("tokens_container"), "submit", ".f_token_revoke", function (event, form) {
		event.preventDefault();
		settings_tokens_revoke(form);
	});
	by_id("f_tokens_revoke_all").addEventListener("submit", function (event) {
		event.preventDefault();
		if (confirm(t("settings.tokens_confirm_revoke_all"))) settings_tokens_revoke(event.currentTarget);
	});

	// A token is made like a sign-in that sets no cookie: the password (and the code, and the captcha once the account asks for one) is
	// asked again.
	const form = by_id("f_token_create");
	const captcha_field = by_id("token_new_captcha_wrapper");
	const captcha = moncycle_captcha.attach({
		purpose: "login",
		email: by_id("i_token_new_email"),
		image: by_id("i_token_new_captcha_img"),
		token: by_id("i_token_new_captcha_token"),
		answer: by_id("i_token_new_captcha"),
		active: function () { return !captcha_field.hidden; },
		error: moncycle_captcha.message_in(by_id("token_new_err")),
	});

	form.addEventListener("submit", function (event) {
		event.preventDefault();
		const button = by_id("but_token_create");
		const payload = {
			email: settings_read(form, "email"),
			password: settings_read(form, "password"),
			name: settings_read(form, "name"),
			scope: settings_read(form, "scope"),
			expiresInDays: parseInt(settings_read(form, "expiresInDays")),
			cookie: settings_read(form, "cookie") === "true",
		};
		if (settings_read(form, "code")) payload.code = settings_read(form, "code");
		if (!captcha_field.hidden) {
			payload.captcha = settings_read(form, "captcha");
			payload.captchaToken = settings_read(form, "captchaToken");
		}
		settings_say(by_id("token_new_err"), "", "");
		by_id("token_new_result").hidden = true;
		button.disabled = true;
		button.textContent = "🔑 " + t("settings.token_creating");
		settings_api("POST", moncycle_config.api_url("/token"), payload).then(function (ret) {
			by_id("i_token_new_value").value = ret.data.token;
			by_id("token_copy_ok").textContent = "";
			by_id("token_new_result").hidden = false;
			["password", "code", "name"].forEach(function (name) { form.elements[name].value = ""; });
			settings_tokens_load();
		}, function (failure) {
			const error = (failure.responseJSON || {}).error || {};
			// the server asks for a captcha once the account has failed too often (a wrong password here counts like a wrong sign-in)
			if ((error.details || {}).captchaRequired) captcha_field.hidden = false;
			const shown = settings_error(failure, t_map("settings.token_errors"));
			settings_say(by_id("token_new_err"), "error", shown);
		}).finally(function () {
			button.disabled = false;
			button.textContent = t("settings.token_create_button");
			// the captcha is tied to the account's counters, which this attempt may have moved: a new one whenever it is shown
			captcha.reload(true);
		});
	});

	by_id("but_token_copy").addEventListener("click", function () {
		navigator.clipboard.writeText(by_id("i_token_new_value").value).then(function () {
			by_id("token_copy_ok").textContent = t("settings.token_copied");
		}, function () {
			by_id("token_copy_ok").textContent = t("settings.token_copy_failed");
		});
	});
}
