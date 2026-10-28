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
import { settings_api, settings_confirmed_change, settings_error, settings_form_say, settings_is_checked, settings_read, settings_say, settings_state } from "/screens/settings/common.js";

const $ = globalThis.$;

/* ===========================================================================
** 5e. CONNEXION ET SÉCURITÉ: login address, password, double authentication
** ======================================================================== */

export function settings_fill_connexion(account) {
	$("#login_email_shown").text(account.loginEmail);
	$("#i_token_new_email").val(account.loginEmail);
	settings_show_totp_state(account.totpState == "active");
}

// the login address changes by a link sent to the NEW one: the change happens when it is used (verify_email.html)
export function settings_setup_login_email() {
	const form = $("#form_login_email");
	settings_confirmed_change(form, function () {
		const payload = {loginEmail: settings_read(form, "new_login_email"), password: settings_read(form, "password")};
		const code = settings_read(form, "code");
		if (code) payload.code = code;
		return payload;
	}, function (ret) {
		form.find("[type=password], [type=number]").val("");
		if ((ret.meta || {}).loginEmailLinkSent) {
			form.find("[name=new_login_email]").val("");
			settings_form_say(form, "ok", t("settings.email_link_sent"));
		}
		else {
			settings_form_say(form, "error", t("settings.email_link_not_sent"));
		}
	});
}

export function settings_setup_password() {
	const form = $("#form_mdp_change");
	settings_confirmed_change(form, function () {
		return {password: settings_read(form, "old_pw"), newPassword: settings_read(form, "pw1"), logoutOtherDevices: settings_is_checked(form, "logout_other_devices")};
	}, function () {
		form.find("[type=password]").val("");
		form.find("[name=logout_other_devices]").prop("checked", false);
		settings_form_say(form, "ok", t("settings.password_changed"));
	}, function () {
		// the confirmation is checked here, before anything is sent
		return settings_read(form, "pw1") == settings_read(form, "pw2") ? "" : t("settings.password_mismatch");
	});
}

/* --- the double authentication (TOTP): off -> set-up (QR code, then a code and the password) -> on -> off ---- */

export function settings_show_totp_state(active) {
	$("#totp_explications").prop("hidden", active);
	$("#totp_miseenpalce").prop("hidden", true);
	$("#totp_state").prop("hidden", !active);
	// the forms that sign in again ask for the code only when the account has one
	$("#login_email_code_field, #token_new_code_wrapper, #deletion_code_field").prop("hidden", !active);
}

export function settings_setup_totp() {
	const error_line = $("#totp_err_msg");
	let secret = "";

	$("#f_totp_start").on("submit", function (event) {
		event.preventDefault();
		const button = $("#i_activate_otp").prop("disabled", true);
		error_line.empty();
		settings_api("POST", $(this).attr("action")).done(function (ret) {
			secret = ret.data.initSecret;
			$("#totp_explications").prop("hidden", true);
			$("#totp_miseenpalce").prop("hidden", false);
			$("#totp_auto_conf").attr("href", ret.data.otpauth);
			// the QR code is an image the server draws, not text a user stored
			$("#totp_qrcode").html(ret.data.qrcode);
			$("#totp_copy_secret_ok").text("");
		}).fail(function (jqXHR) {
			settings_say(error_line, "error", settings_error(jqXHR));
		}).always(function () {
			button.prop("disabled", false);
		});
	});

	$("#totp_copy_secret").on("click", function () {
		navigator.clipboard.writeText(secret).then(function () {
			$("#totp_copy_secret_ok").text(t("settings.token_copied"));
		}, function () {
			$("#totp_copy_secret_ok").text(t("settings.totp_copy_failed"));
		});
	});

	// the code the application shows, and the password, confirm the set-up
	$("#f_totp_validation").on("submit", function (event) {
		event.preventDefault();
		const form = $(this);
		const body = {code: settings_read(form, "tmp_code"), password: settings_read(form, "password")};
		error_line.empty();
		form[0].reset();
		settings_api("POST", form.attr("action"), body).done(function (ret) {
			if (ret.data.totpState == "active") {
				settings_state.account.totpState = "active";
				settings_show_totp_state(true);
			}
		}).fail(function (jqXHR) {
			settings_say(error_line, "error", settings_error(jqXHR));
		});
	});

	$("#f_totp_desac").on("submit", function (event) {
		event.preventDefault();
		const form = $(this);
		const body = {code: settings_read(form, "tmp_code")};
		error_line.empty();
		form[0].reset();
		settings_api("POST", form.attr("action"), body).done(function (ret) {
			if (ret.data.totpState == "disabled") {
				settings_state.account.totpState = "disabled";
				settings_show_totp_state(false);
			}
		}).fail(function (jqXHR) {
			settings_say(error_line, "error", settings_error(jqXHR));
		});
	});
}
