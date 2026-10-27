// The pure models: dates, FertilityCare notation, descriptions, days, cycles. No DOM, no storage.
import test from "node:test";
import assert from "node:assert/strict";
import * as dates from "/js/model/dates.js";
import { parse_fc_note, fc_score_to_codified, fc_score_from_api, fc_note_regex } from "/js/model/fc_notation.js";
import { description_from_api, resolve, exists, of_day, to_day_fields } from "/js/model/descriptions.js";
import { day_from_api, day_to_api, blank_day, is_blank, day_from_body, stamp_from_api } from "/js/model/day.js";
import * as cycles from "/js/model/cycles.js";

test("dates", () => {
	assert.equal(dates.str(dates.parse("2026-03-09")), "2026-03-09");
	assert.equal(dates.parse("2026-03-09").getHours(), 9);
	assert.equal(dates.days_between("2026-02-28", "2026-03-02"), 2);
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
