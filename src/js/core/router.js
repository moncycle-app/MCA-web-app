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

/* One page, several screens. The routes live in the hash of the address, so that the folder works from any static host, in any directory,
** with no server setting (no rewrite, no fallback): index.html#/ the timeline, #/auth, #/register, #/recover, #/verify_email, #/settings, and a panel of
** the settings is one level deeper: #/settings/notifications. What follows a "?" in the hash is the query (#/auth?login_email=a@b.c).
** A screen is a module that exports `screen`: {name, path, auth, html, mount(root, ctx), unmount(), on_hash(sub), redirect(), title()}.
** The router fetches its markup once, puts it in <main id="app">, fills it from the catalog and calls mount(); a screen's listeners all use
** ctx.signal, which is aborted when the screen goes away. ctx.query is the query of the address, ctx.sub the part after the screen's path.
** Addresses given to go() and restart() are routes ("/auth", "/settings/notifications"), not paths of the server.
** An address of the first version (/auth, /auth.html, /settings#notifications, /verify_email#purpose=...&t=...) that a server still answers
** with index.html is written back as a route at the start.
*/
import { moncycle_config } from "./config.js";
import { apply } from "./i18n.js";

const routes = {
	"/": () => import("../../screens/timeline/timeline.js"),
	"/auth": () => import("../../screens/auth/auth.js"),
	"/recover": () => import("../../screens/recover/recover.js"),
	"/register": () => import("../../screens/register/register.js"),
	"/verify_email": () => import("../../screens/verify_email/verify_email.js"),
	"/settings": () => import("../../screens/settings/settings.js"),
};
const markup = new Map();
let current = null;   // {screen, controller, path}
let token = 0;

// "#/settings/notifications?a=b" (or a route without "#") -> {path: "/settings", sub: "notifications", query: URLSearchParams}
export function parse_route(hash) {
	const text = hash.replace(/^#/, "");
	const cut = text.indexOf("?");
	const segments = (cut < 0 ? text : text.slice(0, cut)).split("/").filter((segment) => segment !== "");
	return {
		path: "/" + (segments[0] || ""),
		sub: segments.slice(1).join("/"),
		query: new URLSearchParams(cut < 0 ? "" : text.slice(cut + 1)),
	};
}
export function is_route(path) {
	return Object.prototype.hasOwnProperty.call(routes, path === "/" ? "/" : path.replace(/\/+$/, ""));
}
export function has_session() {
	return parseInt(localStorage.auth) > 0;
}
// the hash of a route: "/auth" -> "#/auth", "/" -> "#/"
function hash_of(address) {
	return "#" + (address.startsWith("/") ? address : "/" + address);
}

// An address of the first version, answered with index.html by a server that falls back to it: /auth.html, /settings#notifications...
function upgrade_old_address() {
	if (location.hash.startsWith("#/")) return;
	const name = location.pathname.split("/").pop().replace(/\.html$/, "");
	if (name === "" || name === "index") return;
	const path = "/" + name;
	if (!is_route(path)) return;
	const fragment = location.hash.slice(1), search = location.search.slice(1);
	const address = path === "/verify_email" ? path + (fragment ? "?" + fragment : "") : path + (fragment ? "/" + fragment : "") + (search ? "?" + search : "");
	history.replaceState(null, "", location.pathname.replace(/[^\/]*$/, "") + hash_of(address));
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

// Shows the screen of the address in the bar.
async function show() {
	const mine = ++token;
	const route = parse_route(location.hash);
	if (!is_route(route.path)) return go("/", true);
	const screen = (await routes[route.path]()).screen;
	if (mine !== token) return;
	if (screen.auth && !has_session()) return go("/auth", true);
	const elsewhere = screen.redirect && screen.redirect();
	if (elsewhere) return go(elsewhere, true);

	leave();
	const root = document.getElementById("app");
	root.dataset.screen = screen.name;
	root.classList.toggle("public_screen", !screen.auth);   // the screens of someone not signed in share a layout (css/public.css)
	root.innerHTML = await load_markup(screen);   // our own static markup, never data
	if (mine !== token) return;
	moncycle_config.point_pages(root);
	apply(root);
	document.title = screen.title ? screen.title() : document.title;
	const controller = new AbortController();
	current = {screen, controller, path: route.path};
	await screen.mount(root, {signal: controller.signal, sub: route.sub, query: route.query, navigate: go});
	window.scrollTo(0, 0);
}

// Goes to a route. `replace`: it is written over the one in the history.
export function go(address, replace = false) {
	const hash = hash_of(address);
	if (replace) {
		history.replaceState(null, "", location.pathname + location.search + hash);
		return show();
	}
	if (hash === location.hash) return Promise.resolve();
	location.hash = hash;   // hashchange shows the screen
	return Promise.resolve();
}

// A full load of a route: nothing of the screens or of an older session stays in memory (sign-in, sign-out).
export function restart(address) {
	window.history.replaceState(null, "", window.location.pathname + window.location.search + hash_of(address));
	window.location.reload();
}

// Draws the screen on view again, from its markup: the language changed, and what its script wrote is still in the old one. No screen on view
// (the start of the app): nothing to do.
export function refresh() {
	return current ? show() : Promise.resolve();
}

// The same screen with another sub-route (the panels of the settings) is the screen's business; any other change is a new screen.
function on_hash_change() {
	const route = parse_route(location.hash);
	if (current && current.path === route.path && current.screen.on_hash) current.screen.on_hash(route.sub);
	else show();
}

export function start() {
	upgrade_old_address();
	window.addEventListener("hashchange", on_hash_change);
	return show();
}
