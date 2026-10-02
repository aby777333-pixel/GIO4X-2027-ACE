// Unit tests for src/lib/blog-calendar.ts (the editorial calendar's months, days and grid, in UTC).
// Run: node --test scripts/test-blog-calendar.mjs      (Node 22.18 or later: it reads the TypeScript file directly)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayKeyOf,
  dayKeyOfIso,
  dayLabel,
  dayShortLabel,
  isCalendarMonth,
  isDayKey,
  isPastDay,
  lastMonth,
  monthGrid,
  monthKeyOf,
  monthLabel,
  readMonth,
  shiftMonth,
  timeOfIso,
  weeksOf,
} from "../src/lib/blog-calendar.ts";

const NOW = Date.UTC(2026, 9, 3, 14, 30); // Saturday 3 October 2026, 14:30 UTC

test("keys are UTC, whatever the machine's time zone", () => {
  assert.equal(monthKeyOf(NOW), "2026-10");
  assert.equal(dayKeyOf(NOW), "2026-10-03");
  // one minute before midnight UTC is still that UTC day
  assert.equal(dayKeyOf(Date.UTC(2026, 9, 31, 23, 59)), "2026-10-31");
  assert.equal(dayKeyOfIso("2026-11-01T00:00:00+00:00"), "2026-11-01");
  // a time written with an offset lands on its UTC day
  assert.equal(dayKeyOfIso("2026-11-01T01:00:00+03:00"), "2026-10-31");
  assert.equal(timeOfIso("2026-11-01T01:00:00+03:00"), "22:00");
  assert.equal(dayKeyOfIso(null), "");
  assert.equal(dayKeyOfIso("not a time"), "");
  assert.equal(timeOfIso(""), "");
});

test("the month in the query string is validated", () => {
  assert.equal(readMonth("2026-12", NOW), "2026-12");
  assert.equal(readMonth("2020-01", NOW), "2020-01");
  assert.equal(readMonth(lastMonth(NOW), NOW), "2031-10");
  for (const bad of ["", "2026-13", "2026-00", "2026-1", "26-10", "2019-12", "2031-11", "2026-10-01", "2026-10 ", "x2026-10", "../etc", "２０２６-10"]) {
    assert.equal(readMonth(bad, NOW), "2026-10", `"${bad}" falls back to the current month`);
    assert.equal(isCalendarMonth(bad, NOW), false);
  }
  assert.equal(isCalendarMonth(undefined, NOW), false);
  assert.equal(isCalendarMonth(202610, NOW), false);
});

test("previous and next month, across a year and at the ends", () => {
  assert.equal(shiftMonth("2026-10", 1, NOW), "2026-11");
  assert.equal(shiftMonth("2026-12", 1, NOW), "2027-01");
  assert.equal(shiftMonth("2026-01", -1, NOW), "2025-12");
  assert.equal(shiftMonth("2020-01", -1, NOW), null);
  assert.equal(shiftMonth("2031-10", 1, NOW), null);
  assert.equal(shiftMonth("nonsense", 1, NOW), null);
});

test("a real day, and a day that has passed", () => {
  assert.equal(isDayKey("2026-10-03"), true);
  assert.equal(isDayKey("2028-02-29"), true);
  assert.equal(isDayKey("2026-02-29"), false);
  assert.equal(isDayKey("2026-02-31"), false);
  assert.equal(isDayKey("2026-10-3"), false);
  assert.equal(isDayKey(null), false);
  assert.equal(isPastDay("2026-10-02", NOW), true);
  assert.equal(isPastDay("2026-10-03", NOW), false, "today is not past");
  assert.equal(isPastDay("2026-10-04", NOW), false);
  assert.equal(isPastDay("2025-12-31", NOW), true);
});

test("October 2026: Thursday the 1st, five weeks from Monday 28 September to Sunday 1 November", () => {
  const grid = monthGrid("2026-10");
  assert.ok(grid);
  assert.equal(grid.days.length, 35);
  assert.equal(grid.days[0], "2026-09-28");
  assert.equal(grid.days[3], "2026-10-01");
  assert.equal(grid.days[34], "2026-11-01");
  assert.equal(grid.from, "2026-09-28T00:00:00.000Z");
  assert.equal(grid.to, "2026-11-02T00:00:00.000Z");
  const weeks = weeksOf(grid.days);
  assert.equal(weeks.length, 5);
  assert.ok(weeks.every((w) => w.length === 7));
});

test("every month of ten years is whole weeks, Monday to Sunday, and contains each of its days once", () => {
  for (let year = 2020; year <= 2031; year++) {
    for (let month = 1; month <= 12; month++) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const grid = monthGrid(key);
      assert.ok(grid);
      assert.equal(grid.days.length % 7, 0, key);
      assert.ok(grid.days.length >= 28 && grid.days.length <= 42, key);
      assert.equal(new Date(`${grid.days[0]}T00:00:00Z`).getUTCDay(), 1, `${key} starts on a Monday`);
      assert.equal(new Date(`${grid.days[grid.days.length - 1]}T00:00:00Z`).getUTCDay(), 0, `${key} ends on a Sunday`);
      const inMonth = grid.days.filter((d) => d.startsWith(key));
      assert.equal(inMonth.length, new Date(Date.UTC(year, month, 0)).getUTCDate(), key);
      assert.equal(new Set(grid.days).size, grid.days.length, key);
      assert.deepEqual([...grid.days].sort(), grid.days, key);
      // the first and last weeks each hold at least one day of the month
      assert.ok(grid.days.slice(0, 7).some((d) => d.startsWith(key)), key);
      assert.ok(grid.days.slice(-7).some((d) => d.startsWith(key)), key);
    }
  }
  assert.equal(monthGrid("2026-13"), null);
});

test("a February that starts on a Monday in a common year is exactly four weeks", () => {
  const grid = monthGrid("2021-02");
  assert.ok(grid);
  assert.equal(grid.days.length, 28);
  assert.equal(grid.days[0], "2021-02-01");
});

test("labels", () => {
  assert.equal(monthLabel("2026-10"), "October 2026");
  assert.equal(dayLabel("2026-10-14"), "Wednesday 14 October 2026");
  assert.equal(dayShortLabel("2026-10-14"), "Wed 14 Oct");
  assert.equal(dayLabel("2026-02-31"), "");
  assert.equal(monthLabel("soon"), "");
});
