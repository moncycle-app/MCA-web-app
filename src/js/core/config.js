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

/* Where the API is. config.json (next to the pages) holds one value, apiUrl: the base URL of the contract, one of the `servers` of
** the OpenAPI file ("/api/v2" for the API of the same site, "https://tableau.moncycle.app/api/v2" for another one). Every call of
** the web app is built with api_url("/token"), api_url("/day/2026-03-10")...: the paths of the contract.
**
** A page's own code waits for the file: `await moncycle_config.ready` at the top of the page's module (jQuery's ready does not wait: it fires
** as soon as the deferred scripts have run, which can be before the modules are loaded).
** An API on another origin ("remote") gets no cookie: the token of the sign-in is kept here and sent as `Authorization: Bearer`.
*/
export const moncycle_config = {
	default_api_url : "/api/v2",
	token_key : "auth_token",
	api_base : "/api/v2",
	remote : false,
	ready : null,

	// the base URL checked: https or http link, or a path, ending in a version of the contract (/v2); else null
	parse_api_url : function (value) {
		if (typeof value !== "string") return null;
		let base = value.trim().replace(/\/+$/, "");
		if (!/^(https?:\/\/[^\/?#]+)?(\/[^?#]*)?\/v\d+$/.test(base)) return null;
		return base;
	},
	api_url : function (path) {
		return moncycle_config.api_base + path;
	},
	set_api_url : function (value) {
		let base = moncycle_config.parse_api_url(value);
		if (base === null) {
			console.warn("config.json: apiUrl is missing or not a link ending in /vN, using " + moncycle_config.default_api_url);
			base = moncycle_config.default_api_url;
		}
		moncycle_config.api_base = base;
		moncycle_config.remote = new URL(base, window.location.href).origin !== window.location.origin;
	},
	// the call is for the API (and not for some other server)
	is_api_call : function (url) {
		return new URL(url, window.location.href).href.startsWith(new URL(moncycle_config.api_base, window.location.href).href + "/");
	},

	// the token of a remote API, in localStorage but outside the copy (data_*): an update of the app drops the copy, not the session
	token : function () {
		try { return localStorage.getItem(moncycle_config.token_key); } catch (e) { return null; }
	},
	set_token : function (token) {
		try { localStorage.setItem(moncycle_config.token_key, token); } catch (e) { console.error(e); }
	},
	// the headers a call of the API carries
	headers : function () {
		let token = moncycle_config.remote ? moncycle_config.token() : null;
		return token ? {"Authorization" : "Bearer " + token} : {};
	},
	// fetch() for the API: the cookie goes along on the same origin, the token on another
	fetch : function (url, options) {
		return fetch(url, Object.assign({}, options, {
			credentials : moncycle_config.remote ? "omit" : "same-origin",
			headers : Object.assign({}, (options || {}).headers, moncycle_config.headers()),
		}));
	},

	// the pages name the API as "api/v2/..." in the action of a form and the link of a download (what a browser without script would
	// use): they are pointed at the configured API once, so that the script reads the right address from the form
	point_pages : function (root = document) {
		root.querySelectorAll('form[action^="api/v"], a[href^="api/v"]').forEach(function (element) {
			let name = element.tagName === "FORM" ? "action" : "href";
			element.setAttribute(name, moncycle_config.api_url(element.getAttribute(name).replace(/^api\/v\d+/, "")));
		});
	},

	load : function () {
		return fetch("/config.json", {cache : "no-store", credentials : "omit"})
			.then(function (response) { return response.ok ? response.json() : Promise.reject(new Error("HTTP " + response.status)); })
			.then(function (config) { moncycle_config.set_api_url((config || {}).apiUrl); })
			.catch(function (e) {
				console.warn("config.json not read (" + e.message + "), using " + moncycle_config.default_api_url);
				moncycle_config.set_api_url(moncycle_config.default_api_url);
			});
	},
};

const $ = globalThis.$;   // jQuery is a classic script, loaded before the modules; the tests have none
if ($) {
	moncycle_config.ready = moncycle_config.load();
	$.ajaxPrefilter(function (options, original, jqXHR) {
		if (moncycle_config.remote && moncycle_config.is_api_call(options.url)) {
			let headers = moncycle_config.headers();
			Object.keys(headers).forEach(function (name) { jqXHR.setRequestHeader(name, headers[name]); });
		}
	});
}
