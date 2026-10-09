/**
 * Where the date row of the copy of an event lands, measured in a real browser.
 *
 * jsdom applies no stylesheet and computes no layout, so no rendered test can say where a
 * box stands, and that is where this fault lived: at 360px with the text at 200% the three
 * buttons beside the date asked for more than the row had, the date box was squeezed to
 * 50px (no date can be read in it) and the page scrolled sideways by 13px, while every test
 * of the picker was green. `src/forms/datePickerStyle.test.ts` holds what the stylesheet
 * SAYS about the row and `src/forms/DatePicker.test.tsx` holds the markup it is written
 * against, both in the gate; this asks where the boxes then LAND, which is the question
 * ADL A33 (29.08.2026) says is a browser's: a guard over the text may claim where something
 * is written, and which rule wins and where a box ends up are computed by the browser.
 *
 * Run by hand, not in the gate, because the browser the owner decided on in ADL A63
 * (22.09.2026) is not in the package yet and this is the stand-in until it is, in the shape
 * `scripts/header-panels-geometry.mjs` already has. It is run from `frontend/` over a build:
 *
 *     npm run build
 *     node scripts/date-row-geometry.mjs
 *
 * and no line for it is added to `package.json`, which is held by the item that brings the
 * browser. `--table` prints every measurement and not only the ones that failed, `--widths
 * 360,390` and `--texts 100,200` narrow a run while a stylesheet is being worked on, and
 * `--dist` names another build. The exit code is 0 where every row is where it should be, 1
 * where one is not, and 2 where nothing could be measured, which is not a pass: a browser
 * that did not start, a portal that did not draw the form, a fixture that is no longer there,
 * a text size the browser did not take.
 *
 * Chrome is taken from `CHROME_PATH`, falling back to the usual Windows install; on Linux and
 * macOS that variable has to be given. No port is fixed: Chrome is asked for any free one and
 * the script reads which, so it cannot find another script's browser, and it is stopped by
 * the process this file started and by nothing else. No new dependency: Chrome is driven over
 * the DevTools Protocol with the WebSocket built into Node, and the built portal is served by
 * this file together with a canned `/api`: `GET /api/me` answers a superadmin, and every
 * resource is answered off the fixtures the tests use (`src/test/mock`, which are not in
 * `dist`), so what is measured is the real bundle and the real stylesheet over the data the
 * suite runs on.
 *
 * **What is asked, per width and per text size, of the copy of an event** (`?kopija=`, which
 * is the only form that hands a date its days):
 *
 * - the page does not scroll sideways, and is not WIDENED by something running off the right
 *   edge (a phone browser makes the layout viewport as wide as what overflows it, so there
 *   would be nothing to scroll and the screen would simply be wider than the one asked for);
 * - the two days and the calendar button lie whole inside the screen;
 * - the date box can show a date: what it holds is no wider than the box;
 * - at the size of text a browser starts with, the days and the calendar stand beside the box
 *   in the same line, which is what the owner asked for (PDL, „Kopiranje događaja bira
 *   korak", 23.08.2026);
 * - where they cannot, all three stand together in one line under the box, and never some
 *   beside it and some under it;
 * - all three are as tall as the box (PDL, „Padajuća polja moraju da budu iste visine i na
 *   istoj liniji kao njihovi susedi", 28.09.2026), wherever they stand;
 * - the calendar, opened from its button, lies whole inside the screen and not over the row.
 *
 * And of the plain date, on the change of an event, which is the same field without days and
 * must stay as it was: the page does not scroll, and the box and the calendar button stand in
 * one line.
 *
 * **Widths:** 360, the narrowest the portal promises, where the content is 328px (PDL P24);
 * 390; 768; and 1280, a desktop that keeps its scrollbar. Phones and tablets are emulated as
 * such (`mobile`), so the scrollbar is drawn over the page as it is on a telephone and
 * `innerWidth` is the width asked for. **Text at 200%** is not done by setting `font-size` on
 * the root, which doubles every `rem` and leaves the `em` of a media query where it was (ADL
 * A34). It is done the way a reader does it, through the default font size of the browser,
 * which the profile of a second browser is given before it starts, and the run checks that a
 * media query in `em` moved with it before it trusts a single number from it.
 *
 * **What was measured, 09.10.2026, in Chrome 154.0.8037.98, on the copy of „Balkansko
 * prvenstvo veterana" (two mornings, four races), before this change (`origin/main`, 0cc5f88f,
 * where this run exits 1 on two rows of sixteen) and after it (exit 0 on all sixteen, twice):**
 *
 * - *360px, text 100%.* The box is 181.2px (16.0..197.2) and the two days and the calendar
 *   stand beside it (203.2..344.0), in one line. The same before and after.
 * - *360px, text 200%.* BEFORE: the box is 50.0px, of which 48.0 are inside it, and its date
 *   takes 211px; the days are at 94.0..276.4 and the calendar at 288.4..371.6, which is 11.6px
 *   past the screen, and the page scrolls sideways by 13px (it is 373px wide). AFTER: the box
 *   is 296.0px, all of it a line to itself, and the days and the calendar stand together on the
 *   next line (32.0..309.6), every one of the three 96px tall like the box; the page does not
 *   scroll.
 * - *390px, text 200%.* BEFORE: the same box of 50.0px (48.0 inside) and no sideways scroll.
 *   AFTER: the box is 326.0px and the group of days stands under it, whole.
 * - *768px and 1280px, both sizes, and every width at the text a browser starts with.* The same
 *   boxes to a tenth of a pixel before and after (the box is 589.2px at 768 and 649.2 at 1280
 *   with the text as it comes, 414.4 and 746.4 doubled; the three always beside it).
 * - *The plain date on the change of an event, every width and size.* Unchanged: the box is
 *   280.4px at 360px, 200.8 with the text doubled, and its calendar button is on its line.
 * - *The calendar opened from the row, every width and size.* Whole on the screen and not over
 *   the row, before and after.
 *
 * **WHAT THIS DOES NOT HOLD, written here as a boundary and not left to be found:**
 *
 * - *Widths and sizes between the ones walked.* The row wraps by its content, so with the
 *   text at 200% it wraps at some width between 390 and 768 (the box asks for 7rem and the
 *   group of days for 277.56px at that size) and nothing here says where. Nothing in the
 *   sheet is a width in pixels, so the walk is a sample and the rule is the content.
 * - *The plain date box at 360px with the text at 200%.* It is 200.81px wide and holds a date
 *   that needs 211px, so about 12px of its last character stand under the right padding. That
 *   is measured on the change of an event, it is the same on every date of the portal, it is
 *   not this row's and it is not asked here.
 * - *Which rule wins* where `.datepicker .field__control` and `.datepicker--steps
 *   .field__control` both apply is not asked as a rule. It is asked by where the box lands,
 *   which is the browser's own answer and the only one that counts.
 * - *The English side, a right-to-left language, high contrast, and the zoom of the browser
 *   as against the size of its text.* Only `/sr` is walked; the labels of the days (`+1y`,
 *   `+1w`) are the same in both languages, and the widths of the buttons are not asked of
 *   another language.
 * - *Every other form that has a date.* Their pickers have no days and are the markup they
 *   always were; the plain one is asked here once, on the change of an event.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'

const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
/** Half a pixel, because a box is measured in fractions of one. */
const SLACK = 0.5
/** A pixel, for two boxes that are meant to stand on one line: a line is the same line to a
 *  pixel, not to a hair. */
const SAME_LINE = 1
/** The event the copy is made of, by its address: four races on two mornings, so the table
 *  under the date has rows of more than one day. Its identity is read off the fixtures and
 *  never written here, because a number written here is a second home for the fixture. */
const EVENT = 'balkansko-prvenstvo-veterana-2021'
/** What the copy and the change of an event call themselves in Serbian, which is how the run
 *  knows it is looking at the form it asked for and not at the list. */
const HEADINGS = { copy: 'Kopiranje događaja', change: 'Izmena događaja' }
/** The query of the address that opens each form on the event. */
const ASKED = { copy: 'kopija', change: 'izmena' }

/* ------------------------------------------------------------------ command line */

const flags = new Map()

for (let at = 2; at < process.argv.length; at += 1) {
  const word = process.argv[at] ?? ''

  if (word.startsWith('--')) {
    const next = process.argv[at + 1]

    if (next === undefined || next.startsWith('--')) {
      flags.set(word.slice(2), true)
    } else {
      flags.set(word.slice(2), next)
      at += 1
    }
  }
}

const DIST = resolve(String(flags.get('dist') ?? 'dist'))
const MOCK = resolve('src/test/mock')
const TABLE = flags.get('table') === true

const widths =
  typeof flags.get('widths') === 'string'
    ? String(flags.get('widths')).split(',').map(Number)
    : [360, 390, 768, 1280]
const texts =
  typeof flags.get('texts') === 'string'
    ? String(flags.get('texts')).split(',').map(Number)
    : [100, 200]

/* ------------------------------------------------------------------ what the canned server says */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

const open = new Set()

/** What the portal has to be told to draw the administration: who is asking, and the files of
 *  the fixtures. Everything else answers 404, and the screen behind it says so, which does not
 *  matter for where a date box stands. */
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://x')

  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice('/api/'.length)
    let status = 404
    let body = {}

    if (name === 'me') {
      status = 200
      body = { role: 'superadmin', account: 1 }
    } else if (/^[a-z]+(\/[a-z]+)*$/.test(name) && existsSync(join(MOCK, `${name}.json`))) {
      status = 200
      body = JSON.parse(readFileSync(join(MOCK, `${name}.json`), 'utf-8'))
    }

    response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    response.end(JSON.stringify(body))

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

server.on('connection', (socket) => {
  open.add(socket)
  socket.on('close', () => open.delete(socket))
})

/* ------------------------------------------------------------------ the browser */

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/** A browser of its own, on a profile of its own, asked for any free debugging port and read
 *  back from the file Chrome writes it to, so that another script's browser is never the one
 *  this one talks to. `font` is the default font size of the profile, which is how a reader
 *  makes the text bigger. */
async function launch(font) {
  const profile = mkdtempSync(join(tmpdir(), 'btl-date-row-'))

  if (font !== null) {
    mkdirSync(join(profile, 'Default'), { recursive: true })
    writeFileSync(
      join(profile, 'Default', 'Preferences'),
      JSON.stringify({ webkit: { webprefs: { default_font_size: font, default_fixed_font_size: 26 } } }),
    )
  }

  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ])
  let failed = null

  chrome.on('error', (problem) => {
    failed = problem
  })

  let port = null

  for (let attempt = 0; attempt < 80 && port === null && failed === null; attempt += 1) {
    await sleep(250)

    const written = join(profile, 'DevToolsActivePort')

    if (existsSync(written)) {
      port = Number((readFileSync(written, 'utf-8').split('\n')[0] ?? '').trim())
    }
  }

  /* Stopped by the process this file started, and the profile it made removed after it. */
  const stop = () => {
    chrome.kill()
    setTimeout(() => rmSync(profile, { recursive: true, force: true, maxRetries: 5 }), 1500)
  }

  if (failed !== null || port === null || Number.isNaN(port)) {
    stop()
    throw new Error(
      `Chrome did not start from ${CHROME}${failed === null ? '' : `: ${failed.message}`}; set CHROME_PATH to the browser on this machine`,
    )
  }

  let target = null

  for (let attempt = 0; attempt < 40 && target === null; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()

      target = list.find((one) => one.type === 'page') ?? null
    } catch {
      target = null
    }

    if (target === null) {
      await sleep(250)
    }
  }

  if (target === null) {
    stop()
    throw new Error(`Chrome is on port ${port} and shows no page`)
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl)

  /* A browser that was started and cannot be talked to is not left running behind this. */
  await new Promise((done, fail) => {
    socket.addEventListener('open', done)
    socket.addEventListener('error', fail)
  }).catch((problem) => {
    stop()
    throw problem
  })

  let nextId = 0

  const send = (method, params = {}) => {
    nextId += 1

    const id = nextId

    return new Promise((done, fail) => {
      const onMessage = (event) => {
        const answer = JSON.parse(event.data)

        if (answer.id === id) {
          socket.removeEventListener('message', onMessage)

          if (answer.error) {
            fail(new Error(`${method} failed: ${JSON.stringify(answer.error)}`))
          } else {
            done(answer.result)
          }
        }
      }

      socket.addEventListener('message', onMessage)
      socket.send(JSON.stringify({ id, method, params }))
    })
  }

  /** `Runtime.evaluate` reports a thrown expression as a successful reply carrying
   *  `exceptionDetails`, so without this the value arrives as `undefined` and the run dies
   *  further along complaining about JSON instead of about the page. */
  const evaluate = async (expression) => {
    const answer = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })

    if (answer.exceptionDetails) {
      throw new Error(
        `the page threw: ${answer.exceptionDetails.exception?.description ?? answer.exceptionDetails.text}`,
      )
    }

    return answer.result.value
  }

  await send('Page.enable').catch((problem) => {
    socket.close()
    stop()
    throw problem
  })

  const version = (await send('Browser.getVersion').catch(() => ({ product: 'Chrome' }))).product

  return {
    send,
    evaluate,
    version,
    close: () => {
      socket.close()
      stop()
    },
  }
}

async function waitFor(browser, expression, what) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await browser.evaluate(expression)) {
      return
    }

    await sleep(100)
  }

  const seen = await browser
    .evaluate(`JSON.stringify({ href: location.href, text: document.body.innerText.slice(0, 200) })`)
    .catch(() => 'nothing readable')

  throw new Error(`timed out waiting for ${what}; the page says ${seen}`)
}

/** Waits until the box of the first element that answers `selector` has stopped moving, three
 *  reads in a row 150ms apart. A form is drawn before it has stopped being drawn: the table of
 *  races under the date and the files it waits for arrive after it, and a measurement or a
 *  press made while that goes on is a measurement of where things used to be. */
async function settled(browser, selector, what) {
  let last = ''
  let same = 0

  for (let attempt = 0; attempt < 80 && same < 3; attempt += 1) {
    const now = await browser.evaluate(
      `JSON.stringify(document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect() ?? null)`,
    )

    same = now === last ? same + 1 : 0
    last = now

    await sleep(150)
  }

  if (same < 3) {
    throw new Error(`${what} did not stop moving; this is not a measurement`)
  }
}

async function press(browser, selector) {
  const centre = JSON.parse(
    await browser.evaluate(`(() => {
      const box = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect()

      return JSON.stringify({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
    })()`),
  )

  await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: centre.x, y: centre.y, buttons: 0 })
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: centre.x,
    y: centre.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: centre.x,
    y: centre.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
}

/* ------------------------------------------------------------------ what is asked of one row */

/** Runs in the page, so it names nothing outside itself. The row it asks about is the first
 *  picker that was handed days, or the first picker of all where a form has none. It is read
 *  BEFORE the calendar is opened, because that is the state the owner looks at. */
function askThePage(probe) {
  const root = document.documentElement
  const rect = (one) => {
    const found = one.getBoundingClientRect()

    return {
      left: found.left,
      right: found.right,
      top: found.top,
      width: found.width,
      height: found.height,
    }
  }
  const row =
    [...document.querySelectorAll('.datepicker')].find(
      (one) => one.querySelector('.datepicker__step') !== null,
    ) ?? document.querySelector('.datepicker')

  if (row === null) {
    return null
  }

  const box = row.querySelector('input')
  const calendar = row.querySelector('.datepicker__open')

  return {
    innerWidth,
    edge: root.clientWidth,
    rootFont: Number.parseFloat(getComputedStyle(root).fontSize),
    probe: matchMedia(probe).matches,
    sideways: Math.max(0, root.scrollWidth - root.clientWidth),
    box: rect(box),
    /* What the box holds against what it can show of it: the date it was handed, as wide as
       its own letters and padding make it. */
    holds: box.scrollWidth,
    shows: box.clientWidth,
    days: [...row.querySelectorAll('.datepicker__step')].map((one) => ({
      label: one.textContent,
      ...rect(one),
    })),
    calendar: rect(calendar),
    /* Reported and never judged: that the days and the calendar are in a group of their own
       is a fact of the markup, and it is held where the picker is drawn. */
    grouped: calendar.parentElement !== row,
  }
}

/** Runs in the page after the calendar has been opened: where it stands, and where the row it
 *  was opened from is. */
function askTheCalendar() {
  const pop = document.querySelector('.datepicker__pop')
  const row = [...document.querySelectorAll('.datepicker')].find(
    (one) => one.querySelector('.datepicker__pop') !== null,
  )

  if (pop === null || row === undefined) {
    return null
  }

  const where = pop.getBoundingClientRect()
  const at = row.getBoundingClientRect()

  return {
    edge: document.documentElement.clientWidth,
    left: where.left,
    right: where.right,
    top: where.top,
    bottom: where.bottom,
    rowTop: at.top,
    rowBottom: at.bottom,
  }
}

async function measure(browser, base, width, text, screen, id) {
  /* A window tall enough for the calendar to have room under the row at 200%, which is about
     520px of calendar under a row that stands at about 560: where it stands is then the rule
     of `DatePicker.tsx` and not the shortness of the window, which clamps it over the row
     whatever the row is. */
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1400,
    deviceScaleFactor: 1,
    mobile: width < 1000,
  })
  await browser.send('Page.navigate', {
    url: `${base}/sr/administracija/dogadjaji?${ASKED[screen]}=${id}`,
  })

  try {
    await waitFor(
      browser,
      `document.readyState === 'complete' && document.querySelector('.datepicker') !== null && document.body.innerText.includes(${JSON.stringify(HEADINGS[screen])})`,
      `the form of ${screen} with its date at ${width}px`,
    )
  } catch (problem) {
    throw new Error(
      `${problem.message}. The canned answers in this file no longer draw the form, or the form was renamed; this is not a pass.`,
    )
  }

  await waitFor(browser, `document.getAnimations().length === 0`, 'the page to stop moving')

  /* The row to the top of the window, UP AND DOWN ONLY. With the text at 200% the date stands
     more than a thousand pixels down a telephone, and a button under the edge of the window is
     a button a press does not reach. `scrollTo(0, …)` and not `scrollIntoView`, which also
     moves the page sideways to reveal what runs off the edge, and that would move every box
     this reads on the very fault it is looking for. */
  await browser.evaluate(
    `(() => { scrollTo(0, Math.max(0, document.querySelector('.datepicker').getBoundingClientRect().top + scrollY - 16)) })()`,
  )
  await settled(browser, '.datepicker__open', `the date of ${screen} at ${width}px`)

  const asked = JSON.parse(
    await browser.evaluate(`JSON.stringify((${askThePage.toString()})('(min-width: 15em)'))`),
  )

  if (asked === null) {
    throw new Error(`the form of ${screen} at ${width}px drew no date; this is not a pass`)
  }

  /* A page NARROWER than the screen it was asked for is the emulation not landing, and that is
     not a measurement. A page WIDER than it is the finding and not a fault of the run: a phone
     browser widens the layout viewport to take in whatever runs off the right edge, and from
     then on every box is inside a screen that grew to hold it. So the screen everything is held
     against below is the one that was asked for, and the growth is reported as what it is. */
  if (asked.innerWidth < width) {
    throw new Error(`the browser was asked for ${width}px and gave ${asked.innerWidth}px`)
  }

  /* The text size really is the one this pass is for, and it moved the media queries with it
     (ADL A34): the query is true from 15em up, so it answers for the width AND the size. */
  const wantedFont = (text * 16) / 100

  if (asked.rootFont !== wantedFont || asked.probe !== width >= 15 * wantedFont) {
    throw new Error(
      `the browser draws the root at ${asked.rootFont}px and answers (min-width: 15em) with ${asked.probe}, where ${wantedFont}px was asked for at ${width}px; a text size that did not take is not a measurement`,
    )
  }

  let calendar = null

  if (screen === 'copy') {
    if (asked.days.length === 0) {
      throw new Error(`the copy of the event drew no days beside its date at ${width}px; this is not a pass`)
    }

    /* The calendar button of the row that has days: after a day where they stand loose, and in
       the group where they stand in one. The pickers in the table of races have neither. */
    const OPENER = '.datepicker__step ~ .datepicker__open, .datepicker__tools .datepicker__open'

    await press(browser, OPENER)

    /* Once more if it did not open, and only if it did not: a press that landed late and a
       second press would close what the first opened. */
    for (let attempt = 0; attempt < 15; attempt += 1) {
      if (await browser.evaluate(`document.querySelector('.datepicker__pop') !== null`)) {
        break
      }

      if (attempt === 10) {
        await press(browser, OPENER)
      }

      await sleep(100)
    }

    await waitFor(
      browser,
      `document.querySelector('.datepicker__pop') !== null`,
      `the calendar to open at ${width}px with the text at ${text}%`,
    )
    await sleep(100)
    calendar = JSON.parse(await browser.evaluate(`JSON.stringify((${askTheCalendar.toString()})())`))
  }

  return { ...asked, width, text, screen, widened: asked.innerWidth - width, opened: calendar }
}

/* ------------------------------------------------------------------ what is held */

/** Where the days and the calendar stand against the box: all on its line, all together on a
 *  line of their own, or neither, which is a row that is split. */
function layoutOf(found) {
  const controls = [...found.days, found.calendar]
  const beside = controls.every((one) => Math.abs(one.top - found.box.top) <= SAME_LINE)
  const together = controls.every((one) => Math.abs(one.top - found.calendar.top) <= SAME_LINE)

  return beside ? 'beside' : together ? 'under' : 'split'
}

/** What is wrong with one measurement, in words, or nothing. */
function judge(found) {
  const wrong = []
  const whole = (one) => one.left >= -SLACK && one.right <= found.edge + SLACK

  if (found.widened > SLACK) {
    wrong.push(
      `the page is wider than the screen: asked for ${found.width}px and got ${found.innerWidth}px, which is what a phone browser does when something runs off the right edge`,
    )
  }

  if (found.sideways > SLACK) {
    wrong.push(`the page scrolls sideways by ${found.sideways}px`)
  }

  if (found.screen === 'change') {
    /* The plain date, which must stay as it was: one line, whole on the screen. */
    if (!whole(found.calendar)) {
      wrong.push(
        `the calendar button of the plain date is not whole on the screen: ${found.calendar.left.toFixed(1)}..${found.calendar.right.toFixed(1)} of ${found.edge}`,
      )
    }

    if (layoutOf(found) !== 'beside') {
      wrong.push('the plain date has wrapped: its calendar button is not on the line of its box')
    }

    return wrong
  }

  const controls = [...found.days, found.calendar]

  for (const one of controls) {
    if (!whole(one)) {
      wrong.push(
        `${one.label ?? 'the calendar button'} is not whole on the screen: ${one.left.toFixed(1)}..${one.right.toFixed(1)} of ${found.edge}`,
      )
    }
  }

  if (found.shows < found.holds - SLACK) {
    wrong.push(
      `the date box shows ${found.shows}px of the ${found.holds}px its date takes, so no date can be read in it`,
    )
  }

  const layout = layoutOf(found)

  if (layout === 'split') {
    wrong.push('the days and the calendar are split: some stand beside the box and some under it')
  }

  if (found.text === 100 && layout !== 'beside') {
    wrong.push(
      'at the size of text a browser starts with the days and the calendar are not beside the box, which is the one row the owner asked for (PDL, 23.08.2026)',
    )
  }

  for (const one of controls) {
    if (Math.abs(one.height - found.box.height) > SAME_LINE) {
      wrong.push(
        `${one.label ?? 'the calendar button'} is ${one.height.toFixed(1)}px tall and the date box ${found.box.height.toFixed(1)}px`,
      )
    }
  }

  if (found.opened === null) {
    wrong.push('the calendar did not open, so where it stands was not measured')
  } else {
    const there = found.opened

    if (there.left < -SLACK || there.right > there.edge + SLACK) {
      wrong.push(
        `the calendar is not whole on the screen: ${there.left.toFixed(1)}..${there.right.toFixed(1)} of ${there.edge}`,
      )
    }

    if (there.top < there.rowBottom - SLACK && there.bottom > there.rowTop + SLACK) {
      wrong.push(
        `the calendar stands over the row it was opened from: ${there.top.toFixed(1)}..${there.bottom.toFixed(1)} against the row at ${there.rowTop.toFixed(1)}..${there.rowBottom.toFixed(1)}`,
      )
    }
  }

  return wrong
}

/* ------------------------------------------------------------------ run */

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`nothing is built in ${DIST}; run \`npm run build\` first, or give --dist`)
  process.exit(2)
}

if (widths.some((one) => Number.isNaN(one)) || texts.some((one) => Number.isNaN(one))) {
  console.error('--widths and --texts must be lists of numbers')
  process.exit(2)
}

/** The identity of the event, read off the fixtures. A fixture that is not there is a run that
 *  cannot measure, which is not a pass. */
function identityOfTheEvent() {
  const file = join(MOCK, 'events.json')

  if (!existsSync(file)) {
    return null
  }

  const events = JSON.parse(readFileSync(file, 'utf-8'))
  const found = Array.isArray(events) ? events.find((one) => one.slug === EVENT) : undefined

  return found === undefined ? null : found.id
}

const eventId = identityOfTheEvent()

if (eventId === null) {
  console.error(
    `the fixtures in ${MOCK} no longer carry the event ${EVENT}, which is the one this is measured on; this is not a pass`,
  )
  process.exit(2)
}

await new Promise((done) => server.listen(0, '127.0.0.1', done))

const base = `http://127.0.0.1:${server.address().port}`
const measured = []
const browsers = []
let version = 'Chrome'

function shutDown() {
  for (const one of browsers) {
    one.close()
  }

  for (const socket of open) {
    socket.destroy()
  }

  server.close()
}

const watchdog = setTimeout(() => {
  console.error('watchdog: the run took longer than ten minutes, stopping it')
  shutDown()
  process.exit(2)
}, 10 * 60 * 1000)

try {
  /* One browser for each size of text, as the profile is what makes the text bigger. */
  for (const text of texts) {
    const browser = await launch(text === 100 ? null : (text * 16) / 100)

    browsers.push(browser)
    version = browser.version

    for (const width of widths) {
      for (const screen of ['copy', 'change']) {
        measured.push(await measure(browser, base, width, text, screen, eventId))
      }
    }
  }
} catch (problem) {
  console.error(`could not measure: ${problem.message}`)
  process.exitCode = 2
} finally {
  clearTimeout(watchdog)
  shutDown()
}

if (process.exitCode !== 2) {
  const complaints = []
  let wrongRows = 0

  for (const found of measured) {
    const wrong = judge(found)
    const label = `${found.width}px text ${found.text}% ${found.screen}`

    if (TABLE || wrong.length > 0) {
      const days = found.days.map((one) => `${one.label} ${one.left.toFixed(1)}..${one.right.toFixed(1)}`)

      console.log(
        `${wrong.length > 0 ? 'FAIL' : 'ok  '} ${label.padEnd(26)} box ${found.box.left.toFixed(1)}..${found.box.right.toFixed(1)} (${found.box.width.toFixed(1)}, holds ${found.holds}, shows ${found.shows}) ${days.join(' ')} calendar ${found.calendar.left.toFixed(1)}..${found.calendar.right.toFixed(1)} tall ${found.box.height.toFixed(1)}/${found.calendar.height.toFixed(1)} ${found.grouped ? 'grouped' : 'loose'} ${layoutOf(found)} sideways ${found.sideways}`,
      )
    }

    wrongRows += wrong.length > 0 ? 1 : 0

    for (const line of wrong) {
      complaints.push(`${label}: ${line}`)
    }
  }

  if (complaints.length > 0) {
    console.error(
      `\n${wrongRows} of ${measured.length} rows ${wrongRows === 1 ? 'is' : 'are'} not where they should be:`,
    )

    for (const line of complaints) {
      console.error(`  ${line}`)
    }

    process.exitCode = 1
  } else {
    console.log(`\n${measured.length} rows measured in ${version} and held, in ${DIST}`)
  }
}
