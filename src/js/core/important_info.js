/* moncycle.app
**
** Copyright (C) 2021-2026 Tech 4 Fertility, aka. T4F (https://tech4fertility.org)
** SPDX-License-Identifier: AGPL-3.0-or-later
**
** https://www.moncycle.app
*/

/* The "Important information" box: a text from the server's operator (maintenance, update, incident; not the Tech 4 Fertility news). server_info
** tells `importantMessages` (an object, a lowercase language code to a plain text); the language asked for is shown when there is a text for it,
** else English, else no box. The router calls `attach_important_info` on every screen. The text is drawn with `textContent`, never as HTML.
** Only the timeline lets it be dismissed: the dismissal is the hash of the text, kept in `device.keep` (device.clear keeps it across a sign-out),
** so a changed text shows again. */
import { api } from "./api.js";
import { device } from "./device.js";
import { el } from "./dom.js";
import { requested_language, t } from "./i18n.js";

const SVG = "http://www.w3.org/2000/svg";
// A round badge with an exclamation mark, made node by node (no markup string, no inline style).
function icon() {
	const svg = document.createElementNS(SVG, "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("class", "important_info_icon");
	svg.setAttribute("aria-hidden", "true");
	const bar = document.createElementNS(SVG, "path");
	bar.setAttribute("d", "M12 6.5v7");
	const dot = document.createElementNS(SVG, "path");
	dot.setAttribute("d", "M12 17.4v.1");
	svg.append(bar, dot);
	return svg;
}

export const DISMISSED_KEY = "important_info_dismissed";
const MAX_CHARS = 500;   // the server's limit (SERVER_MESSAGE_MAX_CHARS): a longer text is cut

// The text for a language: its own, else English, else null.
export function important_text(info, language = requested_language()) {
	const by_language = (info && typeof info.importantMessages === "object" && info.importantMessages) || {};
	for (const code of [String(language).toLowerCase(), "en"]) {
		const text = by_language[code];
		if (typeof text === "string" && text.trim() !== "") return text.trim().slice(0, MAX_CHARS);
	}
	return null;
}

// A short fingerprint of a text (cyrb53): not a secret, only a key that changes when the text does.
export function text_hash(text) {
	let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 2654435761);
		h2 = Math.imul(h2 ^ c, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function is_dismissed(text) {
	try { return device.keep.getItem(DISMISSED_KEY) === text_hash(text); } catch (e) { return false; }
}

// One server_info for the page: the screens change often, the message rarely.
let cached = null, cached_at = 0;
function server_info() {
	if (!cached || Date.now() - cached_at > 5 * 60 * 1000) {
		cached_at = Date.now();
		cached = api("GET", "/server_info").then((ret) => (ret || {}).data || {}, () => { cached = null; return {}; });
	}
	return cached;
}

// Puts the box in `root` (after the header of a signed-in screen, else first). `dismissible`: a button hides it and remembers the text.
export function attach_important_info(root, signal, {dismissible = false} = {}) {
	server_info().then((info) => {
		if (signal && signal.aborted) return;
		const text = important_text(info);
		if (!text || (dismissible && is_dismissed(text))) return;
		const box = el("section", {class: "important_info", role: "note", "aria-label": t("common.important_info_title")},
			el("span", {class: "important_info_badge"}, icon()),
			el("div", {class: "important_info_body"},
				el("strong", {class: "important_info_title"}, t("common.important_info_title")),
				el("p", {class: "important_info_text"}, text)));
		if (dismissible) {
			const close = el("button", {type: "button", class: "important_info_close"}, t("common.important_info_close"));
			close.addEventListener("click", () => {
				try { device.keep.setItem(DISMISSED_KEY, text_hash(text)); } catch (e) { }
				box.remove();
			});
			box.querySelector(".important_info_body").append(close);
		}
		const header = root.querySelector(":scope > .app_header");
		if (header) header.after(box); else root.prepend(box);
	});
}
