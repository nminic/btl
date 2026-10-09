import { defineConfig } from '@playwright/test'
import { THE_DAY_THE_SUITE_IS_READ_AS, THE_OTHER_DAY_THE_SUITE_IS_READ_AS } from './src/test/theDay.ts'
import type { Geometry } from './geometry/support/harness.ts'

/**
 * The browser for the guards about where things stand on the screen (ADL A63, 22.09.2026), and
 * nothing else: the rest of the suite is Vitest and jsdom and stays there.
 *
 * **Chrome as it is installed, and no browser downloaded** (`channel: 'chrome'`). Playwright finds
 * it where Google installs it, which is where the GitHub runner has it as well (Google Chrome
 * from Google's own package, `ubuntu-24.04`), so the run measures the browser a reader has and
 * not one kept for tests. Measured 09.10.2026: Chrome 154 on this machine, driven by Playwright,
 * no download. `npx playwright install` is never part of this.
 *
 * **The scrollbar is kept** (`--hide-scrollbars` taken out of Playwright's defaults): the portal
 * reserves its gutter on a desktop (`scrollbar-gutter: stable`, ADL A26), and without the
 * scrollbar a desktop is measured 15px wider than any reader's (`geometry/support/harness.ts`).
 *
 * **Two projects, the two days the vitest suite is read as** (`src/test/theDay.ts`; ADL A33,
 * 21.09.2026), so a guard whose outcome turns on the day disagrees with itself by name.
 *
 * **Coverage is not measured here and its threshold does not move** (ADL A63: „Prag pokrivenosti
 * se ovim ne menja"): it is measured over `src/**` by Vitest, and `geometry/` is outside it.
 */
export default defineConfig<Geometry>({
  testDir: './geometry',
  testMatch: '*.geometry.ts',
  outputDir: './test-results',
  globalSetup: './geometry/support/globalSetup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  /* A guard that passes on its second try is a guard that failed: no retries. */
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    channel: 'chrome',
    headless: true,
    launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off',
  },
  projects: [
    { name: 'the-day', use: { theDay: THE_DAY_THE_SUITE_IS_READ_AS } },
    { name: 'the-other-day', use: { theDay: THE_OTHER_DAY_THE_SUITE_IS_READ_AS } },
  ],
})
