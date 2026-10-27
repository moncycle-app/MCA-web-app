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

/* Cycles: where a date stands among the first days of the cycles, how long a cycle is, which days follow a peak. The account lists the
** first days ("starts", newest first) and the dates the observation was paused. Dates are "YYYY-MM-DD". */
import * as dates from "/js/model/dates.js";

// the number of days from a cycle's first day to a date, plus one
export function day_number(cycle, date) {
	return dates.days_between(cycle, date) + 1;
}
// where a date stands: the closest first day at or before it
export function cycle_of(starts, date) {
	let cycle = null;
	(starts || []).forEach(start => {
		if (start <= date && (cycle === null || start > cycle)) cycle = start;
	});
	return {cycleStartDate: cycle, cycleDay: cycle ? day_number(cycle, date) : null};
}
// A list of dates, newest first, with a date in it or out of it.
export function set_member(list, date, member) {
	const at = list.indexOf(date);
	if (member && at < 0) {
		list.push(date);
		list.sort().reverse();
	}
	else if (!member && at >= 0) list.splice(at, 1);
}
// Gives every day (date -> Day, changed in place) its cycle and its place in it. Returns the dates of the days that moved.
export function place_days(starts, days) {
	const sorted = starts.slice().sort();
	const moved = [];
	let next = 0;
	let cycle = null;
	Object.keys(days).sort().forEach(date => {
		while (next < sorted.length && sorted[next] <= date) cycle = sorted[next++];
		const day = days[date];
		const place = cycle ? day_number(cycle, date) : null;
		if (day.cycleStartDate === cycle && day.cycleDay === place) return;
		day.cycleStartDate = cycle;
		day.cycleDay = place;
		moved.push(date);
	});
	return moved;
}

// The "nfp_method" 1-4 integer conflates the method with whether the temperature is tracked; the API has two fields.
export function nfp_method_from_api(method, temperature_tracking) {
	const table = {"cervicalMucus": [2, 1], "fertilityCare": [3, 4]};
	const pair = table[method] || table["cervicalMucus"];
	return temperature_tracking ? pair[1] : pair[0];
}
// GET /api/v2/account (with the lists of the timeline sync) -> the flat shape the timeline reads
export function constante_from_api(d) {
	const nfp_method = nfp_method_from_api(d.method, d.temperatureTracking);
	return {
		no_user_account : d.userId,
		nickname : d.nickname,
		sponsor : d.sponsor,
		nfp_method : nfp_method,
		nfp_method_name : {1:"mucus_temp", 2:"mucus", 3:"fc", 4:"fc_temp"}[nfp_method],
		all_cycles_1st_day : d.allCyclesFirstDay,
		all_observation_paused_dates : d.allObservationPausedDates,
		timeline_asc : d.timelineAscending,
	};
}
// what the cycles drawn were made from: when the account says otherwise, they are drawn again
export function structure_of(account) {
	return JSON.stringify([account.allCyclesFirstDay, account.allObservationPausedDates, account.timelineAscending, account.method, account.temperatureTracking]);
}

// Days per line of the recap: wide enough for 80% of the recent complete cycles (and the median + 5), in steps of 5 so that the
// layout does not move with every new cycle. A cycle longer than that wraps; the bounds keep the days readable on a phone.
export function cycle_line_length(starts, pauses) {
	const DEFAULT = 35, MIN = 30, MAX = 45, STEP = 5, MARGIN = 5, RECENT = 12, MIN_CYCLES = 3, QUANTILE = 0.8;
	starts = starts || [];
	pauses = pauses || [];
	const lengths = [];
	// the starts come latest first: starts[c-1] is the day after the end of cycle c, which the latest cycle (still open) lacks
	for (let c = 1; c < starts.length && lengths.length < RECENT; c++) {
		const start = dates.parse(starts[c]);
		const next = dates.parse(starts[c-1]);
		// a cycle that ended with a pause of the observations is not a length
		if (pauses.some(d => d >= starts[c] && d < starts[c-1])) continue;
		lengths.push(Math.round((next - start) / dates.DAY_MS));
	}
	if (lengths.length < MIN_CYCLES) return DEFAULT;
	lengths.sort((x, y) => x - y);
	const p80 = lengths[Math.ceil(QUANTILE * lengths.length) - 1];
	const median = (lengths[Math.floor((lengths.length - 1) / 2)] + lengths[Math.ceil((lengths.length - 1) / 2)]) / 2;
	const wanted = Math.ceil(Math.max(p80, median + MARGIN) / STEP) * STEP;
	return Math.min(MAX, Math.max(MIN, wanted));
}

// The span of the cycle starts[index]: its first day, its last day (the day before the next cycle, today for the latest, or the first
// pause inside it), its number of days, and whether the latest cycle is closed by a pause (a form for a new cycle is offered).
export function cycle_span(starts, pauses, index) {
	let end = dates.now();
	const ends_today = index == 0;
	if (!ends_today) {
		end = new Date(dates.parse(starts[index - 1]) - dates.DAY_MS);
		end.setHours(9);
	}
	const start = dates.parse(starts[index]);
	start.setHours(9);
	let paused = false;
	pauses.forEach(date => {
		const pause = dates.parse(date);
		pause.setHours(9);
		if (pause >= start && pause <= end) {
			end = pause;
			if (ends_today) paused = true;
		}
	});
	return {start: starts[index], start_date: start, end_date: end, days: Math.round((end - start) / dates.DAY_MS + 1), new_cycle_form: paused};
}

// The days that carry a mark after a peak day: +1, +2, +3 and the last day of the cycle (`last`: how many days follow in the cycle).
export function peak_follow_days(peak, last) {
	return [1, 2, 3, last].map(n => {
		const date = dates.parse(peak);
		date.setDate(date.getDate() + n);
		return {date: dates.str(date), n: n};
	});
}
// The days of a counter started on a date, numbered from 1.
export function counter_days(start, count) {
	const days = [];
	for (let i = 0; i < count; i++) {
		const date = dates.parse(start);
		date.setDate(date.getDate() + i);
		days.push({date: dates.str(date), n: i + 1});
	}
	return days;
}
