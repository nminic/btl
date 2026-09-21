import { realToday } from '../clock/context'
import { theDayTheSuiteIsReadAs, THE_CLOCKS_OWN_TESTS } from './theDay'

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
