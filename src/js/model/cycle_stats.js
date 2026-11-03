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

/* The figures of a cycle, from the days of the local copy (date -> Day of the API): how each day is drawn, how much of the cycle is filled
** in, its peak and its baby period, and the averages of the complete cycles before it. Numbers only: the words are the catalog's and the
** drawing is the timeline's (screens/timeline/cycle_view.js). Dates are "YYYY-MM-DD"; the days of a cycle are numbered from 1. */
import * as dates from "./dates.js";
import { cycle_lengths } from "./cycles.js";
import { fc_score_from_api } from "./fc_notation.js";

// how many complete cycles before a cycle its averages are made of
export const PREVIOUS_CYCLES = 6;

// How the timeline draws a day (day_timeline2timeline): "paused", "not_observed", the colour of its stamp ("R", "G", "Y": a coloured stamp
// with a baby is drawn in its colour; "BB" is the white one), "none" for no stamp but what the method shows (a temperature, a FertilityCare
// note), else "to_fill". `method` is {fc, temperature}: what the method of the account shows.
export function day_kind(day, method) {
	if (!day) return "to_fill";
	if (day.observationPaused) return "paused";
	if (day.dayNotObserved) return "not_observed";
	const colour = {Red: "R", Green: "G", Yellow: "Y"}[day.stampColor];
	if (colour) return colour;
	if (day.stampBaby) return "BB";
	if ((method.temperature && day.temperature > 0) || (method.fc && fc_score_from_api(day) !== "")) return "none";
	return "to_fill";
}

// The figures of the cycle that runs from `from` to `to` (its last day), `days` the copy (date -> Day):
//   total        its number of days
//   kinds        its days of each kind of day_kind, {R, G, Y, BB, none, not_observed, to_fill, paused}: every day is of one kind
//   to_fill      its days still to fill in, in order
//   streak       its days filled in a row up to its last day (up to the day before when the last one is still to fill in)
//   longest      its most days filled in a row
//   peak         the day of its latest peak, or null
//   baby         its baby period (baby_period), or null
//   temperature  the summary of its temperatures, or null (there is none when the method has no temperature)
//   words        the keywords on the most of its days, at most 3: [[word, days]] (none when the method takes FertilityCare notes)
export function cycle_stats(days, from, to, method) {
	const total = dates.days_between(from, to) + 1;
	const kinds = {R: 0, G: 0, Y: 0, BB: 0, none: 0, not_observed: 0, to_fill: 0, paused: 0};
	const cycle = [], to_fill = [], temperatures = [];
	const words = new Map();
	let peak = null, run = 0, longest = 0;
	for (let n = 1; n <= total; n++) {
		const day = days[dates.add_days(from, n - 1)];
		const kind = day_kind(day, method);
		kinds[kind]++;
		cycle.push({kind: kind, baby: ["R", "G", "Y", "BB"].includes(kind) && !!day.stampBaby});
		run = kind == "to_fill" ? 0 : run + 1;
		longest = Math.max(longest, run);
		if (kind == "to_fill") to_fill.push(n);
		if (!day) continue;
		// what the timeline marks on a day: a peak on any day
		if (day.isPeak) peak = n;
		if (kind == "paused") continue;
		if (kind == "not_observed") continue;
		if (method.temperature && day.temperature > 0) temperatures.push(Number(day.temperature));
		if (!method.fc) new Set([...(day.freeMucusObservation || []), ...(day.freeMucusSensation || []), ...(day.freeOther || [])]).forEach((word) => words.set(word, (words.get(word) || 0) + 1));
	}
	const last = total > 0 && cycle[total - 1].kind == "to_fill" ? total - 1 : total;
	let streak = 0;
	while (streak < last && cycle[last - 1 - streak].kind != "to_fill") streak++;
	return {
		total: total, kinds: kinds, to_fill: to_fill, streak: streak, longest: longest, peak: peak,
		baby: baby_period(cycle, peak),
		temperature: summary(temperatures),
		words: [...words].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3),
	};
}

// The baby period of a cycle, `cycle` giving each of its days in order as {kind, baby}: baby days in a row, with the days not observed or
// still to fill in around and between them (they may have been baby days), unless those reach the first or the last day of the cycle. With a
// peak, the period that holds the latest peak (else the latest one before it, the peak closing it); without one, or with no period before it,
// the longest (the latest of equals). {first, last, days}, or null without a baby day.
export function baby_period(cycle, peak) {
	const unknown = (day) => day.kind == "not_observed" || day.kind == "to_fill";
	// the runs of unknown days that have a known day on both sides
	const inside = cycle.map(() => false);
	for (let i = 0; i < cycle.length; i++) {
		if (!unknown(cycle[i])) continue;
		let end = i;
		while (end < cycle.length && unknown(cycle[end])) end++;
		if (i > 0 && end < cycle.length) inside.fill(true, i, end);
		i = end;
	}
	const runs = [];
	let current = null;
	cycle.forEach((day, i) => {
		if (!day.baby && !inside[i]) {
			current = null;
			return;
		}
		if (!current) runs.push(current = {first: i + 1, last: i + 1, babies: 0});
		current.last = i + 1;
		if (day.baby) current.babies++;
	});
	const periods = runs.filter((run) => run.babies > 0).map((run) => ({first: run.first, last: run.last, days: run.last - run.first + 1}));
	if (!periods.length) return null;
	if (peak) {
		const before = periods.filter((period) => period.first <= peak);
		if (before.length) return before[before.length - 1];
	}
	return periods.reduce((best, period) => period.days >= best.days ? period : best);
}

// {count, mean, min, max} of numbers, or null for none
export function summary(values) {
	if (!values.length) return null;
	return {count: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length, min: Math.min(...values), max: Math.max(...values)};
}

// The complete cycles before the one that starts on `from`, the latest PREVIOUS_CYCLES (a cycle ended by a pause of the observations has no
// length and is not one of them, see cycle_lengths): their number, and the summaries of their lengths, of their peak days and of the days
// after their peak (the cycles that have one): {cycles, length, peak, after_peak}, a summary being null when there is nothing to sum up.
export function previous_cycles(starts, pauses, days, from) {
	const cycles = cycle_lengths(starts, pauses).filter((cycle) => cycle.start < from).slice(0, PREVIOUS_CYCLES);
	const peaks = [];
	cycles.forEach((cycle) => {
		for (let n = cycle.days; n >= 1; n--) {
			const day = days[dates.add_days(cycle.start, n - 1)];
			if (day && day.isPeak) {
				peaks.push({days: cycle.days, peak: n});
				break;
			}
		}
	});
	return {
		cycles: cycles.length,
		length: summary(cycles.map((cycle) => cycle.days)),
		peak: summary(peaks.map((cycle) => cycle.peak)),
		after_peak: summary(peaks.map((cycle) => cycle.days - cycle.peak)),
	};
}

// A part of a whole in percent, rounded, but never 0 for a part that is something nor 100 for a part that is not all of it
export function percent(part, whole) {
	if (part <= 0 || whole <= 0) return 0;
	if (part >= whole) return 100;
	return Math.min(99, Math.max(1, Math.round(100 * part / whole)));
}

// How much of a cycle is filled in, in percent: what its days still to fill in leave, so that the two always add up to 100
export function filled_percent(stats) {
	return 100 - percent(stats.kinds.to_fill, stats.total);
}

// What a cycle filled in at `filled` percent is told: "full", else the step it reached, "95", "90", "80" or "60", else "low"
export function fill_level(filled) {
	if (filled >= 100) return "full";
	const step = [95, 90, 80, 60].find((at_least) => filled >= at_least);
	return step ? String(step) : "low";
}

// Days in order -> the runs of days in a row: [{first, last}]
export function day_runs(numbers) {
	const runs = [];
	numbers.forEach((n) => {
		const run = runs[runs.length - 1];
		if (run && n == run.last + 1) run.last = n;
		else runs.push({first: n, last: n});
	});
	return runs;
}

// The days to fill in as what a person taps to open them: the runs of days in a row, except that a run of two is two days, so that each
// one opens on its own. [{first, last}]
export function todo_runs(numbers) {
	return day_runs(numbers).flatMap((run) => run.last == run.first + 1 ? [{first: run.first, last: run.first}, {first: run.last, last: run.last}] : [run]);
}
