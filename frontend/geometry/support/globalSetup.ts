import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Every file in `geometry/` is a guard that runs, and nothing that is not one is left there.
 *
 * Two runners read this repository and they are kept apart by name: Vitest collects
 * `*.test.ts` and `*.spec.ts` anywhere (`**\/*.{test,spec}.?(c|m)[jt]s?(x)`, its own default), and
 * Playwright collects `*.geometry.ts` here and nothing else (`playwright.config.ts`). A guard
 * named in any third way would be collected by NEITHER and would never run, with every gate
 * green, so a file in this folder that does not end in `.geometry.ts` stops the run by name.
 * What supports a guard lives in `geometry/support/`, which this does not read.
 */
export default function globalSetup(): void {
  const here = fileURLToPath(new URL('..', import.meta.url))
  const strays = readdirSync(here, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.endsWith('.geometry.ts'))
    .map((entry) => entry.name)

  if (strays.length > 0) {
    throw new Error(
      `geometry/ holds ${strays.join(', ')}, which no runner collects: a guard is named *.geometry.ts, and what supports one lives in geometry/support/`,
    )
  }
}
