/**
 * Where the three panels of the header land, measured in a real browser.
 *
 * jsdom applies no stylesheet and computes no layout, so no rendered test can say where
 * a panel stands, and that is where this fault lived: on a telephone the row of tools
 * wraps onto a row of its own against the LEFT edge, and a panel measured from the right
 * edge of a button 110px from that edge began 163px off the screen. What was cut off
 * could not be scrolled to and the page did not scroll sideways either, so nothing on
 * the screen said it was there. `src/app/headerPanelsStyle.test.ts` holds what the
 * stylesheet SAYS about it, in the gate; this asks where the panel then LANDS, which is
 * the question ADL A33 (29.08.2026) says is a browser's: a guard over the text may claim
 * where something is written, and which rule wins, what a query does and where a box
 * ends up are computed by the browser.
 *
 * Run by hand, not in the gate, because the browser the owner decided on in ADL A63
 * (22.09.2026) is not in the package yet and this is the stand-in until it is, in the
 * shape `scripts/refused-control-appearance.mjs` already has:
 *
 *     npm run build
 *     npm run header-panels
 *
 * and once more over the build the QA server runs, which draws the two development
 * controls in the same row and so wraps it somewhere else:
 *
 *     VITE_DEV_TOOLS=1 npx vite build --outDir dist/qa --emptyOutDir
 *     node scripts/header-panels-geometry.mjs --dist dist/qa
 *
 * `--table` prints every measurement and not only the ones that failed; `--widths 360,390`,
 * `--texts 100` (or 200) and `--states messages,language` (names, as printed) narrow a run while
 * a stylesheet is being worked on, `--widths 320-1300:5` is every fifth width from 320 to 1300 (a
 * sweep, for „on every width" asked of more than seven of them), and `--shots <folder>` keeps a
 * picture of the top of the page for each measurement. The exit code is 0 where every panel is
 * where it should be, 1 where one is not, and 2 where nothing could be measured, which is not a
 * pass: a browser that did not start, a portal that did not draw the header of the person it was
 * asked about, a text size the browser did not take.
 *
 * Chrome is taken from `CHROME_PATH`, falling back to the usual Windows install; on Linux
 * and macOS that variable has to be given. No port is fixed: Chrome is asked for any free
 * one and the script reads which, so it cannot find another script's browser. No new
 * dependency: Chrome is driven over the DevTools Protocol with the WebSocket built into
 * Node, and the built portal is served by this file together with a canned `/api`, so what
 * is measured is the real bundle and the real stylesheet.
 *
 * **What is asked, per width and per panel, with the panel OPEN:**
 *
 * - the panel lies whole inside the screen: its left edge is not negative and its right
 *   edge is not past the width of the layout viewport;
 * - the page does not scroll sideways, closed or open, and is not WIDENED by something running
 *   off the right edge: a phone browser makes the layout viewport as wide as what overflows it,
 *   so there is nothing to scroll and the screen is simply wider than the one asked for;
 * - every control in the panel can be reached: scrolled into view, the point at its
 *   centre is on the screen and is the control and not something laid over it;
 * - under the width where the navigation unfolds (`51.24875em`) the messages and the account
 *   panel hang from the gutter at the right edge of the bar, are no wider than their own 20rem
 *   and no wider than the bar allows, and stand one step under the button that opened them;
 * - under that width **the language menu hangs from its own button** (owner, 03.10.2026, `ADL.md`
 *   A63: it opens under it): its right edge is the right edge of the button, or, where that
 *   would begin it left of the gutter, it begins AT the gutter. One formula for both, its left
 *   edge being the gutter or the button's right edge less its own width, whichever is further
 *   right, and with it both ends of the menu lie inside the gutters of the bar, the whole of the
 *   button lies over it, and it stands one step under the button;
 * - from that width up they are where they always were: the right edge of each is the right edge
 *   of its own button, and the language menu stands one step under its button there as well.
 *
 * **Two headers.** A member's, with the inbox and the picture where the sign-in links stand for a
 * visitor, and a visitor's, which `GET /api/me` answering 401 draws (state `visitor-language`, the
 * only panel that header has). They wrap differently: at 768 a member's button for the language
 * stands at 464px and a visitor's at 16px, and most of the distances the owner decided on were
 * measured on the second. This file measured the first alone until 09.10.2026.
 *
 * **The states of the inbox, because the panel is drawn for all of them:** with messages,
 * empty, the list refused by the server (500), and the list that is never answered. The
 * last two are what the panel draws while the list is not loaded, and today they draw the
 * same as an empty one; the width of the panel is its `min-width` and not what is in it, so
 * a sentence about a list that is not loaded does not move it, and this is how that is
 * known rather than assumed.
 *
 * **Widths:** 360, the narrowest the portal promises; 390; 640, the last width at which the
 * production header was still cut off; 768; 819 and 820, which are either side of the width
 * the rules change at; and 1280. Phones and tablets are emulated as such (`mobile`), so the
 * scrollbar is drawn over the page as it is on a telephone and `innerWidth` is the width
 * asked for (PDL P24, 23.08.2026); 1280 is a desktop and keeps its scrollbar. All of them at the
 * text the browser starts with and at 200%.
 *
 * **Text at 200%** is not done by setting `font-size` on the root, which doubles every
 * `rem` and leaves the `em` of a media query where it was (ADL A34). It is done the way a
 * reader does it, through the browser's own default font size, which the profile of a
 * second browser is given before it starts; and the run checks that a media query in `em`
 * moved with it before it trusts a single number from it. **At every width, and not at 360
 * alone** (until 09.10.2026): at 200% the rules for a narrow screen apply up to 1639px, so a
 * desktop at 1280 is a narrow screen of its own, with the row of tools wrapped against the left
 * edge, and the language menu stood 552px from its button there.
 *
 * **WHAT THIS DOES NOT HOLD, written here as a boundary and not left to be found, with the
 * numbers it was measured at on 02.10.2026 (Chrome, `origin/main` a65f7452), so that the
 * browser of ADL A63 has exactly what to turn into a guard, one at a time:**
 *
 * - *Before the repair, production, panel open, left edge against the screen:* messages
 *   -163.3, account -114.9, language -75.7, the same at 360 and at 390 and at every width up
 *   to 640 (whole from 700, where the row stands at the right again). In QA, which has the
 *   development controls: messages -257.6 and account -209.2 at 400, whole from 560. At 360
 *   with the text at 200%: messages -49.6, account -171.2, language -188.4. After the
 *   repair every one of them is inside, with its right edge a gutter from the edge of the
 *   screen (344 at 360, 374 at 390, 752 at 768, 803 at 819), and from 820 up they are where
 *   they were (894.1..1118.1 for messages at 1280, the right edge of its own button).
 * - *At 360 with the text at 200% the card is whole and its rows are not:* the card is 296
 *   wide (the bar less two gutters of 32px) and the rows of the inbox ask for 76px more than
 *   the list gives them, so the date at the end of a row is clipped by the list the rows
 *   stand in (`clip` in `--table`). It was clipped before the repair too, by 46px, in a card
 *   326 wide and 49.6px off the left edge of the screen: the 30px between the two are the width
 *   the card gave up to be whole, so the card is better and the date is not. The reader can
 *   still scroll the list sideways to it; nothing here fails on it.
 * - *One subject made of a single word wider than the bar* (59 characters measured, state
 *   `messages-one-word`, printed and never failed): at 360 the card is held to the bar and the
 *   word is clipped inside the list (245px); at 768 the card grows to the word (550px) and is
 *   whole. Above the width where the rules change nothing was touched, and on the QA build,
 *   where the row of tools wraps and the button stands at 447px, the same card begins 103.8px
 *   off the left edge at 820; on the production build it is whole at every width. Not asked
 *   here, because the portal does not write such a subject and the server does not forbid one.
 * - *The messages and the account panel no longer stand under their own button between 690 and
 *   820:* they hang from the gutter at the right edge of the bar, which is the choice
 *   `forms/FieldHint.css` made for the same fault. Not asked here, since it is a decision and not
 *   a fault, and it is the owner's to change: on 03.10.2026 he changed it for the language menu
 *   alone (ADL A63), which is asked, and measured in the next item.
 * - *The language menu, sideways distance between it and its button, before and after the
 *   change of 09.10.2026* (Chrome 154, `origin/main` 45e3a86a, production build, a member's
 *   header and a visitor's). Before: 67.7 at 360 and 97.7 at 390 in both; 347.7 at 640 in both;
 *   27.7 for a member and 475.7 for a visitor at 768; 27.7 and 526.7 at 819; at 200% text none at
 *   360 and 390 (the menu was as wide as the bar) and 92.4, 220.4, 271.4 and 272.4 at 640, 768, 819
 *   and 820 in both, and 552.4 at 1280 in both. The QA build, which draws the two development
 *   controls first, has other distances: 67.7 and 97.7 at 360 and 390, 49.7, 177.7 and 228.7 at
 *   640, 768 and 819, and at 200% 92.4 at 640 and none elsewhere (at 768 and over the menu already
 *   covered the button, without hanging from it). After: none, at any width, in either header,
 *   in either build, at either size of text, and the left edge of the menu is the gutter (16 at 360,
 *   390 and 640, and for a visitor at 768 and 819, production) or the right edge of its button less
 *   its own 176 (372.3 at 768 and 423.3 at 819 for a member, production). From 820 up, at the text
 *   the browser starts with, nothing moved. A sweep of every fifth width from 320 to 1300
 *   (`--widths 320-1300:5`, both language menus, both sizes of text: 788 measurements) holds all
 *   788 on the production build and all 788 on the QA build; over `origin/main` it fails 554 of
 *   788 on the production build, every one of them for not being under its button and none for
 *   leaving the screen.
 * - *A browser that does not know anchor positioning* (older than Chrome 125, Safari 26 or
 *   Firefox 147) reads none of the block the menu is hung from, and keeps the shape of the repair of
 *   02.10.2026: whole on the screen and far from its button. The Chrome this drives has the feature
 *   and has no flag that turns it off (measured: `--disable-blink-features=CSSAnchorPositioning`
 *   changes nothing), so that shape is measured by a build whose `@supports` asks for something no
 *   browser has. Of the 32 panels it holds there (the messages, the account and the language menus
 *   of both headers, at 360, 768, 819 and 1280 and at both sizes of text) 12 fail, every one a
 *   language menu and only for not being under its button; none runs off an edge, scrolls the page
 *   sideways or cannot be reached.
 * - *Which panel is on top of which, and what is under the header,* when two are open or when
 *   the navigation is: the panels close on a press outside them, so two are never open, and
 *   the navigation is not measured with a panel over it.
 *
 * Nothing here enumerates what could push a panel off the screen, and that is the whole
 * shape of it: the question is asked of where the panel is, in a closed form, so the next
 * declaration that moves it is found by its effect and not by its spelling.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'

const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
/** Any screen of the portal will do, and one with next to nothing on it is the one whose
 *  sideways scroll can only be the header's. Its body says the data could not be loaded,
 *  because the canned `/api` below answers nothing but the session and the inbox. */
const SCREEN = '/sr/uslovi-koriscenja'
/** Half a pixel, because a box is measured in fractions of one. */
const SLACK = 0.5
/** The width the rules change at, in pixels at the browser's own 16px: `51.25em`. */
const WHERE_THE_NAVIGATION_UNFOLDS = 820
/** A query in `em` that tells the two text sizes apart at THIS width: a third of the way
 *  under the width at the browser's own 16px (true) and a third of the way over it at 32px
 *  (false), so one number cannot be read as the other. A fixed one told them apart at 360
 *  only, which was the only width the enlarged text was ever read at. */
const probeAt = (width) => `(min-width: ${width / 24}em)`

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
const TABLE = flags.get('table') === true
/** `--shots <folder>` keeps a picture of the top of the page for every measurement, panel open, as
 *  `<width>-<text>-<state>.png`: the numbers say where a panel stands and a picture says whether it
 *  looks like a menu under its button. Nothing is held on it. */
const SHOTS = typeof flags.get('shots') === 'string' ? resolve(String(flags.get('shots'))) : null

const ALL_WIDTHS = [360, 390, 640, 768, 819, 820, 1280]

/** `--widths 360,768` names widths, and `--widths 320-1300:5` is every fifth from 320 to 1300: a
 *  sweep, for the question „on every width" asked of more than the seven the run reads by default.
 *  The two can be mixed, `--widths 360,500-700:10`. A word that is neither is `NaN`, which stops the
 *  run before it starts. */
const widths =
  typeof flags.get('widths') === 'string'
    ? String(flags.get('widths'))
        .split(',')
        .flatMap((word) => {
          const range = /^(\d+)-(\d+):(\d+)$/.exec(word)

          if (range === null) {
            return [Number(word)]
          }

          const [from, to, step] = [Number(range[1]), Number(range[2]), Number(range[3])]

          return step > 0 && from <= to
            ? Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, at) => from + at * step)
            : [Number.NaN]
        })
    : ALL_WIDTHS

/** The sizes of text a run reads every width at, in per cent of the browser's own: both by
 *  default, and `--texts 100` or `--texts 200` for one of them while a stylesheet is being
 *  worked on. */
const texts =
  typeof flags.get('texts') === 'string'
    ? String(flags.get('texts')).split(',').map(Number)
    : [100, 200]

/* ------------------------------------------------------------------ what the canned server says */

/**
 * What the portal has to be told to draw the signed in header, and no more: `GET /api/me`
 * for who is asking (`session/theServer.ts`) and `GET /api/inbox` for what is in the
 * inbox (`data/types.ts`, `ServedMessage`). Everything else answers 404, and the screen
 * behind the header says so, which does not matter for where a panel stands.
 *
 * These are two facts with a second home, and they are checked rather than trusted: a
 * portal that no longer signs in on these answers draws no inbox button, and this stops
 * with exit code 2 saying so instead of reporting on a header it did not see.
 *
 * **And the header of somebody who is NOT signed in is the other half of the same ask**
 * (it was not measured until 09.10.2026, and most of the distances the owner decided on
 * on 03.10.2026 were measured there): `GET /api/me` answers 401, which is what the server
 * says to a visitor (`ADL.md` A8), and the header then draws the sign-in and join links
 * where the inbox and the picture stand. The row of tools wraps somewhere else for it, and
 * the language menu is the only panel it has.
 */
const MEMBER = { role: 'competitor', account: 41, member: { memberNumber: '000041' } }

const message = (id, subject, date, read) => ({
  id,
  from: 'Balkanska trkacka liga',
  subject,
  body: 'x',
  date,
  read,
  pairInviteId: null,
  teamInvitationId: null,
})

const MESSAGES = [
  message(9, 'Poziv u tim Dunavski trkaci', '2027-03-14', false),
  message(8, 'Rezultat sa trke Fruskogorski maraton je odobren', '2027-03-12', false),
  message(
    7,
    'Obavestenje o promeni termina trke Zlatiborski polumaraton i druge vazne informacije za sve ucesnike',
    '2027-03-01',
    true,
  ),
  message(6, 'Clanarina je produzena', '2027-02-20', true),
]

/** A subject that is one word, which is how a panel is made wider than the bar. The portal
 *  writes no such subject and the server does not forbid one, so it is measured and not
 *  held (the boundary in the head of this file). */
const ONE_WORD = 'Dugackareckabezrazmakazalomljenje0123456789abcdefghijklmnop'

/** What the server says to `GET /api/inbox` in each state the panel is drawn for, and the
 *  states themselves, each with the panel it opens and whose header it is (`session`). */
const STATES = [
  { id: 'messages', session: 'member', inbox: 'served', opens: 'messages' },
  { id: 'messages-empty', session: 'member', inbox: 'empty', opens: 'messages' },
  { id: 'messages-refused', session: 'member', inbox: 'refused', opens: 'messages' },
  { id: 'messages-silent', session: 'member', inbox: 'silent', opens: 'messages' },
  { id: 'messages-one-word', session: 'member', inbox: 'one-word', opens: 'messages', grows: true, info: true },
  { id: 'account', session: 'member', inbox: 'served', opens: 'account' },
  { id: 'language', session: 'member', inbox: 'served', opens: 'language' },
  { id: 'visitor-language', session: 'visitor', inbox: 'served', opens: 'language' },
]

/** What the header of each session must have drawn before anything is read, so that a run
 *  never reports on the header of the other one: the picture's own button for a member, and
 *  the link that signs in for a visitor. The header is drawn as a visitor's first and changes
 *  when `GET /api/me` is answered, and the row of tools stands somewhere else in each. */
const DRAWN = {
  member: 'button[aria-controls="account-menu"]',
  visitor: '.shell__tools a[href$="/prijava"]',
}

const PANELS = {
  messages: {
    button: 'button[aria-controls="messages-menu"]',
    panel: '#messages-menu',
    controls: 'a[href]',
  },
  account: {
    button: 'button[aria-controls="account-menu"]',
    panel: '#account-menu',
    controls: 'a[href], button',
  },
  language: { button: '.lang__btn', panel: '.lang__menu', controls: '[role="option"]' },
}

/** What the panel is as wide as at most, in `rem`, under the width where the rules change:
 *  the width each of them has always been given in `Shell.css`. */
const WIDEST_IN_REM = { messages: 20, account: 20, language: 11 }

let inbox = 'served'
let session = 'member'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

const open = new Set()

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://x')

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/inbox' && inbox === 'silent') {
      /* Accepted and never answered: the one outcome a promise cannot settle, which is
         what the panel looks like while the list has not come yet. */
      return
    }

    const [status, body] =
      url.pathname === '/api/me'
        ? session === 'visitor'
          ? [401, {}]
          : [200, MEMBER]
        : url.pathname === '/api/inbox'
          ? session === 'visitor'
            ? [401, {}]
            : inbox === 'refused'
              ? [500, {}]
              : [
                  200,
                  inbox === 'empty'
                    ? []
                    : inbox === 'one-word'
                      ? [message(10, ONE_WORD, '2027-03-15', false), ...MESSAGES]
                      : MESSAGES,
                ]
          : url.pathname === '/api/competitors'
            ? [200, []]
            : [404, {}]

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

/** A browser of its own, on a profile of its own, asked for any free debugging port and
 *  read back from the file Chrome writes it to, so that another script's browser is never
 *  the one this one talks to. `font` is the default font size of the profile, which is how
 *  a reader makes the text bigger. */
async function launch(font) {
  const profile = mkdtempSync(join(tmpdir(), 'btl-panels-'))

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

  return {
    send,
    evaluate,
    close: () => {
      socket.close()
      stop()
    },
  }
}

async function waitFor(browser, expression, what) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
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

/* ------------------------------------------------------------------ what is asked of one open panel */

/** Runs in the page, so it names nothing outside itself. Everything is read BEFORE the
 *  page is scrolled to reach the controls, because scrolling moves every box. */
function askThePage(spec) {
  const root = document.documentElement
  const panel = document.querySelector(spec.panel)
  const button = document.querySelector(spec.button)
  const box = (one) => {
    const found = one.getBoundingClientRect()

    return { left: found.left, right: found.right, top: found.top, bottom: found.bottom, width: found.width }
  }
  const asked = {
    innerWidth,
    screen: root.clientWidth,
    rootFont: Number.parseFloat(getComputedStyle(root).fontSize),
    /* The gutter is read off the bar and not assumed to be a rem: it is the bar's own
       `padding-inline` and the panels hang from it, so a gutter changed in the stylesheet
       moves both and this goes on holding them to each other. */
    gutter: Number.parseFloat(getComputedStyle(document.querySelector('.shell__bar')).paddingRight),
    probe: matchMedia(spec.probe).matches,
    sideways: Math.max(0, root.scrollWidth - root.clientWidth),
    panel: box(panel),
    button: box(button),
    /* The bar is as wide as the screen up to 1100px and centred beyond it, and the gutters a panel
       is held to are the bar's and not the screen's: at 1280 with the text at 200% the narrow rules
       apply on a screen wider than the bar. */
    bar: box(document.querySelector('.shell__bar')),
  }
  const list = spec.list === null ? null : panel.querySelector(spec.list)

  /* The date of a row clipped by the list it stands in, which is what the card being whole
     does not say. */
  asked.clip = list === null ? 0 : list.scrollWidth - list.clientWidth

  const controls = [...panel.querySelectorAll(spec.controls)]

  asked.controls = controls.length
  asked.reached = controls.filter((one) => {
    one.scrollIntoView({ block: 'center', inline: 'center' })

    const where = one.getBoundingClientRect()
    const x = where.left + where.width / 2
    const y = where.top + where.height / 2
    const onTheScreen = x >= 0 && x <= root.clientWidth && y >= 0 && y <= innerHeight
    const under = onTheScreen ? document.elementFromPoint(x, y) : null

    return under !== null && one.contains(under)
  }).length
  scrollTo(0, 0)

  return asked
}

async function measure(browser, base, width, state, font) {
  inbox = state.inbox

  const spec = { ...PANELS[state.opens], probe: probeAt(width), list: state.opens === 'messages' ? '.inbox__list' : null }

  session = state.session

  await browser.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 800,
    deviceScaleFactor: 1,
    mobile: width < 1000,
  })
  await browser.send('Page.navigate', { url: `${base}${SCREEN}` })

  try {
    await waitFor(
      browser,
      `document.readyState === 'complete' && document.querySelector(${JSON.stringify(spec.button)}) !== null && document.querySelector(${JSON.stringify(DRAWN[state.session])}) !== null`,
      `the ${state.opens} button on the header of a ${state.session} at ${width}px`,
    )
  } catch (problem) {
    throw new Error(
      `${problem.message}. The canned answers in this file no longer draw the header of a ${state.session}, or the header was changed; this is not a pass.`,
    )
  }

  await waitFor(browser, `document.getAnimations().length === 0`, 'the page to stop moving')
  await sleep(150)

  const closed = await browser.evaluate(
    `Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)`,
  )

  await press(browser, spec.button)
  await waitFor(
    browser,
    `document.querySelector(${JSON.stringify(spec.button)}).getAttribute('aria-expanded') === 'true'`,
    `the ${state.opens} panel to open at ${width}px`,
  )
  /* The mouse goes back to the corner of the page before anything is read: it was left on the
     button it pressed, and a hovered button is lifted a pixel (`transform: translateY(-1px)`),
     which would be read as a pixel of gap that is not the panel's. */
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1, buttons: 0 })
  await waitFor(browser, `document.getAnimations().length === 0`, 'the panel to stop moving')
  await sleep(150)

  const asked = JSON.parse(
    await browser.evaluate(`JSON.stringify((${askThePage.toString()})(${JSON.stringify(spec)}))`),
  )

  if (SHOTS !== null) {
    mkdirSync(SHOTS, { recursive: true })

    const shot = await browser.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: asked.innerWidth, height: 520, scale: 1 },
    })

    writeFileSync(
      join(SHOTS, `${width}-${font === null ? 100 : 200}-${state.id}.png`),
      Buffer.from(shot.data, 'base64'),
    )
  }

  /* A page NARROWER than the screen it was asked for is the emulation not landing, and that
     is not a measurement. A page WIDER than it is the finding and not a fault of the run: a
     phone browser widens the layout viewport to take in whatever runs off the right edge (a
     panel pushed 8px past it made 360 into 369, measured), and from then on every box is
     inside a screen that grew to hold it. So the screen everything is held against below is
     the one that was asked for, and the growth is reported as what it is (`widened`). */
  if (asked.innerWidth < width) {
    throw new Error(`the browser was asked for ${width}px and gave ${asked.innerWidth}px`)
  }

  /* The text size really is the one this pass is for, and it moved the media queries with
     it (ADL A34): a default-size browser reads the probe as true and root as 16px, and the
     enlarged one reads it as false at 32px. Anything else is a run that would report on a
     page it did not read. */
  const wantedFont = font ?? 16

  if (asked.rootFont !== wantedFont || asked.probe !== (font === null)) {
    throw new Error(
      `the browser draws the root at ${asked.rootFont}px and answers ${spec.probe} with ${asked.probe}, where ${wantedFont}px and ${font === null} were asked for; a text size that did not take is not a measurement`,
    )
  }

  return {
    ...asked,
    width,
    screen: Math.min(width, asked.screen),
    widened: asked.innerWidth - width,
    state: state.id,
    session: state.session,
    text: (wantedFont * 100) / 16,
    closed,
    opens: state.opens,
    grows: state.grows === true,
    info: state.info === true,
  }
}

/* ------------------------------------------------------------------ what is held */

/** What is wrong with one measurement, in words, or nothing. */
function judge(found) {
  const wrong = []
  /* One rem, which is twice one step: `--space-8` is the gap under a button, and it is half of
     the root. The gutter is not assumed to be a rem, it is what the bar says it is. */
  const rem = found.rootFont
  /* The width the rules change at moves with the text (ADL A34), so it is counted in `em`
     and not in pixels: 51.25em is 820px at the browser's own size and 1640px at 200%. */
  const under = found.width < WHERE_THE_NAVIGATION_UNFOLDS * (rem / 16)
  const where = `left ${found.panel.left.toFixed(1)}, right ${found.panel.right.toFixed(1)}, screen ${found.screen}`

  if (found.panel.left < -SLACK) {
    wrong.push(`runs off the LEFT edge by ${(-found.panel.left).toFixed(1)}px (${where})`)
  }

  if (found.panel.right > found.screen + SLACK) {
    wrong.push(`runs off the RIGHT edge by ${(found.panel.right - found.screen).toFixed(1)}px (${where})`)
  }

  if (found.widened > SLACK) {
    wrong.push(
      `the page is wider than the screen: asked for ${found.width}px and got ${found.width + found.widened}px, which is what a phone browser does when something runs off the right edge`,
    )
  }

  if (found.closed > SLACK) {
    wrong.push(`the page scrolls sideways by ${found.closed}px with the panel shut`)
  }

  if (found.sideways > SLACK) {
    wrong.push(`the page scrolls sideways by ${found.sideways}px with the panel open`)
  }

  if (found.reached < found.controls) {
    wrong.push(`${found.controls - found.reached} of ${found.controls} controls cannot be reached by their centre`)
  }

  if (found.state === 'messages' && found.controls < 3) {
    wrong.push(
      `the inbox drew ${found.controls} links, so the served messages did not arrive and this measured another state`,
    )
  }

  /* Where the controls of the bar begin and end: the bar's own box less its gutters. The bar is the
     screen up to 1100px and is centred beyond it, so these are not the edges of the screen at 1280
     with the text at 200%, where the narrow rules apply on a screen wider than the bar. */
  const gutterAtLeft = found.bar.left + found.gutter
  const gutterAtRight = found.bar.right - found.gutter

  if (under) {
    if (found.opens === 'language') {
      /* THE LANGUAGE MENU HANGS FROM ITS OWN BUTTON (owner, 03.10.2026, `ADL.md` A63): its right
         edge is the right edge of the button, unless that would put its left edge past the gutter,
         and then it begins at the gutter. One formula, so that the two cases are not two checks that
         can each be satisfied by something else: the left edge is the gutter or the button's right
         edge less the menu's own width, whichever is further right. Both ends of it lie inside the
         bar's gutters and the button lies under it, which is what „directly under its button" and
         „never off the screen" ask for together. */
      const hangs = Math.max(gutterAtLeft, found.button.right - found.panel.width)

      if (Math.abs(found.panel.left - hangs) > 1) {
        wrong.push(
          `is not under its button: its left edge is ${found.panel.left.toFixed(1)}, and hung from the right edge of the button (${found.button.right.toFixed(1)}) and no further left than the gutter (${gutterAtLeft.toFixed(1)}) it would be ${hangs.toFixed(1)}`,
        )
      }

      if (found.panel.left < gutterAtLeft - 1 || found.panel.right > gutterAtRight + 1) {
        wrong.push(
          `is not inside the gutters of the bar: ${found.panel.left.toFixed(1)}..${found.panel.right.toFixed(1)} against ${gutterAtLeft.toFixed(1)}..${gutterAtRight.toFixed(1)}`,
        )
      }

      if (found.panel.left > found.button.left + 1 || found.panel.right < found.button.right - 1) {
        wrong.push(
          `does not lie under the whole of its button: the menu is ${found.panel.left.toFixed(1)}..${found.panel.right.toFixed(1)} and the button ${found.button.left.toFixed(1)}..${found.button.right.toFixed(1)}`,
        )
      }
    } else if (Math.abs(found.panel.right - gutterAtRight) > 1) {
      wrong.push(
        `is not hung from the gutter at the right edge of the bar: its right edge is ${found.panel.right.toFixed(1)} and the gutter is at ${gutterAtRight}`,
      )
    }

    if (found.panel.width > found.bar.width - 2 * found.gutter + SLACK) {
      wrong.push(
        `is ${found.panel.width.toFixed(1)}px wide, wider than the bar allows (${found.bar.width - 2 * found.gutter}px)`,
      )
    } else if (!found.grows && found.panel.width > WIDEST_IN_REM[found.opens] * rem + SLACK) {
      wrong.push(
        `is ${found.panel.width.toFixed(1)}px wide, wider than the ${WIDEST_IN_REM[found.opens]}rem it was always given`,
      )
    }

    if (Math.abs(found.panel.top - found.button.bottom - rem / 2) > 1) {
      wrong.push(
        `stands ${(found.panel.top - found.button.bottom).toFixed(1)}px under its button and not one step (${rem / 2}px)`,
      )
    }
  } else {
    if (Math.abs(found.panel.right - found.button.right) > 1) {
      wrong.push(
        `no longer hangs from its own button: its right edge is ${found.panel.right.toFixed(1)} and the button's is ${found.button.right.toFixed(1)}`,
      )
    }

    /* The language menu is under its button at the other widths too, and one step under it: held
       here as well, since „on every width" is the whole of what the owner decided. */
    if (found.opens === 'language' && Math.abs(found.panel.top - found.button.bottom - rem / 2) > 1) {
      wrong.push(
        `stands ${(found.panel.top - found.button.bottom).toFixed(1)}px under its button and not one step (${rem / 2}px)`,
      )
    }
  }

  return wrong
}

/** How far a panel stands from its button sideways, and nothing if the two overlap: the measure the
 *  owner was shown when he decided (03.10.2026, `ADL.md` A63: between 348 and 552 pixels), printed
 *  for every panel. It is held for the language menu (it is nothing there) and only printed for the
 *  other two, which hang from the bar and are not asked to be under their buttons. */
const awayFrom = (found) =>
  Math.max(0, found.panel.left - found.button.right, found.button.left - found.panel.right)

/* ------------------------------------------------------------------ run */

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`nothing is built in ${DIST}; run \`npm run build\` first, or give --dist`)
  process.exit(2)
}

const wanted =
  typeof flags.get('states') === 'string'
    ? STATES.filter((one) => String(flags.get('states')).split(',').includes(one.id))
    : STATES

if (
  wanted.length === 0 ||
  widths.some((one) => Number.isNaN(one)) ||
  texts.length === 0 ||
  texts.some((one) => one !== 100 && one !== 200)
) {
  console.error('--states, --widths and --texts name nothing this file measures (texts are 100 and 200)')
  process.exit(2)
}

await new Promise((done) => server.listen(0, '127.0.0.1', done))

const base = `http://127.0.0.1:${server.address().port}`
const measured = []
const browsers = []

function shutDown() {
  for (const one of browsers) {
    one.close()
  }

  for (const socket of open) {
    socket.destroy()
  }

  server.close()
}

/** Ten minutes, and more where the run is longer than the default one: forty measurements a minute
 *  is what a busy machine gives, and a sweep of widths is a thousand of them. */
const MINUTES = Math.max(10, Math.ceil((widths.length * wanted.length * texts.length) / 40))

const watchdog = setTimeout(
  () => {
    console.error(`watchdog: the run took longer than ${MINUTES} minutes, stopping it`)
    shutDown()
    process.exit(2)
  },
  MINUTES * 60 * 1000,
)

try {
  /* The browser as it comes for every width, and a second one with the text at 200% for every
     width as well. Enlarged text was read at 360 alone until 09.10.2026, and that was too few:
     at 200% the rules for a narrow screen apply up to 1639px (51.25em is 1640px at twice the
     size, ADL A34), so a desktop at 1280 is a narrow screen of its own, and the owner's
     552px was measured there. */
  if (texts.includes(100)) {
    const plain = await launch(null)

    browsers.push(plain)

    for (const width of widths) {
      for (const state of wanted) {
        measured.push(await measure(plain, base, width, state, null))
      }
    }
  }

  if (texts.includes(200)) {
    const large = await launch(32)

    browsers.push(large)

    for (const width of widths) {
      for (const state of wanted) {
        measured.push(await measure(large, base, width, state, 32))
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
  let wrongPanels = 0
  let held = 0

  for (const found of measured) {
    /* A state that is measured and not held (`info`, the boundary in the head of this file) is
       printed and never fails the run. */
    const wrong = found.info ? [] : judge(found)
    const label = `${found.width}px${found.text === 100 ? '' : ` at text ${found.text}%`} ${found.state}`

    if (TABLE || wrong.length > 0) {
      console.log(
        `${wrong.length > 0 ? 'FAIL' : found.info ? 'info' : 'ok  '} ${label.padEnd(40)} panel ${found.panel.left.toFixed(1)}..${found.panel.right.toFixed(1)} (${found.panel.width.toFixed(1)}) button ${found.button.left.toFixed(1)}..${found.button.right.toFixed(1)} away ${awayFrom(found).toFixed(1)} gap ${(found.panel.top - found.button.bottom).toFixed(1)} sideways ${found.closed}/${found.sideways} reached ${found.reached}/${found.controls} clip ${found.clip}`,
      )
    }

    held += found.info ? 0 : 1
    wrongPanels += wrong.length > 0 ? 1 : 0

    for (const line of wrong) {
      complaints.push(`${label}: ${line}`)
    }
  }

  if (complaints.length > 0) {
    console.error(`\n${wrongPanels} of ${held} panels ${wrongPanels === 1 ? 'is' : 'are'} not where they should be:`)

    for (const line of complaints) {
      console.error(`  ${line}`)
    }

    process.exitCode = 1
  } else {
    console.log(`\n${held} panel${held === 1 ? '' : 's'} measured and held, every one whole on the screen, in ${DIST}`)
  }
}
