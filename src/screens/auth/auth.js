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

/* The sign-in screen: the form carries the data, the script submits it. A mail link comes here with ?login_email=. */
import { moncycle_config } from "/js/core/config.js";
import { moncycle_store } from "/js/model/store.js";
import { moncycle_captcha } from "/js/services/captcha.js";
import { api } from "/js/core/api.js";
import { field } from "/js/core/dom.js";
import { t, t_node, t_map } from "/js/core/i18n.js";
import { has_session } from "/js/core/router.js";

const by_id = (root, id) => root.querySelector("#" + id);

export const screen = {
	name: "auth",
	path: "/auth",
	auth: false,
	html: "/screens/auth/auth.html",
	title: () => t("auth.page_title"),
	// someone signed in has nothing to do here
	redirect: () => (has_session() ? "/" : null),

	mount(root, ctx) {
		const listen = {signal: ctx.signal};
		moncycle_store.clear_storage();
		// another tab signed in: this one follows
		window.addEventListener("storage", () => { if (has_session()) location.replace("/"); }, listen);

		const form = by_id(root, "connexion_form");
		const reset_form = by_id(root, "reset_form");
		const wrapper = by_id(root, "captcha_wrapper");
		// the sign-in asks for a captcha once the account has failed too often (the server says so with captchaRequired); the
		// token is tied to the account's counters, so a new one is made after every refused attempt
		const login_captcha = moncycle_captcha.attach({
			purpose: "login",
			email: by_id(root, "i_login_email"),
			image: by_id(root, "l_captcha"),
			token: by_id(root, "i_captcha_token"),
			answer: by_id(root, "i_captcha"),
			active: () => !wrapper.hidden,
			error: moncycle_captcha.message_in(by_id(root, "message_err")),
			signal: ctx.signal,
		});
		// the lost password always asks for one
		const reset_captcha = moncycle_captcha.attach({
			purpose: "recover",
			email: by_id(root, "r_login_email"),
			image: by_id(root, "rc_captcha_img"),
			token: by_id(root, "rc_captcha_token"),
			answer: by_id(root, "rc_captcha"),
			error: moncycle_captcha.message_in(by_id(root, "reset_error_msg")),
			signal: ctx.signal,
		});
		// the link to the terms of service is the server's (TERMS_OF_SERVICE_URL, told by server_info): none told, no link
		api("GET", "/server_info", undefined, {signal: ctx.signal}).then((ret) => {
			const url = ((ret || {}).data || {}).termsOfServiceUrl;
			if (/^https:\/\//i.test(url || "")) {
				const link = by_id(root, "a_terms");
				link.setAttribute("href", url);
				link.hidden = false;
			}
		}, () => { });
		// another origin than the API's gets no cookie: the sign-in asks for the token alone and the script keeps it
		if (moncycle_config.remote) by_id(root, "i_token_cookie").value = "false";
		// the session is named after the site it was opened on, as the browser knows it
		by_id(root, "i_token_name").value = "WEB-APP " + location.hostname;

		const button = by_id(root, "connexion_but");
		const message = by_id(root, "message_err");
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			button.disabled = true;
			button.value = t("auth.but_connect_busy");
			const payload = {
				email: field(form, "login_email"),
				password: field(form, "password"),
				name: field(form, "name"),
				cookie: field(form, "cookie") === "true",
			};
			if (field(form, "code")) payload.code = field(form, "code");
			if (!wrapper.hidden) {
				payload.captcha = field(form, "captcha");
				payload.captchaToken = field(form, "captchaToken");
			}
			try {
				const ret = await api("POST", "/token", payload);
				if (moncycle_config.remote) moncycle_config.set_token(ret.data.token);
				localStorage.auth = ret.data.userId;
				location.replace("/");   // a full load: nothing of the screen or of an older session stays in memory
			}
			catch (failure) {
				button.disabled = false;
				button.value = t("auth.but_connect");
				if ((((failure.responseJSON || {}).error || {}).details || {}).captchaRequired) wrapper.hidden = false;
				message.replaceChildren(moncycle_store.error_pick(failure, t_map("auth.signin_errors")) || moncycle_store.error_text(failure), document.createElement("br"));
				// the token is tied to the account's counters, which this attempt may have moved: a new one, whenever the
				// captcha is shown (and the first one, when this answer is the one that asks for it)
				login_captcha.reload(true);
			}
		}, listen);

		const reset_button = by_id(root, "reset_but");
		const reset_error = by_id(root, "reset_error_msg");
		reset_form.addEventListener("submit", async (event) => {
			event.preventDefault();
			reset_button.disabled = true;
			reset_button.value = t("auth.but_reset_busy");
			reset_error.textContent = "";
			const email = field(reset_form, "login_email");
			try {
				const ret = await api("POST", "/recover_password", {email: email, captcha: field(reset_form, "captcha"), captchaToken: field(reset_form, "captchaToken")});
				reset_button.value = t("auth.but_reset");
				reset_button.disabled = false;
				if (ret.data && ret.data.sent) {
					reset_form.hidden = true;
					// the address is what was typed: a text node, never HTML
					const bold = document.createElement("b");
					bold.textContent = email;
					by_id(root, "password_reseted_msg").replaceChildren(t_node("auth.reset_sent", {br: document.createElement("br"), email: bold}));
				}
			}
			catch (failure) {
				reset_button.value = t("auth.but_reset");
				reset_button.disabled = false;
				console.error(failure);
				const code = ((failure.responseJSON || {}).error || {}).code;
				reset_error.textContent = moncycle_store.error_pick(failure, t_map("auth.reset_errors")) || moncycle_store.error_text(failure);
				// a captcha that was refused is not asked again with the same answer
				if (code === "captcha_invalid" || code === "captcha_expired") reset_captcha.reload(true);
			}
		}, listen);

		// The address of the link in a mail. A "+" that reaches the page as itself (a mail reader or a link checker that
		// decodes %2B) is read as a space by URLSearchParams, and an address never holds a space: it is a "+".
		const login_email = new URLSearchParams(location.search).get("login_email");
		by_id(root, "i_login_email").value = login_email === null ? "" : login_email.trim().replace(/ /g, "+");
		// the two public demo accounts
		for (const [id, email] of [["but_demo_mucus", "demo.bl@moncycle.app"], ["but_demo_fc", "demo.fc@moncycle.app"]]) {
			by_id(root, id).addEventListener("click", (event) => {
				event.preventDefault();
				by_id(root, "i_login_email").value = email;
				by_id(root, "i_password").value = "demo";
				form.requestSubmit();
			}, listen);
		}
	},

	unmount() { },
};
