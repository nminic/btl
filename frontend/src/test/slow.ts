/**
 * How long a case that draws a whole screen and then walks it is given.
 *
 * **Why it is not the default.** The gate went red on 28.08.2026 on a branch that
 * touched none of the code the failing case reads: one case timed out at five
 * seconds, which is what Vitest gives by default. It was not slow by accident.
 * Measured under the very command the gate runs (`npm run test:coverage`, the
 * whole suite in one pass, on the machine this was written on), twenty three cases
 * take over two seconds and the slowest takes 5,7. The runner is about half again
 * slower than that machine, a figure derived two ways: from the four league cases
 * the gate reported (3,6 / 3,7 / 4,6 / 5,1 seconds against 2,4 / 2,7 / 3,1 / 3,6
 * here), and from a note in `pages/publicScreens.test.tsx` that had already
 * measured it. So a case at three and a half seconds here is at five on the
 * runner, and everything above two seconds here is close enough to the edge that a
 * busy runner tips it over.
 *
 * **Why not raise Vitest's own default instead.** A default long enough for the
 * slowest case in the repo is a default that lets a hung case run for twenty
 * seconds before saying so, over two thousand two hundred cases that finish in
 * milliseconds. The portal already answered this the same way in nine places
 * (`adminEntities` twice, `adminFlows`, `Home`, `memberFlows`, `eventActions`
 * three times, `publicScreens`), which is the practice ADL A2 records: the default
 * stays where it is and a case that really waits carries its own number.
 *
 * **But Testing Library's default is raised**, in `test/setup.ts`, and that is a
 * different clock rather than the same one twice. A case has two: Vitest gives the
 * case five seconds, and Testing Library gives each `findBy` one, and it is the
 * second that runs out first on anything that draws a whole screen. Measured by a
 * review on 28.08.2026 on an untouched tree, in one full pass of the gate out of
 * three: a case failed at 1.314 milliseconds with „Unable to find role=table" while
 * the case it sat in had twenty seconds to spare. Raising the case's clock without
 * that one is raising the wrong one.
 *
 * **One home rather than a number typed into each file**, because it is one fact
 * about one runner, and the nine copies that were here disagreed in three
 * different values (10, 15 and 20 seconds), one of them in a file that also
 * imported this constant (ADL A31). All nine read this now, except one in
 * `pages/adminFlows.test.tsx`, which another change holds and which is recorded in
 * `btl-produkt/PENDING.md`.
 *
 * Twenty seconds is room for a runner nearly four times slower than the one that
 * failed, and no more.
 */
export const SLOW = 20_000

/**
 * How long a case is given when it does not draw one screen but walks through several.
 *
 * **`SLOW` is one screen's worth**, and everything measured above it is one screen's: a case
 * that draws a page and reads it. A case that presses on through four or five pages pays that
 * cost once per page, so what it needs is a multiple rather than a bigger single screen figure.
 * Twice, so the number keeps one home and is derived rather than typed out a second time
 * (ADL A31). Vitest's own default stays where it is, which ADL A2 keeps as a performance budget:
 * a case that stays on one screen and is slow is exactly what that budget exists to show.
 *
 * **Which cases carry it is measured, not felt.** A case walks if it leaves the screen it
 * started on, and that is read off the heading of the screen while the case runs rather than out
 * of the source, across all 2933 cases of the suite on 21.09.2026.
 *
 * In the two files this was written for the split is now exact: every walk carries this and no
 * single screen case does, nine of fifty seven in `memberFlows.test.tsx` and fourteen of twenty
 * six in `event/eventActions.test.tsx`. Only three of each were marked before, and the unmarked
 * ones were the ones sitting closest to red: under sixty processes burning the processor
 * `eventActions > keeps the structure` reached 4999 ms against the default 5000, while the
 * marked case in the same file used 14647 of its 20000. So the clock had been handed out to
 * whichever case had gone red once, rather than to the kind of case that needs it.
 *
 * **It is not exact anywhere else, and that is left alone rather than claimed.**
 * `teamInvite.test.tsx` carries this on two cases that never leave their screen (217 and 170 ms),
 * which came with the change that introduced the constant. Across the whole suite the rule does
 * not hold at all: twenty three files hold a walk on the default clock and twenty one hold a
 * single screen case on a raised one. Measured and written down in the pull request, not swept
 * up here, because that is a change to files this one has no reason to touch.
 *
 * Named for what separates these cases from the one screen case `SLOW` was written for, and not
 * `WALKED`, which `member/oneQuestion.test.tsx` already uses for a list of screens.
 */
export const SEVERAL_SCREENS = SLOW * 2
