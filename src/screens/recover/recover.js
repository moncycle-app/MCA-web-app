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

/* The lost-password screen: the form carries the data, the script submits it. The sign-in screen links here with ?login_email= when the
** visitor already typed the address. The server answers the same whether the account exists or not (`sent`). */
import { moncycle_store } from "../../js/model/store.js";
import { moncycle_captcha } from "../../js/services/captcha.js";
import { api } from "../../js/core/api.js";
import { field } from "../../js/core/dom.js";
import { attach_terms_link } from "../../js/core/public_footer.js";
import { t, t_node, t_map, attach_language_select } from "../../js/core/i18n.js";
import { has_session } from "../../js/core/router.js";

const by_id = (root, id) => root.querySelector("#" + id);

export const screen = {
	name: "recover",
	path: "/recover",
	auth: false,
	html: "screens/recover/recover.html",
	title: () => t("recover.page_title"),
	redirect: () => (has_session() ? "/" : null),

	mount(root, ctx) {
		const listen = {signal: ctx.signal};
		attach_terms_link(root, ctx.signal);
		attach_language_select({root, select: by_id(root, "i_language"), signal: ctx.signal, after: () => { document.title = screen.title(); }});

		const form = by_id(root, "reset_form");
		const email_input = by_id(root, "r_login_email");
		const error = by_id(root, "reset_error_msg");
		const button = by_id(root, "reset_but");
		// this one is always asked for
		const captcha = moncycle_captcha.attach({
			purpose: "recover",
			email: email_input,
			image: by_id(root, "rc_captcha_img"),
			token: by_id(root, "rc_captcha_token"),
			answer: by_id(root, "rc_captcha"),
			error: moncycle_captcha.message_in(error),
			signal: ctx.signal,
		});

		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			button.disabled = true;
			button.value = t("recover.but_busy");
			error.textContent = "";
			const email = field(form, "login_email");
			try {
				const ret = await api("POST", "/recover_password", {email: email, captcha: field(form, "captcha"), captchaToken: field(form, "captchaToken")});
				button.value = t("recover.but");
				button.disabled = false;
				if (ret.data && ret.data.sent) {
					form.hidden = true;
					// the address is what was typed: a text node, never HTML
					const bold = document.createElement("b");
					bold.textContent = email;
					by_id(root, "password_reseted_msg").replaceChildren(t_node("recover.sent", {br: document.createElement("br"), email: bold}));
				}
			}
			catch (failure) {
				button.value = t("recover.but");
				button.disabled = false;
				console.error(failure);
				const code = ((failure.responseJSON || {}).error || {}).code;
				error.textContent = moncycle_store.error_pick(failure, t_map("recover.errors")) || moncycle_store.error_text(failure);
				// a captcha that was refused is not asked again with the same answer
				if (code === "captcha_invalid" || code === "captcha_expired") captcha.reload(true);
			}
		}, listen);

		// same reading of the address as the sign-in's: a "+" turned into a space by a mail reader is a "+"
		const login_email = ctx.query.get("login_email");
		if (login_email !== null) {
			email_input.value = login_email.trim().replace(/ /g, "+");
			captcha.reload(false);
		}
	},

	unmount() { },
};
