import { mergeConfig } from 'vitest/config'
import base from './vite.config.ts'

/**
 * The same suite, read as another day.
 *
 * The second half of the floor that keeps the portal's tests off the machine's
 * clock. `src/test/setup.ts` hands every test outside `src/clock/**` a day
 * somebody chose rather than the day the gate happens to run on; this pass hands
 * it the OTHER one, a season and a year away (`src/test/theDay.ts`). A case whose
 * outcome turns on the day therefore disagrees with itself between the two
 * passes and is red in one of them, by name, on every day of the year.
 *
 * **A flag and not a date.** Both days stay written down in `src/test/theDay.ts`,
 * so this file carries nothing that could drift away from them and nothing that
 * has to be kept right when one of them moves.
 *
 * **No coverage here.** It is the same suite over the same lines; the thresholds
 * are measured once, in the pass beside this one, and paying for the
 * instrumentation twice would buy nothing.
 *
 * **What this file cannot prove about itself.** That `BTL_THE_OTHER_DAY` really
 * reaches the process is not something a test running inside either pass can
 * see: from inside, a pass where the flag silently failed to arrive reads
 * exactly like a correct pass on THE_DAY, and nothing in that pass says which
 * one it is. Only comparing the two passes' recorded results from outside
 * catches that, and nothing here does it yet (`btl-produkt/PENDING.md`,
 * 21.09.2026, recorded as a boundary rather than guarded).
 */
export default mergeConfig(base, {
  test: { env: { BTL_THE_OTHER_DAY: '1' } },
})
