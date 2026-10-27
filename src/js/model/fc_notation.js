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

/* The FertilityCare notation (VL, 10KL, X1...): a note typed in one field, and the five "codified" fields of the API. The codes belong to
** the method, they are not text for the user. Mirrors data_parse_fc_note() and day_format_fc_score_encode() of the backend. */

export const fc_note_keys = ['10DL','10SL','10WL','RAP','LAP','X1','X2','X3','AD','AP','VL','VH','2W','10','H','M','L','B','0','2','4','6','8','C','G','K','P','Y','R'];

export const fc_groups = {
	codifiedBleedingObservation : ['VH','H','M','VL','B'],
	codifiedMucusSensation : ['0','2','2W','4','6','8','10','10DL','10SL','10WL'],
	codifiedMucusObservation : ['C','G','K','P','Y','L'],
	codifiedNumberObservations : ['X1','X2','X3','AD'],
	codifiedPainObservations : ['AP','RAP','LAP'],
};

// what a note typed by hand may look like (tested on the upper-cased note)
export const fc_note_regex = /^((h|m|l|vl|H|M|L|VL|VH)\s*(b|B)?\s*)?(2W|10KL|10SL|10DL|10WL|2w|10kl|10sl|10dl|10wl|[024]|(([68]|10)\s*[BCGKLPYRbcgklpyr]{1,8}))?\s*([xX][123]|AD|ad)?(\s*[RrLl]?(ap|AP))?$/;

// a leading "L" (other than "LAP...") is the separate "Lsaignement" (spotting) flag, not the standalone "L" mucus-observation code
export function parse_fc_note(str) {
	const note = {Lsaignement: false};
	fc_note_keys.forEach(k => note[k] = false);
	if (!str) return note;
	str = str.trim();
	if (str.length > 0) {
		str = str.toUpperCase();
		if (str.startsWith('L') && !str.startsWith('LAP')) {
			note.Lsaignement = true;
			str = str.slice(1);
		}
		fc_note_keys.forEach(k => {
			if (str.includes(k)) note[k] = true;
			str = str.split(k).join('');
		});
	}
	return note;
}

// a note -> the API's 5 codifiedXxx fields
export function fc_score_to_codified(str) {
	const note = parse_fc_note(str);
	let bleeding = '';
	fc_groups.codifiedBleedingObservation.forEach(c => { if (note[c]) bleeding += c; });
	if (note.Lsaignement) bleeding += 'L';
	const out = {codifiedBleedingObservation : bleeding || null};
	for (const field in fc_groups) {
		if (field == 'codifiedBleedingObservation') continue;
		let v = '';
		fc_groups[field].forEach(c => { if (note[c]) v += c; });
		out[field] = v || null;
	}
	return out;
}

// the API's 5 codifiedXxx fields -> a single note. Decoding puts spotting at the *end* of codifiedBleedingObservation (e.g. "BL"),
// but the notation only recognises it as a *leading* "L", so it moves back to the front here or it would read back as the
// unrelated standalone "L" mucus-observation code instead.
export function fc_score_from_api(d) {
	let bleeding = (d.codifiedBleedingObservation || '').trim();
	let spotting = false;
	const bleeding_codes = fc_groups.codifiedBleedingObservation;
	if (bleeding !== '' && !bleeding_codes.includes(bleeding) && bleeding.endsWith('L')) {
		const candidate = bleeding.slice(0, -1);
		if (candidate === '' || bleeding_codes.includes(candidate)) {
			spotting = true;
			bleeding = candidate;
		}
	}
	const parts = [];
	if (bleeding !== '') parts.push(bleeding);
	['codifiedMucusSensation','codifiedMucusObservation','codifiedNumberObservations','codifiedPainObservations'].forEach(f => {
		const v = (d[f] || '').trim();
		if (v !== '') parts.push(v);
	});
	if (parts.length === 0 && !spotting) return '';
	let joined = parts.join(' ');
	if (spotting) return 'L' + (joined !== '' ? ' ' + joined : '');
	if (joined.startsWith('L') && !joined.startsWith('LAP')) joined = ' ' + joined;
	return joined;
}
