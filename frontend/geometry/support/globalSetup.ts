import { readdirSync } from 'node:fs'
import { relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Every file in `geometry/`, at any depth, is a guard that runs, and nothing that is not one is
 * left there. Only `support/` is read as something else.
 *
 * Two runners read this repository and they are kept apart by name: Vitest collects
 * `*.test.ts` and `*.spec.ts` anywhere (`**\/*.{test,spec}.?(c|m)[jt]s?(x)`, its own default), and
 * Playwright collects `*.geometry.ts` here and nothing else (`playwright.config.ts`; a pattern
 * with no slash is matched against the name of a file at any depth). A guard named in any third
 * way would be collected by NEITHER and would never run, with every gate green, so a file in this
 * folder, or in a folder below it, that does not end in `.geometry.ts` stops the run by name. The
 * walk is recursive: `geometry/extra/month.ts` holding a case that always fails ended in 28 passed
 * and exit code 0 when only the top of the folder was read (review of PR 501). What supports a
 * guard lives in `geometry/support/`, which this does not read.
 */
export default function globalSetup(): void {
  const here = fileURLToPath(new URL('..', import.meta.url))
  const strays = readdirSync(here, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && !entry.name.endsWith('.geometry.ts'))
    .map((entry) => relative(here, `${entry.parentPath}${sep}${entry.name}`).split(sep).join('/'))
    .filter((path) => !path.startsWith('support/'))

  if (strays.length > 0) {
    throw new Error(
      `geometry/ holds ${strays.join(', ')}, which no runner collects: a guard is named *.geometry.ts, and what supports one lives in geometry/support/`,
    )
  }
}
