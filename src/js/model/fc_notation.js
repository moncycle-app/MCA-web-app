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

/* The FertilityCare notation (VLB 10KL AD): one note typed and shown as text, and its six fields in the API. The text is an input and
** display format only, the API never sees it. The codes belong to the method, they are not text for the user. */

const FLOWS = ["VH", "VL", "H", "M", "L"];   // VL before L
const DISCHARGES = ["10DL", "10SL", "10WL", "10", "2W", "0", "2", "4", "6", "8"];   // the longest code first
const LETTERS = ["B", "C", "G", "K", "P", "Y", "L"];   // the order the server answers them in
const NUMBERS = ["X1", "X2", "X3", "AD"];
const PAINS = ["RAP", "LAP", "AP"];

const starts_with_code = (text, codes) => codes.find((code) => text.startsWith(code));

// What a note may look like: each part once, in the order of the notation. Whatever the server can hold has a spelling that passes, and
// whatever passes is read whole by fc_score_to_codified (an R, accepted among the letters, is left out; C/K is C and K).
export const fc_note_regex = /^\s*((VH|VL|H|M|L(?!AP))\s*B?|B)?\s*(10DL|10SL|10WL|10|2W|[02468])?\s*(C\/K|[BCGKLPYR]){0,8}\s*(X[123]|AD)?\s*(RAP|LAP|AP)?\s*$/i;

// A note -> the six fields of the API. Each part is read in the order of the notation. The notation has one B, brown or black bleeding: it is
// in the letters only beside a discharge ("6BC"), anywhere else it is codifiedBleedingBrown. It has two L, which mean different things: L at the
// start is the light flow, any other L the lubricative letter, and a note starting with a space has no flow (" L", the letter alone). What is no
// code at that place (an R, a second flow) is left out.
export function fc_score_to_codified(str) {
	const note = {
		codifiedBleedingObservation : null, codifiedBleedingBrown : false, codifiedMucusSensation : null,
		codifiedMucusObservation : [], codifiedNumberObservations : null, codifiedPainObservations : null,
	};
	const letters = new Set();
	const parts = [
		[FLOWS, (code) => { note.codifiedBleedingObservation = code; }],
		[["B"], () => { note.codifiedBleedingBrown = true; }],
		[DISCHARGES, (code) => { note.codifiedMucusSensation = code; }],
		[LETTERS, (code) => { letters.add(code); }],
		[NUMBERS, (code) => { note.codifiedNumberObservations = code; }],
		[PAINS, (code) => { note.codifiedPainObservations = code; }],
	];
	const upper = String(str ?? "").toUpperCase();
	let from_part = /^\s/.test(upper) ? 1 : 0;
	let rest = upper.trim();
	while (rest !== "") {
		let taken;
		for (let at = from_part; at < parts.length && !taken; at++) {
			const [codes, keep] = parts[at];
			// LAP is a pain, not a flow or a letter L and then AP
			taken = codes.includes("L") && rest.startsWith("LAP") ? undefined : starts_with_code(rest, codes);
			if (taken) {
				keep(taken);
				from_part = codes === LETTERS ? at : at + 1;   // the only part that comes several times
			}
		}
		rest = rest.slice(taken ? taken.length : 1).trimStart();
	}
	if (note.codifiedMucusSensation === null && letters.delete("B")) note.codifiedBleedingBrown = true;
	note.codifiedMucusObservation = LETTERS.filter((letter) => letters.has(letter));
	return note;
}

// The six fields of a Day -> the note shown: "VLB 10KL AD", "LB". The letter L alone starts with a space (" L"): "L" is the light flow.
export function fc_score_from_api(d) {
	const flow = (d.codifiedBleedingObservation ?? "") + (d.codifiedBleedingBrown ? "B" : "");
	const discharge = d.codifiedMucusSensation ?? "";
	const letters = Array.isArray(d.codifiedMucusObservation) ? d.codifiedMucusObservation : [];
	const parts = [flow, discharge + letters.join(""), d.codifiedNumberObservations ?? "", d.codifiedPainObservations ?? ""];
	const note = parts.filter((part) => part !== "").join(" ");
	return flow === "" && discharge === "" && letters[0] === "L" ? " " + note : note;
}

/* The boxes of the day form, by id ("fc_" and the code, in lower case; the light flow is fc_flow_l, fc_l is the letter L, fc_b is brown, and
** fc_r is a box the notation does not know: it stays in the note, it is not sent). The letter B has no box. */
const box_of = (code) => "fc_" + code.toLowerCase();
const ONE_CODE_BOXES = [
	FLOWS.map((code) => code === "L" ? "fc_flow_l" : box_of(code)),
	DISCHARGES.map(box_of),
	NUMBERS.map(box_of),
	PAINS.map(box_of),
];

// A part holds one code: the boxes a box ticked unticks. Brown and the letters are free.
export function fc_boxes_unticked_by(box) {
	return (ONE_CODE_BOXES.find((part) => part.includes(box)) || []).filter((other) => other !== box);
}

// The boxes ticked -> the note. A letter B typed beside a discharge stays while there is a discharge: `note` is the note before the change.
export function fc_note_from_boxes(boxes, note) {
	const ticked = (part, id = box_of) => part.filter((code) => boxes.includes(id(code))).join("");
	const discharge = ticked(DISCHARGES);
	const typed_b = discharge !== "" && fc_score_to_codified(note).codifiedMucusObservation.includes("B");
	return fc_score_from_api({
		codifiedBleedingObservation : ticked(FLOWS, (code) => code === "L" ? "fc_flow_l" : box_of(code)),
		codifiedBleedingBrown : boxes.includes("fc_b"),
		codifiedMucusSensation : discharge,
		codifiedMucusObservation : [...(typed_b ? ["B"] : []), ...LETTERS.filter((letter) => letter !== "B" && boxes.includes(box_of(letter))), ...(boxes.includes("fc_r") ? ["R"] : [])],
		codifiedNumberObservations : ticked(NUMBERS),
		codifiedPainObservations : ticked(PAINS),
	});
}

// The note -> the boxes ticked.
export function fc_boxes_from_note(text) {
	const note = fc_score_to_codified(text);
	const flow = note.codifiedBleedingObservation;
	return [
		...(flow === null ? [] : [flow === "L" ? "fc_flow_l" : box_of(flow)]),
		...(note.codifiedBleedingBrown ? ["fc_b"] : []),
		...[note.codifiedMucusSensation, note.codifiedNumberObservations, note.codifiedPainObservations].filter((code) => code !== null).map(box_of),
		...note.codifiedMucusObservation.filter((letter) => letter !== "B").map(box_of),
		...(/R/i.test(String(text ?? "").replace(/RAP/i, "")) ? ["fc_r"] : []),
	];
}

// The note fields of a body queued before the note had these fields (localStorage, store schema 8): the bleeding packed ("VLB", "BL" for L
// with brown), the letters in one string, and what may have been ticked twice. Only what the old form could hold is expected.
export function fc_note_from_packed(body) {
	const first_code = (value, codes) => starts_with_code(String(value ?? "").toUpperCase(), codes) ?? null;
	const bleeding = String(body.codifiedBleedingObservation ?? "").toUpperCase();
	const letters = String(body.codifiedMucusObservation ?? "").toUpperCase();
	return {
		codifiedBleedingObservation : first_code(bleeding.replace("B", ""), FLOWS),
		codifiedBleedingBrown : bleeding.includes("B"),
		codifiedMucusSensation : first_code(body.codifiedMucusSensation, DISCHARGES),
		codifiedMucusObservation : LETTERS.filter((letter) => letters.includes(letter)),
		codifiedNumberObservations : first_code(body.codifiedNumberObservations, NUMBERS),
		codifiedPainObservations : first_code(body.codifiedPainObservations, PAINS),
	};
}
