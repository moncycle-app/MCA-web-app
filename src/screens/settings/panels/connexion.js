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
import { t } from "/js/core/i18n.js";
import { by_id } from "/js/core/dom.js";
import { settings_api, settings_confirmed_change, settings_error, settings_form_say, settings_is_checked, settings_read, settings_say, settings_state } from "/screens/settings/common.js";

/* ===========================================================================
** 5e. CONNEXION ET SÉCURITÉ: login address, password, double authentication
** ======================================================================== */

export function settings_fill_connexion(account) {
	by_id("login_email_shown").textContent = account.loginEmail;
	by_id("i_token_new_email").value = account.loginEmail ?? "";
	settings_show_totp_state(account.totpState == "active");
}

// the login address changes by a link sent to the NEW one: the change happens when it is used (the verify_email screen)
export function settings_setup_login_email() {
	const form = by_id("form_login_email");
	settings_confirmed_change(form, function () {
		const payload = {loginEmail: settings_read(form, "new_login_email"), password: settings_read(form, "password")};
		const code = settings_read(form, "code");
		if (code) payload.code = code;
		return payload;
	}, function (ret) {
		form.querySelectorAll("[type=password], [type=number]").forEach(function (input) { input.value = ""; });
		if ((ret.meta || {}).loginEmailLinkSent) {
			form.elements["new_login_email"].value = "";
			settings_form_say(form, "ok", t("settings.email_link_sent"));
		}
		else {
			settings_form_say(form, "error", t("settings.email_link_not_sent"));
		}
	});
}

export function settings_setup_password() {
	const form = by_id("form_mdp_change");
	settings_confirmed_change(form, function () {
		return {password: settings_read(form, "old_pw"), newPassword: settings_read(form, "pw1"), logoutOtherDevices: settings_is_checked(form, "logout_other_devices")};
	}, function () {
		form.querySelectorAll("[type=password]").forEach(function (input) { input.value = ""; });
		form.elements["logout_other_devices"].checked = false;
		settings_form_say(form, "ok", t("settings.password_changed"));
	}, function () {
		// the confirmation is checked here, before anything is sent
		return settings_read(form, "pw1") == settings_read(form, "pw2") ? "" : t("settings.password_mismatch");
	});
}

/* --- the double authentication (TOTP): off -> set-up (QR code, then a code and the password) -> on -> off ---- */

export function settings_show_totp_state(active) {
	by_id("totp_explications").hidden = active;
	by_id("totp_miseenpalce").hidden = true;
	by_id("totp_state").hidden = !active;
	// the forms that sign in again ask for the code only when the account has one
	["login_email_code_field", "token_new_code_wrapper", "deletion_code_field"].forEach(function (id) { by_id(id).hidden = !active; });
}

export function settings_setup_totp() {
	const error_line = by_id("totp_err_msg");
	let secret = "";

	by_id("f_totp_start").addEventListener("submit", function (event) {
		event.preventDefault();
		const button = by_id("i_activate_otp");
		button.disabled = true;
		error_line.replaceChildren();
		settings_api("POST", event.currentTarget.getAttribute("action")).then(function (ret) {
			secret = ret.data.initSecret;
			by_id("totp_explications").hidden = true;
			by_id("totp_miseenpalce").hidden = false;
			by_id("totp_auto_conf").setAttribute("href", ret.data.otpauth);
			// the QR code is a picture the server draws (an SVG document): shown as an image, so that nothing in it is ever run
			const picture = document.createElement("img");
			picture.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ret.data.qrcode);
			picture.alt = t("settings.totp_qr_alt");
			by_id("totp_qrcode").replaceChildren(picture);
			by_id("totp_copy_secret_ok").textContent = "";
		}, function (failure) {
			settings_say(error_line, "error", settings_error(failure));
		}).finally(function () {
			button.disabled = false;
		});
	});

	by_id("totp_copy_secret").addEventListener("click", function () {
		navigator.clipboard.writeText(secret).then(function () {
			by_id("totp_copy_secret_ok").textContent = t("settings.token_copied");
		}, function () {
			by_id("totp_copy_secret_ok").textContent = t("settings.totp_copy_failed");
		});
	});

	// the code the application shows, and the password, confirm the set-up
	by_id("f_totp_validation").addEventListener("submit", function (event) {
		event.preventDefault();
		const form = event.currentTarget;
		const body = {code: settings_read(form, "tmp_code"), password: settings_read(form, "password")};
		error_line.replaceChildren();
		form.reset();
		settings_api("POST", form.getAttribute("action"), body).then(function (ret) {
			if (ret.data.totpState == "active") {
				settings_state.account.totpState = "active";
				settings_show_totp_state(true);
			}
		}, function (failure) {
			settings_say(error_line, "error", settings_error(failure));
		});
	});

	by_id("f_totp_desac").addEventListener("submit", function (event) {
		event.preventDefault();
		const form = event.currentTarget;
		const body = {code: settings_read(form, "tmp_code")};
		error_line.replaceChildren();
		form.reset();
		settings_api("POST", form.getAttribute("action"), body).then(function (ret) {
			if (ret.data.totpState == "disabled") {
				settings_state.account.totpState = "disabled";
				settings_show_totp_state(false);
			}
		}, function (failure) {
			settings_say(error_line, "error", settings_error(failure));
		});
	});
}
