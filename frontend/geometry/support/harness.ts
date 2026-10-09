/**
 * WHAT EVERY GUARD THAT ASKS CHROME WHERE SOMETHING STANDS IS GIVEN (ADL A63, 22.09.2026).
 *
 * Owner: „U frontend paket se uvodi pregledač za testove (Playwright), i to usko: samo za tvrdnje
 * o tome gde nešto stvarno stoji na ekranu." So a guard here asks only what jsdom cannot answer: a
 * box, what stands at a point, where a press lands, whether the page moves sideways, and how all of
 * that behaves at 200% text. Roles, names, text, order in the document and the behaviour of a form
 * stay with vitest and are not asked again here.
 *
 * **The shape is the one `scripts/header-panels-geometry.mjs` measured by hand**, taken over with
 * the checks that kept it honest, so that a run which did not measure what it claims stops and says
 * so instead of passing:
 *
 * - **The real bundle and the real stylesheet.** The built `dist` is served by a server of this
 *   worker's own, on a port the system picks (port 0), so no run can find another run's server and
 *   no fixed number is shared with anything. Chrome is driven over a pipe (Playwright's own
 *   `--remote-debugging-pipe`), so it takes no port either.
 * - **`/api` is answered inside the browser** (`route`), by each guard with exactly the records it
 *   is about. `GET /api/me` answers 401, a visitor, unless a guard says otherwise; anything nobody
 *   answered is a 404, and the server says the same if a request ever gets past the browser.
 * - **Phones and tablets are emulated as such** (`isMobile` under 1000px), so the scrollbar is drawn
 *   over the page as on a telephone and `innerWidth` is the width asked for (PDL P24); from 1000px
 *   the screen is a desktop and keeps its scrollbar. **That needs saying, because Playwright takes
 *   the scrollbar away by default** (`--hide-scrollbars` with every headless browser): measured
 *   09.10.2026, a desktop page 1280px wide under `scrollbar-gutter: stable` (`src/index.css`) is
 *   1280px wide inside with it and 1265px without it. The portal reserves that gutter on purpose
 *   (ADL A26), so a desktop is measured with it (`playwright.config.ts`).
 * - **200% text is the reader's default font size**, set through the browser and never on the root
 *   (ADL A34, 05.09.2026: doubling the root doubles every `rem` and leaves a media query in `em`
 *   where it was, which no reader can produce). Measured 09.10.2026: `Page.setFontSizes` at 32px
 *   draws the root at 32px and moves a query in `em` with it, and keeps doing so across a
 *   navigation. Each page is checked before a number is read off it.
 * - **The clock is pinned** to the day the vitest suite is read as (`src/test/theDay.ts`), one
 *   project per day (`playwright.config.ts`). `clock/oneClock.test.ts` sweeps `src` and cannot see
 *   this folder, so the pinning is checked on the page itself and not assumed (ADL A33,
 *   21.09.2026: „Nijedan test portala ne čita mašinski sat").
 * - **The pointer is parked in the corner of the page** before anything is read, and the page is
 *   waited on until it stops moving (`getAnimations`), as the hand-run script does.
 *
 * **A check that fails throws `NOT MEASURED`** and never reaches an assertion: a width the browser
 * did not take, a text size that did not move the queries, a day that is not the pinned one, a
 * desktop with no scrollbar. That outcome is not a pass and not a caught fault either, and the
 * message says which.
 *
 * **Always run through `npm run geometry`, which builds first.** Measured against a `dist` that
 * was built before an edit, a change to a stylesheet is never seen, and a mutation reads as one
 * nothing guards: the same false green as `Nothing to compile` over an untranslated class
 * (`btl/CLAUDE.md`). The gate is `.github/workflows/verify.yml`, which builds in the step before.
 * On a machine shared with other agents pass Playwright's own `--workers=4` rather than a number
 * kept here, for the reason `vite.config.ts` gives about Vitest's.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { THE_DAY_THE_SUITE_IS_READ_AS } from '../../src/test/theDay.ts'

/** Where `npm run build` puts the portal, which is what is measured. */
export const DIST = fileURLToPath(new URL('../../dist/', import.meta.url))

/** Half a pixel, because a box is measured in fractions of one (the hand-run script's slack). */
export const SLACK = 0.5

/** The text size a guard is read at: the browser's own, or the reader's 200%. */
export type Text = 100 | 200

/** One screen to measure: how wide, at what text size, and in which theme. */
export type At = { width: number; text: Text; theme?: 'light' | 'dark' }

/** What `/api` answers with 200, by path. Everything else is a 404, and `/api/me` a 401. */
export type Answers = Readonly<Record<string, unknown>>

/** What every page was checked for before a guard read it, kept for the guards that hold it. */
export type Probe = {
  /** How much wider than asked the page became: a phone makes the layout viewport as wide as
   *  whatever runs off its right edge, so a page pushed sideways grows instead of scrolling. */
  widened: number
  /** How far the page scrolls sideways. */
  sideways: number
}

export type Geometry = {
  /** The day the page is read as, set per project (`playwright.config.ts`). */
  theDay: string
  /** Opens `path` on a screen of its own and waits for `ready`, something only that screen has. */
  open: (at: At, path: string, ready: string, answers: Answers) => Promise<{ page: Page; probe: Probe }>
}

type Worker = {
  /** Where this worker's server for the built portal listens. */
  portal: string
}

/** What a run that measured nothing says, so it can never be read as a pass or as a catch. */
export const notMeasured = (why: string) => new Error(`NOT MEASURED: ${why}`)

/** A name for a screen, in the title of every case read on it. */
export const label = (at: At) => `${at.width}px, text ${at.text}%${at.theme === 'dark' ? ', dark' : ''}`

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.webmanifest': 'application/manifest+json',
}

/** Waits for `ready`, something only the screen being measured has, then for the page to stop
 *  moving, and parks the pointer. Asked again after every navigation back to a screen. */
export async function settle(page: Page, ready: string): Promise<void> {
  await page.locator(ready).first().waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForFunction(
    () => document.readyState === 'complete' && document.getAnimations().length === 0,
    undefined,
    { timeout: 15_000 },
  )
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  /* A pointer left over a control lifts or repaints it, which is read as a pixel that is not the
     page's (`scripts/header-panels-geometry.mjs`). */
  await page.mouse.move(1, 1)
}

export const test = base.extend<Geometry, Worker>({
  theDay: [THE_DAY_THE_SUITE_IS_READ_AS, { option: true }],

  portal: [
    /* The second parameter is Playwright's `use`, named otherwise because the React rules this
       repository lints with read any call of `use` as React's own hook. */
    async ({ browserName }, provide) => {
      /* Chrome is the browser the owner decided on, and the only one this measures in. */
      if (browserName !== 'chromium') {
        throw notMeasured(`the geometry is measured in Chrome and this run drives ${browserName}`)
      }

      if (!existsSync(join(DIST, 'index.html'))) {
        throw notMeasured(`nothing is built in ${DIST}; \`npm run geometry\` builds before it measures`)
      }

      const server = createServer((request, response) => {
        const url = new URL(request.url ?? '/', 'http://portal')

        if (url.pathname.startsWith('/api/')) {
          response.writeHead(404, { 'content-type': 'application/json', 'cache-control': 'no-store' })
          response.end('{}')

          return
        }

        let file = join(DIST, decodeURIComponent(url.pathname))

        if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
          file = join(DIST, 'index.html')
        }

        response.writeHead(200, {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        })
        response.end(readFileSync(file))
      })

      await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))

      const address = server.address()

      if (address === null || typeof address === 'string') {
        server.close()
        throw notMeasured('the server for the built portal took no port')
      }

      await provide(`http://127.0.0.1:${address.port}`)

      server.closeAllConnections()
      await new Promise<void>((done) => server.close(() => done()))
    },
    { scope: 'worker' },
  ],

  open: async ({ browser, portal, theDay }, provide) => {
    const contexts: BrowserContext[] = []

    await provide(async (at, path, ready, answers) => {
      const context = await browser.newContext({
        viewport: { width: at.width, height: 900 },
        deviceScaleFactor: 1,
        isMobile: at.width < 1000,
        colorScheme: at.theme ?? 'light',
      })

      contexts.push(context)

      await context.route('**/api/**', (route) => {
        const asked = new URL(route.request().url()).pathname

        return Object.hasOwn(answers, asked)
          ? route.fulfill({ status: 200, json: answers[asked] })
          : route.fulfill({ status: asked === '/api/me' ? 401 : 404, json: {} })
      })

      const page = await context.newPage()

      if (at.text !== 100) {
        const devtools = await context.newCDPSession(page)

        await devtools.send('Page.setFontSizes', {
          fontSizes: { standard: (16 * at.text) / 100, fixed: (13 * at.text) / 100 },
        })
      }

      await page.clock.setFixedTime(new Date(`${theDay}T12:00:00Z`))
      await page.goto(`${portal}${path}`)
      await settle(page, ready)

      const seen = await page.evaluate((width) => {
        const root = document.documentElement

        return {
          innerWidth,
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          rootFont: Number.parseFloat(getComputedStyle(root).fontSize),
          /* A query in `em` a third of the way under this width at 16px and a third of the way
             over it at 32px, so one text size cannot be read as the other at any width (the
             hand-run script's `probeAt`). */
          emQuery: matchMedia(`(min-width: ${width / 24}em)`).matches,
          day: new Date().toISOString().slice(0, 10),
          dark: matchMedia('(prefers-color-scheme: dark)').matches,
        }
      }, at.width)

      if (seen.innerWidth < at.width) {
        throw notMeasured(`the browser was asked for ${at.width}px and gave ${seen.innerWidth}px`)
      }

      if (seen.rootFont !== (16 * at.text) / 100 || seen.emQuery !== (at.text === 100)) {
        throw notMeasured(
          `asked for text at ${at.text}%, the page draws its root at ${seen.rootFont}px and a query in em answers ${seen.emQuery}; a text size that did not take is not a measurement`,
        )
      }

      if (seen.day !== theDay) {
        throw notMeasured(`the page reads the day as ${seen.day} and not as ${theDay}: the clock is not pinned`)
      }

      if (seen.dark !== (at.theme === 'dark')) {
        throw notMeasured(`asked for the ${at.theme ?? 'light'} theme and the page answers dark: ${seen.dark}`)
      }

      if (at.width >= 1000 && seen.innerWidth - seen.clientWidth <= 0) {
        throw notMeasured(
          `a desktop ${at.width}px wide drew no scrollbar, so its boxes are as wide as no reader's: Playwright's --hide-scrollbars is back on`,
        )
      }

      return {
        page,
        probe: {
          widened: seen.innerWidth - at.width,
          sideways: Math.max(0, seen.scrollWidth - seen.clientWidth),
        },
      }
    })

    for (const context of contexts) {
      await context.close()
    }
  },
})
