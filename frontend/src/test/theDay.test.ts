import { realToday } from '../clock/context'
import { inYearlyWindow, seasonRunning } from '../data/season'
import { priceOn } from '../data/pricing'
import {
  theDayTheSuiteIsReadAs,
  THE_CLOCKS_OWN_TESTS,
  THE_DAY_THE_SUITE_IS_READ_AS,
  THE_OTHER_DAY_THE_SUITE_IS_READ_AS,
} from './theDay'

/* That the pinned day is really in force, which is the one thing the floor
 * cannot take on trust.
 *
 * The floor itself is a replacement made in `test/setup.ts`: every test outside
 * `src/clock/**` is handed a day somebody chose instead of the day the machine is
 * on. Take the replacement away, or widen its exception until it covers this file
 * too, and the suite would go on looking exactly as green as before - which is
 * the shape of every accident this was written to end.
 *
 * **THE MACHINE CANNOT SATISFY THIS, and that is the whole point.** The gate reads
 * the suite as TWO days (`theDay.ts`) and the machine is on one, so a real clock
 * can agree with at most one of the two passes and is red in the other, by name,
 * on every day of the year. A single pinned day would have left this passing by
 * luck once a year; the pair is what makes it a floor.
 */
describe('every test on the portal is read as a day somebody chose', () => {
  it('hands the portal that day and not the one the machine happens to be on', () => {
    expect(realToday()).toBe(theDayTheSuiteIsReadAs())
  })

  /* And that the exception is a place rather than a mood: it names the clock's
     own folder and nothing else, so a file put next to this one cannot reach the
     machine by being called something clock-like. */
  it('lets nothing but the clock its own tests are about through', () => {
    expect(THE_CLOCKS_OWN_TESTS.test('/home/x/frontend/src/clock/clock.test.tsx')).toBe(true)
    expect(THE_CLOCKS_OWN_TESTS.test('C:\\btl\\frontend\\src\\clock\\clock.test.tsx')).toBe(true)
    expect(THE_CLOCKS_OWN_TESTS.test('/home/x/frontend/src/pages/clockish.test.tsx')).toBe(false)
    expect(THE_CLOCKS_OWN_TESTS.test('/home/x/frontend/src/test/theDay.test.ts')).toBe(false)
  })
})

/* That the two days are not just two different strings but sit on opposite
 * sides of everything a screen decides by day, which the two-pass gate takes
 * on trust and cannot check by itself: a case whose outcome does not truly
 * depend on the day would pass in both passes all the same, and the only way
 * to see that is to ask the portal's own functions what each day means - the
 * same four boundaries `theDay.ts` names above (ADL, 21.09.2026): the yearly
 * window, the league season, the price period and the year itself.
 *
 * A property of the pair, not a list of the two dates. Asserting the dates
 * themselves ("one is 2026, the other 2027") would go stale the moment either
 * constant moves, and would say nothing about whether the pair still does its
 * job; what has to keep holding, whatever either constant is ever changed to,
 * is that the two land on opposite sides of each boundary below.
 */
describe('the two days the suite is read as sit on opposite sides of everything a screen decides by day', () => {
  it('fall in different years', () => {
    expect(THE_DAY_THE_SUITE_IS_READ_AS.slice(0, 4)).not.toBe(THE_OTHER_DAY_THE_SUITE_IS_READ_AS.slice(0, 4))
  })

  it('disagree on whether the yearly window is open', () => {
    expect(inYearlyWindow(THE_DAY_THE_SUITE_IS_READ_AS)).toBe(false)
    expect(inYearlyWindow(THE_OTHER_DAY_THE_SUITE_IS_READ_AS)).toBe(true)
  })

  it('disagree on whether a season of the league is running', () => {
    expect(seasonRunning(THE_DAY_THE_SUITE_IS_READ_AS)).toBeNull()
    expect(seasonRunning(THE_OTHER_DAY_THE_SUITE_IS_READ_AS)).not.toBeNull()
  })

  it('fall in different price periods', () => {
    expect(priceOn(THE_DAY_THE_SUITE_IS_READ_AS).key).not.toBe(priceOn(THE_OTHER_DAY_THE_SUITE_IS_READ_AS).key)
  })
})
