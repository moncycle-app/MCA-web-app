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
import { moncycle_captcha } from "/js/captcha.js";
import { t, t_map, ready as i18n_ready } from "/js/core/i18n.js";

const $ = globalThis.$;

await Promise.all([moncycle_config.ready, i18n_ready]);

// The sign-up page (register.html), as a file of its own: the CSP is script-src 'self', so no inline script.

// Someone on a demo account can sign up: they stay on this page, and what the browser keeps of the demo goes (its
// session ends on the server with the captcha this page asks for, which replaces its cookie).
if (parseInt(localStorage.auth)>0 && !moncycle_store.is_demo(localStorage.auth)) {
	window.location.replace('..');
}
else {
	moncycle_store.clear_storage();
	$(document).ready(function(){
		// 5-year bands, the youngest ending 19 years back: someone born then is 18 or more whatever their birthday, so no band holds a minor
		const year = new Date().getFullYear();
		let bands = [];
		for (let yy = year-23; yy >= year-100; yy-=5) {
			bands.unshift($("<option>", {value: yy}).text(t("register.birth_band", {from: yy, to: yy+4}))[0]);
		}
		$("#i_anaissance").append(bands);
		// the terms of service are a page of the server's choice (TERMS_OF_SERVICE_URL, told by server_info): shown here in a frame, and in a tab of
		// their own from the link below it. None told: no frame and no link, the box stays.
		$.ajax({type : "GET", url : moncycle_config.api_url("/server_info"), dataType : "json"}).done(function(ret) {
			const policy = ((ret || {}).data || {}).passwordPolicyRegex;
			if (policy) $("#i_password, #i_password_conf").attr("pattern", policy);
			const url = ((ret || {}).data || {}).termsOfServiceUrl;
			if (!/^https:\/\//i.test(url || "")) return;
			$("#f_terms").attr("src", url).prop("hidden", false);
			$("#a_terms").attr("href", url).prop("hidden", false);
		}).fail(function() {
			$("#terms_error_msg").text(t("register.terms_unavailable"));
		});
		// the picture and its token are asked for once the address is typed (a click on the picture asks for another)
		const register_captcha = moncycle_captcha.attach({
			purpose: "register",
			email: $("#i_login_email"),
			image: $("#r_captcha"),
			token: $("#i_captcha_token"),
			answer: $("#i_captcha"),
			error: moncycle_captcha.message_in($("#register_error_msg")),
		});
		$("#f_registration").on("submit", function(event) {
			event.preventDefault();
			$("#register_error_msg").text("");
			if ($("#i_login_email").val() != $("#i_login_email_conf").val()) {
				$("#register_error_msg").text(t("register.email_mismatch"));
				return;
			}
			if ($("#i_password").val() != $("#i_password_conf").val()) {
				$("#register_error_msg").text(t("register.password_mismatch"));
				return;
			}
			$("#but_register").prop("disabled", true);
			$("#but_register").val(t("register.but_submit_busy"));
			let reactivate_form = function() {
				$("#but_register").prop("disabled", false);
				$("#but_register").val(t("register.but_submit"));
			}
			var payload = {
				nickname: $("#i_nickname").val(),
				email: $("#i_login_email").val(),
				password: $("#i_password").val(),
				birthYear: parseInt($("#i_anaissance").val()),
				language: $("#i_language").val(),
				captcha: $("#i_captcha").val(),
				captchaToken: $("#i_captcha_token").val(),
				method: $('input[name="method"]:checked').val(),
				temperatureTracking: $("#m_temp").is(':checked'),
				discoveredComment: $("#i_comment").val(),
				termsAccepted: $("#i_terms").is(':checked'),
			};
			$.ajax({type : 'POST', "url" : moncycle_config.api_url("/register"), contentType: "application/json", "data" : JSON.stringify(payload)}).done(function(ret){
				console.log(ret);
				// the answer is the same for a new address and for one that has an account: the page says only what is sure
				$("#success_email").text($("#i_login_email").val());
				$("#i_password, #i_password_conf").val("");
				$("#register_form").hide();
				$("#register_ok").show();
				if (!ret.data.sent) {
					$("#register_error_msg").text(t("register.mail_not_sent"));
				}
			}).fail(function(jqXHR) {
				console.error(jqXHR);
				var err = (jqXHR.responseJSON || {}).error || {};
				const return_codes = t_map("register.errors");
				$("#register_error_msg").text(moncycle_store.error_pick(jqXHR, return_codes) || moncycle_store.error_text(jqXHR));
				reactivate_form();
				// a captcha that was refused is not asked again with the same answer
				if (err.code === "captcha_invalid" || err.code === "captcha_expired") register_captcha.reload(true);
			});
		});
	});
}
