import { expect } from '@playwright/test'
import { SLACK, label, test } from './support/harness.ts'
import type { At } from './support/harness.ts'

/**
 * THE FOOT STANDS UNDER THE FIRST SCREEN ON A TELEPHONE AND A TABLET (owner, 25.11.2026, „1 potvrđujem", PENDING „Pregled performansi: 1 se radi").
 *
 * <p>Lighthouse 12 on a simulated telephone measured a layout shift of 0.18 on the front page, the calendar,
 * a profile and a competitor, and put all of it on `footer.shell__footer` (the limit for „dobro" is 0.10).
 * While a screen waits for its code and its data the main is short, the foot is held at the bottom of the
 * window by `#root` and is therefore IN the first screen, and when the content lands it is pushed out of it.
 * The cure is that the foot is never in the first screen on a screen that is short, so there is nothing to
 * push (`app/Shell.css`, `.shell__main`).
 *
 * <p>jsdom lays out nothing, so this is a measurement. It reads the shortest screen the portal has, the sign
 * in form with every answer a 404, which is what any screen looks like before its data has come:
 *
 * - **at 360 and 768px** the foot starts at or under the bottom edge of the window, not above it;
 * - **at both** the page does not move sideways.
 *
 * The other half, that from 1000px the main is as tall as its content again, is not asked of a browser: a
 * desktop that is not tall enough to scroll is a desktop the harness refuses to measure (a window with no
 * scrollbar is wider than any reader's), and a short screen is by definition one that does not scroll. It is
 * held in the stylesheet (`app/shellStyle.test.ts`).
 *
 * What it does not read is the shift itself, which `open` cannot see because it waits for the page to
 * settle: the number is Lighthouse's, and the property that makes it zero is this one.
 */

const ADDRESS = '/sr/prijava'
const READY = '.shell__footer'

const UNDER: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
]

for (const at of UNDER) {
  test(`the foot is not in the first screen of a short screen, at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, ADDRESS, READY, {})

    const seen = await page.evaluate(() => {
      const foot = document.querySelector('.shell__footer')

      if (foot === null) {
        throw new Error('nothing matches .shell__footer')
      }

      return { footTop: foot.getBoundingClientRect().top + scrollY, window: innerHeight }
    })

    expect(seen.footTop).toBeGreaterThanOrEqual(seen.window - SLACK)
    expect(probe.sideways).toBe(0)
  })
}
