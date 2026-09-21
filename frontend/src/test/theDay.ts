/**
 * THE DAY THE WHOLE SUITE IS READ AS, and the one other day it is read as again.
 *
 * **Why this exists at all, measured and not supposed.** Two cases went red on
 * 1 October 2026 without a line of code changing: they never said what day they
 * were being read as, so they read the machine's, and the portal shuts the
 * referral amount from 1 October (`data/season.ts`). Measured in isolation, twice
 * each and identically: on the real clock 174/174 and exit 0, pinned to
 * `2026-09-30` 174/174 and exit 0, pinned to `2026-10-01` 173/174 and exit 1. A
 * deterministic crossing, not noise - and nothing in the gate could see it coming,
 * because the gate ran on whatever day it happened to be run.
 *
 * **The floor, and it is one function rather than a list.** `clock/context.ts`
 * holds the single reader of the machine's clock and `clock/oneClock.test.ts`
 * holds that over the source, so pinning that one function pins every screen at
 * once: the 955 `renderAt` calls are untouched, and no list of file names has to
 * be kept right. `test/setup.ts` replaces it with this, and the gate runs the
 * suite a second time with `BTL_THE_OTHER_DAY` set.
 *
 * **Why TWO days and not one.** One pinned day would only move the accident: a
 * case that says nothing about the day would go on passing or failing by luck,
 * just by a luck that no longer changes. Two days a season and a year apart make
 * the luck measurable - a case whose outcome turns on the day now disagrees with
 * itself between the two passes and is red in one of them, by name, on every day
 * of the year. That is the whole of the floor: not „nobody reads the clock" but
 * „nothing on the portal is decided by which day the machine happens to be on".
 */

/**
 * The day by default, and the day this portal is written against.
 *
 * 30 September 2026 is the last day before every window of the year opens
 * (`data/season.ts`, `WINDOW_OPENS`): renewal shut, transfers shut, the referral
 * amount still settable, no season of the league running yet, and the base price
 * period still the one in force. It is the day the tests that DO pin already name
 * on the open side of that boundary (`pages/adminFlows.test.tsx`,
 * `data/season.test.ts`), so the suite goes on being read as the day it was
 * written for rather than as the day it is run on.
 */
export const THE_DAY_THE_SUITE_IS_READ_AS = '2026-09-30'

/**
 * And the other day, which is on the far side of everything the first one is
 * near.
 *
 * 1 November 2027 is inside the yearly window rather than before it, so renewal
 * and transfers are open and the referral amount is settled; it is a season the
 * league actually runs rather than the year before the first one (`FIRST_SEASON`);
 * it is the „regular" price period rather than the base one; and it is a
 * different YEAR, which is what catches a case that asks the machine for the year
 * itself rather than asking the portal what day it is.
 */
export const THE_OTHER_DAY_THE_SUITE_IS_READ_AS = '2027-11-01'

/**
 * Which of the two this pass is being read as.
 *
 * A flag rather than a date in the environment, so that both days stay written
 * down here and the second pass carries no date of its own to keep right
 * (`vitest.anotherDay.config.ts` sets nothing but the flag).
 */
export function theDayTheSuiteIsReadAs(): string {
  return process.env.BTL_THE_OTHER_DAY === '1'
    ? THE_OTHER_DAY_THE_SUITE_IS_READ_AS
    : THE_DAY_THE_SUITE_IS_READ_AS
}

/**
 * The clock's own tests, which are the one thing this must not reach.
 *
 * Their subject IS the machine's clock: `clock/clock.test.tsx` moves the system
 * time and asks the portal to follow it over midnight, and a pinned day would
 * make it follow nothing while still passing every assertion that compares the
 * screen with `realToday()`. Excluded because it measures the very thing, not to
 * make it green - remove this and that file goes red, which is how it is kept
 * honest.
 */
export const THE_CLOCKS_OWN_TESTS = /[\\/]src[\\/]clock[\\/]/
