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

/* One page, several screens. The routes are real paths (History API; the server answers index.html for them):
**   /  the timeline   /auth   /register   /verify_email   /settings (its panels are in the hash: /settings#notifications)
** A screen is a module that exports `screen`: {name, path, auth, html, mount(root, ctx), unmount(), on_hash(hash), redirect(), title()}.
** The router fetches its markup once, puts it in <main id="app">, fills it from the catalog and calls mount(); a screen's listeners all use
** ctx.signal, which is aborted when the screen goes away. The old addresses (/auth.html) are written back without .html.
*/
import { moncycle_config } from "/js/core/config.js";
import { apply } from "/js/core/i18n.js";

const routes = {
	"/": () => import("/screens/timeline/timeline.js"),
	"/auth": () => import("/screens/auth/auth.js"),
	"/register": () => import("/screens/register/register.js"),
	"/verify_email": () => import("/screens/verify_email/verify_email.js"),
	"/settings": () => import("/screens/settings/settings.js"),
};
const markup = new Map();
let current = null;   // {screen, controller}
let token = 0;

export function normalise_path(pathname) {
	let path = pathname.replace(/\.html$/, "").replace(/\/index$/, "");
	if (path.length > 1) path = path.replace(/\/+$/, "");
	return path === "" ? "/" : path;
}
export function is_route(pathname) {
	return Object.prototype.hasOwnProperty.call(routes, normalise_path(pathname));
}
export function has_session() {
	return parseInt(localStorage.auth) > 0;
}

async function load_markup(screen) {
	if (!markup.has(screen.html)) {
		const response = await fetch(screen.html, {credentials: "omit"});
		markup.set(screen.html, response.ok ? await response.text() : "");
	}
	return markup.get(screen.html);
}

function leave() {
	if (!current) return;
	current.controller.abort();
	try { current.screen.unmount && current.screen.unmount(); } catch (e) { console.error(e); }
	current = null;
	document.getElementById("app").replaceChildren();
}

// Shows the screen of an address. `replace`: the address is written over the one in the history.
async function show(url, replace) {
	const mine = ++token;
	const path = normalise_path(url.pathname);
	if (!is_route(path)) return go("/", true);
	if (path !== url.pathname) history.replaceState(null, "", path + url.search + url.hash);
	const screen = (await routes[path]()).screen;
	if (mine !== token) return;
	if (screen.auth && !has_session()) return go("/auth", true);
	const elsewhere = screen.redirect && screen.redirect();
	if (elsewhere) return go(elsewhere, true);

	leave();
	const root = document.getElementById("app");
	root.dataset.screen = screen.name;
	root.innerHTML = await load_markup(screen);   // our own static markup, never data
	if (mine !== token) return;
	moncycle_config.point_pages(root);
	apply(root);
	document.title = screen.title ? screen.title() : document.title;
	const controller = new AbortController();
	current = {screen, controller};
	await screen.mount(root, {signal: controller.signal, url: new URL(location.href), navigate: go});
	window.scrollTo(0, 0);
}

// Goes to an address of the app (a path, with its query and hash).
export function go(address, replace = false) {
	const url = new URL(address, location.origin);
	if (replace) history.replaceState(null, "", url.pathname + url.search + url.hash);
	else if (url.pathname + url.search + url.hash !== location.pathname + location.search + location.hash) history.pushState(null, "", url.pathname + url.search + url.hash);
	return show(url, replace);
}

// A click on a link of the app is a change of screen; everything else (an export, another site, a modified click) is left to the browser.
function on_click(event) {
	if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	const link = event.target.closest && event.target.closest("a[href]");
	if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
	const url = new URL(link.href, location.href);
	if (url.origin !== location.origin || !is_route(url.pathname)) return;
	// the same screen with another hash (the panels of the settings): the browser changes the hash, and hashchange tells the screen
	if (normalise_path(url.pathname) === normalise_path(location.pathname) && url.search === location.search && url.hash !== "") return;
	event.preventDefault();
	go(url.pathname + url.search + url.hash);
}

export function start() {
	document.addEventListener("click", on_click);
	window.addEventListener("popstate", () => show(new URL(location.href), true));
	window.addEventListener("hashchange", () => { if (current && current.screen.on_hash) current.screen.on_hash(location.hash); });
	return show(new URL(location.href), true);
}
