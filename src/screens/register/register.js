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

/* The sign-up screen: the form carries the data (the language too), the script submits it. */
import { moncycle_store } from "/js/model/store.js";
import { moncycle_captcha } from "/js/services/captcha.js";
import { api } from "/js/core/api.js";
import { field, checked, el } from "/js/core/dom.js";
import { t, t_map } from "/js/core/i18n.js";
import { has_session } from "/js/core/router.js";

const by_id = (root, id) => root.querySelector("#" + id);

export const screen = {
	name: "register",
	path: "/register",
	auth: false,
	html: "/screens/register/register.html",
	title: () => t("register.page_title"),
	// Someone on a demo account can sign up: they stay here, and what the browser keeps of the demo goes (its session ends on the
	// server with the captcha this screen asks for, which replaces its cookie).
	redirect: () => (has_session() && !moncycle_store.is_demo(localStorage.auth) ? "/" : null),

	mount(root, ctx) {
		const listen = {signal: ctx.signal};
		moncycle_store.clear_storage();
		// 5-year bands, the youngest ending 19 years back: someone born then is 18 or more whatever their birthday, so no band holds a minor
		const year = new Date().getFullYear();
		const bands = [];
		for (let first = year - 23; first >= year - 100; first -= 5) {
			bands.unshift(el("option", {value: first, text: t("register.birth_band", {from: first, to: first + 4})}));
		}
		by_id(root, "i_anaissance").append(...bands);

		// the terms of service are a page of the server's choice (TERMS_OF_SERVICE_URL, told by server_info): shown here in a frame, and in a tab of
		// their own from the link below it. None told: no frame and no link, the box stays.
		api("GET", "/server_info", undefined, {signal: ctx.signal}).then((ret) => {
			const data = (ret || {}).data || {};
			if (data.passwordPolicyRegex) for (const id of ["i_password", "i_password_conf"]) by_id(root, id).setAttribute("pattern", data.passwordPolicyRegex);
			if (!/^https:\/\//i.test(data.termsOfServiceUrl || "")) return;
			const frame = by_id(root, "f_terms");
			frame.setAttribute("src", data.termsOfServiceUrl);
			frame.hidden = false;
			const link = by_id(root, "a_terms");
			link.setAttribute("href", data.termsOfServiceUrl);
			link.hidden = false;
		}, () => {
			by_id(root, "terms_error_msg").textContent = t("register.terms_unavailable");
		});

		const error = by_id(root, "register_error_msg");
		// the picture and its token are asked for once the address is typed (a click on the picture asks for another)
		const register_captcha = moncycle_captcha.attach({
			purpose: "register",
			email: by_id(root, "i_login_email"),
			image: by_id(root, "r_captcha"),
			token: by_id(root, "i_captcha_token"),
			answer: by_id(root, "i_captcha"),
			error: moncycle_captcha.message_in(error),
			signal: ctx.signal,
		});

		const form = by_id(root, "f_registration");
		const button = by_id(root, "but_register");
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			error.textContent = "";
			if (field(form, "login_email") != field(form, "login_email_conf")) { error.textContent = t("register.email_mismatch"); return; }
			if (field(form, "password") != field(form, "password_conf")) { error.textContent = t("register.password_mismatch"); return; }
			button.disabled = true;
			button.value = t("register.but_submit_busy");
			const payload = {
				nickname: field(form, "nickname"),
				email: field(form, "login_email"),
				password: field(form, "password"),
				birthYear: parseInt(field(form, "birth_year")),
				language: field(form, "language"),
				captcha: field(form, "captcha"),
				captchaToken: field(form, "captchaToken"),
				method: field(form, "method"),
				temperatureTracking: checked(form, "temperature_tracking"),
				discoveredComment: field(form, "discovered_comment"),
				termsAccepted: checked(form, "terms_accepted"),
			};
			try {
				const ret = await api("POST", "/register", payload);
				// the answer is the same for a new address and for one that has an account: the page says only what is sure
				by_id(root, "success_email").textContent = field(form, "login_email");
				by_id(root, "i_password").value = "";
				by_id(root, "i_password_conf").value = "";
				by_id(root, "register_form").hidden = true;
				by_id(root, "register_ok").hidden = false;
				if (!ret.data.sent) error.textContent = t("register.mail_not_sent");
			}
			catch (failure) {
				console.error(failure);
				const code = ((failure.responseJSON || {}).error || {}).code;
				error.textContent = moncycle_store.error_pick(failure, t_map("register.errors")) || moncycle_store.error_text(failure);
				button.disabled = false;
				button.value = t("register.but_submit");
				// a captcha that was refused is not asked again with the same answer
				if (code === "captcha_invalid" || code === "captcha_expired") register_captcha.reload(true);
			}
		}, listen);
	},

	unmount() { },
};
