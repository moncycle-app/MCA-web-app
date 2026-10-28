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

/* The screen of the link in a mail. The address holds the purpose and the token in its fragment ("#purpose=resetPassword&t=..."): a fragment is
** never sent to a server, written in a log or given as a Referer, and a mail scanner that only fetches the link does not run this script, so
** it uses nothing up. The fragment is read once and then taken off the address; the form carries the purpose and the token (hidden fields) and
** is what is sent to POST /api/v2/verify_email.
*/
import { moncycle_store } from "/js/model/store.js";
import { api } from "/js/core/api.js";
import { field } from "/js/core/dom.js";
import { t, t_map } from "/js/core/i18n.js";

const by_id = (root, id) => root.querySelector("#" + id);

// the texts of each purpose are in the catalog: verify_email.page.<purpose>.title, text, button, done
const purposes = {accountCreation: {}, resetPassword: {password: true}, changeEmail: {}};
const text_of = (purpose, part) => t("verify_email.page." + purpose + "." + part);

export const screen = {
	name: "verify_email",
	path: "/verify_email",
	auth: false,
	html: "/screens/verify_email/verify_email.html",
	title: () => t("verify_email.page_title"),

	mount(root, ctx) {
		// the password policy is a setting of the server (PASSWORD_POLICY_REGEX, told by server_info); the server checks it again
		api("GET", "/server_info", undefined, {signal: ctx.signal}).then((ret) => {
			const policy = ((ret || {}).data || {}).passwordPolicyRegex;
			if (policy) for (const id of ["i_new_password", "i_new_password_conf"]) by_id(root, id).setAttribute("pattern", policy);
		}, () => { });

		const fragment = new URLSearchParams(location.hash.slice(1));
		history.replaceState(null, "", location.pathname + location.search);
		const purpose = fragment.get("purpose");
		const page = Object.prototype.hasOwnProperty.call(purposes, purpose) ? purposes[purpose] : null;
		if (page === null || !fragment.get("t")) {
			by_id(root, "et_invalid").hidden = false;
			return;
		}

		by_id(root, "i_purpose").value = purpose;
		by_id(root, "i_token").value = fragment.get("t");
		by_id(root, "et_title").textContent = text_of(purpose, "title");
		by_id(root, "et_text").textContent = text_of(purpose, "text");
		by_id(root, "but_et").value = text_of(purpose, "button");
		if (page.password) {
			by_id(root, "et_password_block").hidden = false;
			for (const id of ["i_new_password", "i_new_password_conf"]) by_id(root, id).required = true;
		}
		by_id(root, "et_form_box").hidden = false;

		const form = by_id(root, "f_verify_email");
		const error = by_id(root, "et_error_msg");
		const button = by_id(root, "but_et");
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			error.textContent = "";
			if (page.password && field(form, "new_password") != field(form, "new_password_conf")) {
				error.textContent = t("verify_email.password_mismatch");
				return;
			}
			button.disabled = true;
			const payload = {purpose: field(form, "purpose"), token: field(form, "token")};
			if (page.password) payload.newPassword = field(form, "new_password");
			try {
				const ret = await api("POST", "/verify_email", payload);
				for (const id of ["i_new_password", "i_new_password_conf", "i_token"]) by_id(root, id).value = "";
				by_id(root, "et_form_box").hidden = true;
				by_id(root, "et_done_text").textContent = text_of(purpose, "done");
				// the address to sign in with, as the server knows it now
				by_id(root, "et_login_link").setAttribute("href", "/auth?login_email=" + encodeURIComponent(ret.data.loginEmail));
				by_id(root, "et_done").hidden = false;
			}
			catch (failure) {
				console.error(failure);
				button.disabled = false;
				error.textContent = moncycle_store.error_pick(failure, t_map("verify_email.errors")) || moncycle_store.error_text(failure);
			}
		}, {signal: ctx.signal});
	},

	unmount() { },
};
