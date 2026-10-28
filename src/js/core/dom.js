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

/* A few small helpers for the screens. Nothing a person reads is made here, and nothing is ever parsed as HTML: text goes in with textContent. */

// el("a", {href: "/auth", class: "button", text: "..."}, child, "text"): an element. `text` is its text; the other attributes are set as they are.
export function el(tag, attrs = {}, ...children) {
	const element = document.createElement(tag);
	for (const [name, value] of Object.entries(attrs)) {
		if (value === undefined || value === null || value === false) continue;
		if (name === "text") element.textContent = value;
		else if (name === "class") element.className = value;
		else element.setAttribute(name, value === true ? "" : value);
	}
	element.append(...children);
	return element;
}

// show or hide with the hidden attribute
export function show(node, visible = true) {
	node.hidden = !visible;
}

// The value of a field of a form by its name (the checked one of a group of radios), undefined when there is none.
export function field(form, name) {
	const fields = form.querySelectorAll(`[name="${name}"]`);
	for (const item of fields) {
		if (item.type === "radio" || item.type === "checkbox") { if (item.checked) return item.value; }
		else return item.value;
	}
	return undefined;
}
export function checked(form, name) {
	return [...form.querySelectorAll(`[name="${name}"]`)].some((item) => item.checked);
}

// A line of a screen that says what is going on: kind "busy", "ok" (green), "error" (red) or "" (empty). The message is text.
const fades = new WeakMap();
export function say(line, kind, text, fade = false) {
	clearTimeout(fades.get(line));
	line.classList.remove("vert", "rouge");
	line.replaceChildren();
	if (kind === "busy") line.textContent = text;
	if (kind === "ok") { line.classList.add("vert"); line.textContent = text; }
	if (kind === "error") { line.classList.add("rouge"); line.textContent = "❌ " + text; }
	if (kind === "ok" && fade) fades.set(line, setTimeout(() => line.replaceChildren(), 2500));
}
