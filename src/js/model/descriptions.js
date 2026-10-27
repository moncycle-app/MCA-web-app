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

/* Descriptions (the keywords of a day): their types, the shape the screens read, and how a day carries them (by name). */

export const type_to_int = {"undefined": 0, "observation": 1, "sensation": 2};
export const type_from_int = {0: "undefined", 1: "observation", 2: "sensation"};

// the API's Description -> the shape the screens read; `id` is null for one made here that the server has not created yet
export function description_from_api(d) {
	return {id: d.id, name: d.name, type: type_to_int[d.type] || 0, use_count: d.useCount};
}
export function unsent_description(name, type) {
	return {id: null, name: name, type: type, use_count: 0};
}

// the description of that name and type in the list, else a placeholder for it (a day may carry a name the list has not got)
export function resolve(list, name, type) {
	return list.find(known => known.name == name && known.type == type) || unsent_description(name, type);
}

// does a description with that name and type exist, another than the one being edited (which is not a duplicate of itself)?
export function exists(list, name, type, another_than) {
	return list.some(known => known.id !== another_than && known.name == name && known.type == type);
}

// The fields of a Day that hold names, with the type of description each holds
export const day_fields = [["freeMucusObservation", 1], ["freeMucusSensation", 2], ["freeOther", 0]];

// the names a day carries -> the descriptions of the list (or placeholders), in the order observation, sensation, other
export function of_day(day, list) {
	const found = [];
	day_fields.forEach(([field, type]) => (day[field] || []).forEach(name => found.push(resolve(list, name, type))));
	return found;
}

// chosen names -> the three fields of a Day. A name that is not in the list is left out. A label with no type yet (0) is sent back
// in freeOther, or it would be unlinked.
export function to_day_fields(names, list) {
	const out = {freeMucusObservation: [], freeMucusSensation: [], freeOther: []};
	names.forEach(name => {
		const known = list.find(d => d.name == name);
		if (!known) return;
		const field = day_fields.find(([, type]) => type == known.type);
		if (field) out[field[0]].push(known.name);
	});
	return out;
}
