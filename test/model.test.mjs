// The pure models: dates, FertilityCare notation, descriptions, days, cycles. No DOM, no storage.
import test from "node:test";
import assert from "node:assert/strict";
import * as dates from "/js/model/dates.js";
import { parse_fc_note, fc_score_to_codified, fc_score_from_api, fc_note_regex } from "/js/model/fc_notation.js";
import { description_from_api, resolve, exists, of_day, to_day_fields } from "/js/model/descriptions.js";
import { day_from_api, day_to_api, blank_day, is_blank, day_from_body, stamp_from_api } from "/js/model/day.js";
import * as cycles from "/js/model/cycles.js";
import * as stats from "/js/model/cycle_stats.js";

test("dates", () => {
	assert.equal(dates.str(dates.parse("2026-03-09")), "2026-03-09");
	assert.equal(dates.parse("2026-03-09").getHours(), 9);
	assert.equal(dates.days_between("2026-02-28", "2026-03-02"), 2);
	assert.equal(dates.add_days("2026-02-28", 1), "2026-03-01");
	assert.equal(dates.add_days("2026-03-28", 2), "2026-03-30");   // over a change of hour
	assert.equal(dates.add_days("2026-03-01", -1), "2026-02-28");
	assert.match(dates.now_in_utc(), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
});

test("fc notation: parse", () => {
	const note = parse_fc_note("VL 10KL X1");
	assert.deepEqual(["VL", "X1", "10", "K", "L"].map((k) => note[k]), [true, true, true, true, true]);
	assert.equal(note.H, false);
	assert.equal(parse_fc_note("L 0").Lsaignement, true);
	assert.equal(parse_fc_note("LAP").Lsaignement, false);
	assert.equal(parse_fc_note("LAP").LAP, true);
	assert.equal(parse_fc_note("").Lsaignement, false);
});
test("fc notation: to and from the API", () => {
	assert.deepEqual(fc_score_to_codified("VL 10KL X1"), {
		codifiedBleedingObservation: "VL", codifiedMucusSensation: "10", codifiedMucusObservation: "KL",
		codifiedNumberObservations: "X1", codifiedPainObservations: null,
	});
	assert.equal(fc_score_to_codified("").codifiedBleedingObservation, null);
	assert.equal(fc_score_from_api({ codifiedBleedingObservation: "VL", codifiedMucusSensation: "10", codifiedMucusObservation: "K", codifiedNumberObservations: "X1" }), "VL 10 K X1");
	assert.equal(fc_score_from_api({}), "");
	// spotting is "BL" in the API and a leading L in a note
	assert.equal(fc_score_from_api({ codifiedBleedingObservation: "BL", codifiedMucusSensation: "2" }), "L B 2");
	assert.equal(fc_score_from_api({ codifiedMucusObservation: "L" }), " L");
});
test("fc notation: what may be typed", () => {
	for (const ok of ["VL 10KL X1", "H", "0", "6C", "2W AD", "10KL X2 AP"]) assert.ok(fc_note_regex.test(ok.toUpperCase()), ok);
	for (const bad of ["Z", "12", "VL VL"]) assert.ok(!fc_note_regex.test(bad.toUpperCase()), bad);
});

test("descriptions", () => {
	assert.deepEqual(description_from_api({ id: 3, name: "a", type: "sensation", useCount: 2 }), { id: 3, name: "a", type: 2, use_count: 2 });
	assert.equal(description_from_api({ id: 3, name: "a", type: "weird", useCount: 0 }).type, 0);
	const list = [{ id: 1, name: "a", type: 1, use_count: 0 }, { id: 2, name: "b", type: 2, use_count: 0 }];
	assert.equal(resolve(list, "a", 1).id, 1);
	assert.equal(resolve(list, "a", 2).id, null);
	assert.equal(exists(list, "a", 1), true);
	assert.equal(exists(list, "a", 1, 1), false);
	assert.deepEqual(of_day({ freeMucusSensation: ["b"], freeMucusObservation: ["a"], freeOther: ["z"] }, list).map((d) => d.name), ["a", "b", "z"]);
	assert.deepEqual(to_day_fields(["b", "a", "unknown"], list), { freeMucusObservation: ["a"], freeMucusSensation: ["b"], freeOther: [] });
});

test("day: API <-> flat shape <-> form", () => {
	const flat = day_from_api({ date: "2026-03-10", stampColor: "Red", stampBaby: true, comment: "x", cycleDay: 3, freeMucusSensation: ["b"] }, [{ id: 2, name: "b", type: 2, use_count: 0 }]);
	assert.equal(flat.stamp, "RBB");
	assert.equal(flat.pos, 3);
	assert.equal(flat.description[0].id, 2);
	assert.equal(stamp_from_api({ stampColor: null, stampBaby: true }), "BB");
	const body = day_to_api([
		{ name: "date", value: "2026-03-10" }, { name: "stamp", value: "G" }, { name: "baby", value: "BB" }, { name: "temp", value: "36.5" },
		{ name: "comment", value: "<b>x</b>" }, { name: "is_peak", value: "1" }, { name: "fc_score", value: "VL" }, { name: "fc_arrow", value: "↑" },
		{ name: "description[]", value: "b" },
	], [{ id: 2, name: "b", type: 2, use_count: 0 }]);
	assert.equal(body.stampColor, "Green");
	assert.equal(body.stampBaby, true);
	assert.equal(body.temperature, 36.5);
	assert.equal(body.isPeak, true);
	assert.equal(body.cycleFirstDay, false);
	assert.equal(body.codifiedArrow, "Up");
	assert.equal(body.codifiedBleedingObservation, "VL");
	assert.deepEqual(body.freeMucusSensation, ["b"]);
	assert.equal(body.comment, "<b>x</b>");
});
test("day: blank and from a body", () => {
	assert.equal(is_blank(blank_day("2026-03-10")), true);
	const day = day_from_body({ date: "2026-03-10", stampBaby: true, temperature: 0, lastWriteClientUtc: "2026-03-10 09:00:00" }, null);
	assert.equal(day.stampColor, "White");
	assert.equal(day.temperature, null);
	assert.equal(day.lastWriteClientUtc, "2026-03-10T09:00:00Z");
	assert.equal(is_blank(day), false);
	// where a day stands in its cycle and when it was written do not make it non-blank
	assert.equal(is_blank({ ...blank_day("2026-03-10"), cycleDay: 4, cycleStartDate: "2026-03-07" }), true);
});

test("cycles: places and lengths", () => {
	assert.equal(cycles.day_number("2026-03-01", "2026-03-10"), 10);
	const starts = ["2026-03-20", "2026-03-01", "2026-02-01"];
	assert.deepEqual(cycles.cycle_of(starts, "2026-03-10"), { cycleStartDate: "2026-03-01", cycleDay: 10 });
	assert.deepEqual(cycles.cycle_of(starts, "2026-01-10"), { cycleStartDate: null, cycleDay: null });
	const list = ["2026-03-20", "2026-03-01"];
	cycles.set_member(list, "2026-03-10", true);
	assert.deepEqual(list, ["2026-03-20", "2026-03-10", "2026-03-01"]);
	cycles.set_member(list, "2026-03-20", false);
	assert.deepEqual(list, ["2026-03-10", "2026-03-01"]);
	const days = { "2026-03-02": { cycleStartDate: null, cycleDay: null }, "2026-03-25": { cycleStartDate: "2026-03-01", cycleDay: 25 } };
	assert.deepEqual(cycles.place_days(["2026-03-20", "2026-03-01"], days), ["2026-03-02", "2026-03-25"]);
	assert.deepEqual(days["2026-03-25"], { cycleStartDate: "2026-03-20", cycleDay: 6 });
});
test("cycles: line length", () => {
	assert.equal(cycles.cycle_line_length([], []), 35);
	const starts = ["2026-05-01", "2026-04-03", "2026-03-06", "2026-02-06", "2026-01-09"];   // lengths 28, 28, 28, 28
	assert.equal(cycles.cycle_line_length(starts, []), 35);   // median 28 + 5 = 33, in steps of 5
	const long = ["2026-07-01", "2026-05-20", "2026-04-01", "2026-02-10", "2026-01-01"];   // 42, 49, 51, 40
	assert.equal(cycles.cycle_line_length(long, []), 45);   // at most 45
	assert.equal(cycles.cycle_line_length(starts, ["2026-03-20", "2026-04-10", "2026-02-20"]), 35);   // three pauses leave one length: the default
});
test("cycles: lengths", () => {
	assert.deepEqual(cycles.cycle_lengths([], []), []);
	assert.deepEqual(cycles.cycle_lengths(["2026-05-01", "2026-04-03", "2026-03-06"], []), [{start: "2026-04-03", days: 28}, {start: "2026-03-06", days: 28}]);
	assert.deepEqual(cycles.cycle_lengths(["2026-05-01", "2026-04-03", "2026-03-06"], ["2026-03-20"]), [{start: "2026-04-03", days: 28}]);   // ended by a pause
});
test("cycles: span, peak marks, counters", () => {
	const closed = cycles.cycle_span(["2026-05-01", "2026-04-03"], [], 1);
	assert.equal(closed.start, "2026-04-03");
	assert.equal(closed.days, 28);
	assert.equal(dates.str(closed.end_date), "2026-04-30");
	const paused = cycles.cycle_span(["2026-05-01", "2026-04-03"], ["2026-04-20"], 1);
	assert.equal(paused.days, 18);
	assert.equal(paused.new_cycle_form, false);
	const latest = cycles.cycle_span([dates.str(dates.now())], [dates.str(dates.now())], 0);
	assert.equal(latest.days, 1);
	assert.equal(latest.new_cycle_form, true);
	assert.deepEqual(cycles.peak_follow_days("2026-03-30", 5), [
		{ date: "2026-03-31", n: 1 }, { date: "2026-04-01", n: 2 }, { date: "2026-04-02", n: 3 }, { date: "2026-04-04", n: 5 }]);
	assert.deepEqual(cycles.counter_days("2026-03-30", 3), [{ date: "2026-03-30", n: 1 }, { date: "2026-03-31", n: 2 }, { date: "2026-04-01", n: 3 }]);
	assert.equal(cycles.nfp_method_from_api("fertilityCare", true), 4);
	assert.equal(cycles.nfp_method_from_api("unknown", false), 2);
});

// The days of a cycle from letters, one per day from `from`: R G Y a stamp, B the white one with a baby, g a green one with a baby, N not
// observed, P paused, T a temperature alone, "." nothing; `more` adds fields to a day, by its number.
function chart(from, letters, more = {}) {
	const shapes = { R: { stampColor: "Red" }, G: { stampColor: "Green" }, Y: { stampColor: "Yellow" }, B: { stampColor: "White", stampBaby: true }, g: { stampColor: "Green", stampBaby: true }, N: { dayNotObserved: true }, P: { observationPaused: true }, T: { temperature: 36.6 } };
	const days = {};
	[...letters].forEach((letter, i) => {
		if (shapes[letter] || more[i + 1]) days[dates.add_days(from, i)] = { ...shapes[letter], ...more[i + 1] };
	});
	return days;
}
const MUCUS = { fc: false, temperature: false };

test("cycle stats: a day is of the kind the timeline draws", () => {
	const mucus_temp = { fc: false, temperature: true }, fc = { fc: true, temperature: false };
	assert.equal(stats.day_kind(undefined, MUCUS), "to_fill");
	assert.equal(stats.day_kind({ stampColor: "Green", stampBaby: true }, MUCUS), "G");   // a coloured stamp with a baby: its colour
	assert.equal(stats.day_kind({ stampColor: "White", stampBaby: true }, MUCUS), "BB");
	assert.equal(stats.day_kind({ stampColor: "White" }, MUCUS), "to_fill");
	assert.equal(stats.day_kind({ dayNotObserved: true, stampColor: "Red" }, MUCUS), "not_observed");
	assert.equal(stats.day_kind({ observationPaused: true, stampColor: "Red" }, MUCUS), "paused");
	assert.equal(stats.day_kind({ temperature: 36.5 }, MUCUS), "to_fill");   // a temperature the method does not show
	assert.equal(stats.day_kind({ temperature: 36.5 }, mucus_temp), "none");
	assert.equal(stats.day_kind({ codifiedMucusSensation: "10" }, fc), "none");
	assert.equal(stats.day_kind({ codifiedMucusSensation: "10" }, MUCUS), "to_fill");
	assert.equal(stats.day_kind({ sexUnion: true, isPeak: true, comment: "x", freeMucusSensation: ["a"] }, MUCUS), "to_fill");
});

test("cycle stats: the days of a cycle by kind, filled in, in a row, the peak, intercourse", () => {
	const from = "2026-03-01";
	//                          1234567890123456789012345
	const days = chart(from, "RRRRGG.GGBBNBBgggGGG..GG.", { 7: { sexUnion: true }, 14: { isPeak: true }, 20: { sexUnion: true } });
	const cycle = stats.cycle_stats(days, from, dates.add_days(from, 24), MUCUS);
	assert.equal(cycle.total, 25);
	assert.deepEqual(cycle.kinds, { R: 4, G: 12, Y: 0, BB: 4, none: 0, not_observed: 1, to_fill: 4, paused: 0 });
	assert.deepEqual(cycle.to_fill, [7, 21, 22, 25]);
	assert.equal(cycle.streak, 2);    // days 23 and 24: the last day is still to fill in
	assert.equal(cycle.longest, 13);  // days 8 to 20
	assert.deepEqual(cycle.union, [7, 20]);   // a day to fill in can hold intercourse
	assert.equal(cycle.peak, 14);
	assert.deepEqual(cycle.baby, { first: 10, last: 17, days: 8 });   // the day not observed between baby days is one of them
	assert.equal(cycle.temperature, null);
	assert.deepEqual(cycle.words, []);
	assert.equal(stats.filled_percent(cycle), 84);
});

test("cycle stats: temperatures and keywords, as the method shows them", () => {
	const from = "2026-03-01";
	const days = chart(from, "TTG.N", { 1: { temperature: 36.4 }, 3: { temperature: 36.9, freeMucusObservation: ["a", "b"], freeMucusSensation: ["a"] }, 4: { freeOther: ["b"] }, 5: { temperature: 37.2, freeMucusObservation: ["c"] } });
	const with_temperature = stats.cycle_stats(days, from, "2026-03-05", { fc: false, temperature: true });
	assert.deepEqual(with_temperature.kinds, { R: 0, G: 1, Y: 0, BB: 0, none: 2, not_observed: 1, to_fill: 1, paused: 0 });
	const { count, mean, min, max } = with_temperature.temperature;   // not the day not observed
	assert.deepEqual([count, min, max], [3, 36.4, 36.9]);
	assert.ok(Math.abs(mean - 36.633) < 0.001);
	assert.deepEqual(with_temperature.words, [["a", 1], ["b", 2]].reverse());   // on the most days first, a word counted once a day
	assert.equal(stats.cycle_stats(days, from, "2026-03-05", MUCUS).temperature, null);
	assert.deepEqual(stats.cycle_stats(days, from, "2026-03-05", { fc: true, temperature: false }).words, []);
});

test("cycle stats: a cycle closed by a pause, a cycle filled in", () => {
	const paused = stats.cycle_stats(chart("2026-03-01", "RRGGP"), "2026-03-01", "2026-03-05", MUCUS);
	assert.equal(paused.kinds.paused, 1);
	assert.equal(stats.filled_percent(paused), 100);   // the pause is written down, not to fill in
	const full = stats.cycle_stats(chart("2026-03-01", "RRGNG"), "2026-03-01", "2026-03-05", MUCUS);
	assert.deepEqual([full.streak, full.longest, full.to_fill.length], [5, 5, 0]);
	const today_left = stats.cycle_stats(chart("2026-03-01", "RRGG."), "2026-03-01", "2026-03-05", MUCUS);
	assert.deepEqual([today_left.streak, today_left.to_fill], [4, [5]]);
	const empty = stats.cycle_stats({}, "2026-03-01", "2026-03-03", MUCUS);
	assert.deepEqual([empty.streak, empty.longest, empty.baby, empty.peak, stats.filled_percent(empty)], [0, 0, null, null, 0]);
});

test("cycle stats: the baby period takes the unknown days around it, unless they reach an end of the cycle", () => {
	const shape = (letters) => [...letters].map((letter) => ({ kind: { ".": "to_fill", N: "not_observed", B: "BB", g: "G", G: "G", P: "paused" }[letter], baby: letter == "B" || letter == "g" }));
	assert.equal(stats.baby_period(shape("GGGG"), null), null);
	assert.equal(stats.baby_period(shape("G..N.G"), null), null);   // unknown days with no baby day next to them
	assert.deepEqual(stats.baby_period(shape("GG..BB.N.GG"), null), { first: 3, last: 9, days: 7 });
	assert.deepEqual(stats.baby_period(shape("..BB.."), null), { first: 3, last: 4, days: 2 });   // they reach the first and the last day
	assert.deepEqual(stats.baby_period(shape("GBB.P"), null), { first: 2, last: 4, days: 3 });     // a pause is a known day
	assert.deepEqual(stats.baby_period(shape("GB.gGG.BG"), null), { first: 2, last: 4, days: 3 });   // two periods: the longest
	assert.deepEqual(stats.baby_period(shape("GB.gG..BG"), null), { first: 6, last: 8, days: 3 });   // two as long: the latest
	// the choice among the periods: with a peak, the one that holds it, else the latest before it; else the longest, the latest of equals
	const days = shape("GGBGGGGBBBGGGBBBBGGG");
	assert.deepEqual(stats.baby_period(days, null), { first: 14, last: 17, days: 4 });
	assert.deepEqual(stats.baby_period(days, 9), { first: 8, last: 10, days: 3 });
	assert.deepEqual(stats.baby_period(days, 11), { first: 8, last: 10, days: 3 });
	assert.deepEqual(stats.baby_period(days, 2), { first: 14, last: 17, days: 4 });
	assert.deepEqual(stats.baby_period(shape("GGBBGGGBBG"), null), { first: 8, last: 9, days: 2 });
});

test("cycle stats: shares in percent, what a cycle filled in is told, runs of days", () => {
	assert.deepEqual([stats.percent(0, 29), stats.percent(29, 29), stats.percent(2, 29), stats.percent(1, 8)], [0, 100, 7, 13]);
	assert.deepEqual([stats.percent(1, 300), stats.percent(299, 300), stats.percent(3, 0)], [1, 99, 0]);   // never 0 or 100 when it is not
	const filled = (to_fill, total) => stats.filled_percent({ kinds: { to_fill }, total });
	assert.deepEqual([filled(0, 29), filled(2, 29), filled(1, 8), filled(1, 300), filled(300, 300)], [100, 93, 87, 99, 0]);
	assert.deepEqual([100, 99, 95, 94, 90, 89, 80, 79, 60, 59, 0].map(stats.fill_level), ["full", "95", "95", "90", "90", "80", "80", "60", "60", "low", "low"]);
	assert.deepEqual(stats.day_runs([3, 8, 9, 10, 12]), [{ first: 3, last: 3 }, { first: 8, last: 10 }, { first: 12, last: 12 }]);
	assert.deepEqual(stats.day_runs([]), []);
	// what is tapped to open the days to fill in: a run of two is two days, a longer run stays one
	assert.deepEqual(stats.todo_runs([3, 4, 8, 9, 10, 12, 20, 21, 22, 23]), [{ first: 3, last: 3 }, { first: 4, last: 4 }, { first: 8, last: 10 }, { first: 12, last: 12 }, { first: 20, last: 23 }]);
	assert.deepEqual(stats.todo_runs([32, 33]), [{ first: 32, last: 32 }, { first: 33, last: 33 }]);
	assert.deepEqual(stats.todo_runs([]), []);
});

test("cycle stats: the averages of the complete cycles before", () => {
	const starts = ["2026-05-01", "2026-04-03", "2026-03-06", "2026-02-06"];   // three cycles of 28 days before the latest
	const days = { "2026-04-16": { isPeak: true }, "2026-03-10": { isPeak: true }, "2026-03-20": { isPeak: true } };
	const before = stats.previous_cycles(starts, [], days, "2026-05-01");
	assert.equal(before.cycles, 3);
	assert.deepEqual(before.length, { count: 3, mean: 28, min: 28, max: 28 });
	assert.deepEqual(before.peak, { count: 2, mean: 14.5, min: 14, max: 15 });   // the latest peak of a cycle; one has none
	assert.deepEqual(before.after_peak, { count: 2, mean: 13.5, min: 13, max: 14 });
	assert.equal(stats.previous_cycles(starts, [], days, "2026-04-03").cycles, 2);   // only the cycles before
	const paused = stats.previous_cycles(starts, ["2026-03-25"], days, "2026-05-01");   // a cycle ended by a pause is not one
	assert.deepEqual([paused.cycles, paused.peak.count], [2, 1]);
	const first = stats.previous_cycles(starts, [], days, "2026-02-06");
	assert.deepEqual(first, { cycles: 0, length: null, peak: null, after_peak: null });
	const many = Array.from({ length: 10 }, (_, i) => dates.add_days("2026-09-01", -28 * i));
	assert.equal(stats.previous_cycles(many, [], {}, many[0]).cycles, stats.PREVIOUS_CYCLES);
});
