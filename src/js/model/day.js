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

/* A day in the shapes the app uses. The backend speaks a structured JSON API (every answer is {"data": ...}, a Day has NFP-inspired
** names: stampColor, isPeak, codifiedArrow, freeMucusSensation...). The screens read a flat shape (stamp "R", fc_score, pos...) and
** the day form is a list of {name, value}: these functions convert between the three. */
import { fc_score_from_api, fc_score_to_codified } from "/js/model/fc_notation.js";
import { of_day, to_day_fields } from "/js/model/descriptions.js";

export const codified_fields = ["codifiedBleedingObservation", "codifiedMucusSensation", "codifiedMucusObservation", "codifiedNumberObservations", "codifiedPainObservations"];
// the content a Day holds, as opposed to where it stands in its cycle and when it was written
export const day_meta = ["date", "cycleStartDate", "cycleDay", "lastWriteClientUtc", "lastWriteDb"];

export const arrow_from_api = {"Up":"↑","Down":"↓","Right":"→"};
export const arrow_to_api = {"↑":"Up","↓":"Down","→":"Right"};

export function stamp_from_api(d) {
	const code = {"Red":"R","Green":"G","Yellow":"Y"}[d.stampColor] || "";
	return code + (d.stampBaby ? "BB" : "");
}

// a Day with nothing in it
export function blank_day(date) {
	const day = {
		date : date, cycleStartDate : null, cycleDay : null, cycleFirstDay : false, dayNotObserved : false,
		stampColor : null, stampBaby : false, isPeak : false, counterStart : null, sexUnion : false, observationPaused : false,
		freeMucusSensation : [], freeMucusObservation : [], freeOther : [], temperature : null, temperatureTime : null, codifiedArrow : null,
		comment : "", lastWriteClientUtc : null, lastWriteDb : null,
	};
	codified_fields.forEach(field => { day[field] = null; });
	return day;
}
export function is_blank(day) {
	const blank = blank_day(day.date);
	return Object.keys(blank).every(key => day_meta.includes(key) || JSON.stringify(day[key]) === JSON.stringify(blank[key]));
}

// The day the server will hold once it has taken a POST /api/v2/day/{date} body, as far as the page can tell.
export function day_from_body(body, previous) {
	const baby = !!body.stampBaby;
	const temperature = body.temperature > 0;
	const day = Object.assign(blank_day(body.date), {
		cycleFirstDay : !!body.cycleFirstDay,
		dayNotObserved : !!body.dayNotObserved,
		stampColor : body.stampColor || (baby ? "White" : null),
		stampBaby : baby,
		isPeak : !!body.isPeak,
		counterStart : body.counterStart > 0 ? body.counterStart : null,
		sexUnion : !!body.sexUnion,
		observationPaused : !!body.observationPaused,
		freeMucusSensation : (body.freeMucusSensation || []).slice(),
		freeMucusObservation : (body.freeMucusObservation || []).slice(),
		freeOther : (body.freeOther || []).slice(),
		temperature : temperature ? body.temperature : null,
		temperatureTime : temperature && body.temperatureTime ? body.temperatureTime : null,
		codifiedArrow : body.codifiedArrow || null,
		comment : body.comment || "",
		lastWriteClientUtc : body.lastWriteClientUtc ? body.lastWriteClientUtc.replace(" ", "T").replace(/Z?$/, "Z") : null,
		lastWriteDb : previous ? previous.lastWriteDb : null,
	});
	codified_fields.forEach(field => { day[field] = body[field] || null; });
	return day;
}

// a Day of the API -> the flat shape the screens draw. `descriptions` is the list of known descriptions, to recover their ids.
export function day_from_api(d, descriptions) {
	return {
		date_obs : d.date,
		cycle : d.cycleStartDate,
		pos : d.cycleDay,
		cycle_1st_day : d.cycleFirstDay,
		day_not_observed : d.dayNotObserved,
		stamp : stamp_from_api(d),
		is_peak : d.isPeak,
		counter_start : d.counterStart,
		union_sex : d.sexUnion,
		observation_paused : d.observationPaused,
		temperature : d.temperature,
		time_temp_taken : d.temperatureTime,
		fc_score : fc_score_from_api(d),
		fc_arrow : arrow_from_api[d.codifiedArrow] || "",
		comment : d.comment,
		description : of_day(d, descriptions),
		last_write : d.lastWriteClientUtc || d.lastWriteDb || null,
	};
}

// The fields of the day form ([{name, value}], what serializeArray() gives; flat names: date, stamp, baby, fc_score, fc_arrow, temp,
// time_temp_taken, counter_start, is_peak, union_sex, cycle_1st_day, day_not_observed, observation_paused, comment, description[],
// last_write_client_UTC; the individual fc_* boxes are scratch state that builds fc_score) -> the JSON body POST /api/v2/day expects.
export function day_to_api(fields, descriptions) {
	const get = (n) => fields.filter(f => f.name == n).map(f => f.value);
	const get1 = (n) => { const v = get(n); return v.length ? v[0] : undefined; };
	return Object.assign({
		date : get1('date'),
		stampColor : {"R":"Red","G":"Green","Y":"Yellow","":null}[get1('stamp') || ''],
		stampBaby : get1('baby') == 'BB',
		codifiedArrow : arrow_to_api[get1('fc_arrow')] || null,
		temperature : get1('temp') ? parseFloat(get1('temp')) : null,
		temperatureTime : get1('time_temp_taken') || null,
		counterStart : parseInt(get1('counter_start') || '0'),
		isPeak : get1('is_peak') == '1',
		sexUnion : get1('union_sex') == '1',
		cycleFirstDay : get1('cycle_1st_day') == '1',
		dayNotObserved : get1('day_not_observed') == '1',
		observationPaused : get1('observation_paused') == '1',
		comment : get1('comment') || '',
		lastWriteClientUtc : get1('last_write_client_UTC') || null,
	}, fc_score_to_codified(get1('fc_score') || ''),
	// a chip stands for a description by its name, which is what a day carries it by
	to_day_fields(get('description[]'), descriptions));
}
