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
import { t, t_node, t_map, ready as i18n_ready } from "/js/core/i18n.js";

const $ = globalThis.$;

await Promise.all([moncycle_config.ready, i18n_ready]);

// The sign-in page (auth.html), as a file of its own: the CSP is script-src 'self', so no inline script.

window.addEventListener("storage", function () {
	if (parseInt(localStorage.auth)>0) {
		window.location.replace('..');
	}
}, false);
if (parseInt(localStorage.auth)>0) {
	window.location.replace('..');
}
else {
	moncycle_store.clear_storage();
	$(document).ready(function(){
		// the sign-in asks for a captcha once the account has failed too often (the server says so with captchaRequired); the
		// token is tied to the account's counters, so a new one is made after every refused attempt
		const login_captcha = moncycle_captcha.attach({
			purpose: "login",
			email: $("#i_login_email"),
			image: $("#l_captcha"),
			token: $("#i_captcha_token"),
			answer: $("#i_captcha"),
			active: function() { return $("#captcha_wrapper").is(":visible"); },
			error: moncycle_captcha.message_in($("#message_err")),
		});
		// the lost password always asks for one
		const reset_captcha = moncycle_captcha.attach({
			purpose: "recover",
			email: $("#r_login_email"),
			image: $("#rc_captcha_img"),
			token: $("#rc_captcha_token"),
			answer: $("#rc_captcha"),
			error: moncycle_captcha.message_in($("#reset_error_msg")),
		});
		// the link to the terms of service is the server's (TERMS_OF_SERVICE_URL, told by server_info): none told, no link
		$.ajax({type : "GET", url : moncycle_config.api_url("/server_info"), dataType : "json"}).done(function(ret) {
			const url = ((ret || {}).data || {}).termsOfServiceUrl;
			if (/^https:\/\//i.test(url || "")) $("#a_terms").attr("href", url).prop("hidden", false);
		});
		// another origin than the API's gets no cookie: the sign-in asks for the token alone and the script keeps it
		if (moncycle_config.remote) $("#i_token_cookie").val("false");
		// the session is named after the site it was opened on, as the browser knows it
		$("#i_token_name").val("WEB-APP " + window.location.hostname);
		$("#connexion_form").on("submit", function(event) {
			event.preventDefault();
			$("#connexion_but").prop("disabled", true);
			$("#connexion_but").val(t("auth.but_connect_busy"));
			var payload = {
				email: $("#i_login_email").val(),
				password: $("#i_password").val(),
				name: $("#i_token_name").val(),
				cookie: $("#i_token_cookie").val() === "true",
			};
			if ($("#i_code").val()) payload.code = $("#i_code").val();
			if ($("#captcha_wrapper").is(":visible")) {
				payload.captcha = $("#i_captcha").val();
				payload.captchaToken = $("#i_captcha_token").val();
			}
			$.ajax({
				type: "POST",
				url: moncycle_config.api_url("/token"),
				contentType: "application/json",
				data: JSON.stringify(payload),
			}).done(function(ret){
				console.log(ret);
				if (moncycle_config.remote) moncycle_config.set_token(ret.data.token);
				localStorage.auth = ret.data.userId;
				window.location.replace('..');
			}).fail(function(jqXHR){
				$("#connexion_but").prop("disabled", false);
				$("#connexion_but").val(t("auth.but_connect"));
				var err = (jqXHR.responseJSON || {}).error || {};
				const return_codes = t_map("auth.signin_errors");
				if ((err.details || {}).captchaRequired) $("#captcha_wrapper").show();
				$("#message_err").empty().append(document.createTextNode(moncycle_store.error_pick(jqXHR, return_codes) || moncycle_store.error_text(jqXHR)), $("<br>"));

				// the token is tied to the account's counters, which this attempt may have moved: a new one, whenever the
				// captcha is shown (and the first one, when this answer is the one that asks for it)
				login_captcha.reload(true);
			});
		});
		$("#reset_form").on("submit", function(event) {
			event.preventDefault();
			$("#reset_but").prop("disabled", true);
			$("#reset_but").val(t("auth.but_reset_busy"));
			$("#reset_error_msg").text("");
			var email = $("#r_login_email").val();
			$.ajax({
				type: "POST",
				url: moncycle_config.api_url("/recover_password"),
				contentType: "application/json",
				data: JSON.stringify({email: email, captcha: $("#rc_captcha").val(), captchaToken: $("#rc_captcha_token").val()}),
			}).done(function(ret){
				console.log(ret);
				$("#reset_but").val(t("auth.but_reset"));
				$("#reset_but").prop("disabled", false);
				if (ret.data && ret.data.sent) {
					$("#reset_form").hide();
					// the address is what was typed: a text node, never HTML
						$("#password_reseted_msg").empty().append(t_node("auth.reset_sent", {br: document.createElement("br"), email: $("<b>").text(email)[0]}));
				}
			}).fail(function(jqXHR){
				$("#reset_but").val(t("auth.but_reset"));
				$("#reset_but").prop("disabled", false);
				console.error(jqXHR);
				var err = (jqXHR.responseJSON || {}).error || {};
				const return_codes = t_map("auth.reset_errors");
				$("#reset_error_msg").text(moncycle_store.error_pick(jqXHR, return_codes) || moncycle_store.error_text(jqXHR));
				// a captcha that was refused is not asked again with the same answer
				if (err.code === "captcha_invalid" || err.code === "captcha_expired") reset_captcha.reload(true);
			});
		});
		// The address of the link in a mail. A "+" that reaches the page as itself (a mail reader or a link checker that
		// decodes %2B) is read as a space by URLSearchParams, and an address never holds a space: it is a "+".
		const login_email = (new URLSearchParams(window.location.search)).get("login_email");
		$("#i_login_email").val(login_email === null ? "" : login_email.trim().replace(/ /g, "+"));
		$("#but_demo_mucus").on("click", function(event) {
			event.preventDefault();
			$("#i_login_email").val("demo.bl@moncycle.app");
			$("#i_password").val("demo");
			$("#connexion_form").submit();
		});
		$("#but_demo_fc").on("click", function(event) {
			event.preventDefault();
			$("#i_login_email").val("demo.fc@moncycle.app");
			$("#i_password").val("demo");
			$("#connexion_form").submit();
		});
	});
}
