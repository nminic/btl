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
 * **Why not raise the default instead.** A default long enough for the slowest
 * case in the repo is a default that lets a hung case run for twenty seconds
 * before saying so, over two thousand two hundred cases that finish in
 * milliseconds. The portal already answers this the same way in eight places
 * (`adminEntities`, `adminFlows`, `Home`, `memberFlows`, `eventActions`,
 * `publicScreens`), which is the practice ADL A2 records: the default stays where
 * it is and a case that really waits carries its own number.
 *
 * **One home rather than a number typed into each file**, because it is one fact
 * about one runner, and eight copies of it would be eight chances to disagree
 * about what the runner costs (ADL A31).
 *
 * Twenty seconds is room for a runner nearly four times slower than the one that
 * failed, and no more.
 */
export const SLOW = 20_000
