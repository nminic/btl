/**
 * Do the refused controls still look refused, measured in a real browser.
 *
 * jsdom cannot answer this. Nine rounds of review on
 * `src/pages/admin/entityStyle.test.ts` proved it: every version tried to compute the
 * cascade and each was blind to the next axis. A browser computes the cascade itself,
 * so it is asked instead.
 *
 * Run by hand, not in the gate: it needs a build and a browser, and the gate must
 * stay fast.
 *
 *     npm run build
 *     npm run appearance
 *
 * Chrome is taken from `CHROME_PATH`, falling back to the usual Windows install; on
 * Linux and macOS that variable has to be given. The debugging port is `BTL_CDP_PORT`,
 * 9333 by default, and the browser this script talks to is the one it started, checked
 * by the address of the page rather than assumed.
 *
 * **Two controls, one set of questions.** The portal refuses two buttons and refuses
 * them differently: the button that opens a record goes muted and grey and carries
 * `not-allowed` (`pages/admin/Entity.css`), while the button that opens a calendar
 * keeps its colours and changes its background and its cursor
 * (`forms/DatePicker.css`). One of them was measured here and the other was not, and a
 * review of PR 154 measured what that cost: the guard over the calendar button reads
 * the declarations of one rule out of one file and never asks the cascade, so a
 * heavier rule added later in the same sheet (`.datepicker .datepicker__open:hover`)
 * puts the accent back on a refused button while the whole suite stays green. So the
 * markup and the difference belong to the control rather than to this file, and every
 * question below is asked of each of them in turn (`CONTROLS`).
 *
 * **Nothing here enumerates what could paint a control, and that is the whole design.**
 * Four rounds of review were lost to such a list: the cursor, then the background, then
 * the shadow, then the gradient behind `background`, then the border style, then the
 * colour of the ring. A list of ways to break something is never finished. So the
 * question is asked as a closed one instead, by comparing whole computed styles:
 *
 * - **under the mouse it must not change at all.** Every property of the refused
 *   control, hovered against resting, and the difference has to be empty. That is the
 *   fault this file exists for, said exactly.
 * - **under the keyboard only the ring may change.** The same comparison, and the
 *   difference has to be the ring and nothing else.
 * - **beside the live control it must differ in exactly the refusal.** Every property,
 *   refused against live, and the difference has to be the set that control names.
 *   Something new painting it shows up as a property nobody put in that set; the
 *   refusal going missing shows up as one of them absent.
 *
 * Those three carry most of it, and each of them is asked again of every pseudo-element
 * the specification gives these controls, sideways against the same pseudo-element of
 * the live one. On top sit the values: every member of a refusal has to hold the value
 * the theme names, because a member changing its value is as much a fault as a member
 * appearing, and a review proved it by drawing the label through
 * `-webkit-text-fill-color` while `color` stayed muted. And on top of those sit the
 * decisions this portal has already written down, `opacity` first among them.
 *
 * **What none of it sees, said plainly because the rule of this repo is that a guard may
 * claim only what the tool beneath it answers:** a change applied to the live control and
 * the refused one alike, in every state and at both widths, in a property nobody has
 * named here. And a width between the two, or beyond them.
 * `font-size: 0` on `.entity-open` empties both labels and every comparison above stays
 * quiet, because nothing differs from anything. Those classes of fault are not subtle on
 * a screen, and they are what looking at QA is still for. They are not caught here, and
 * this file does not pretend they are.
 *
 * **What is measured:** the built stylesheet, over the ancestor chain each control is
 * given by the screen it stands on, in both themes, at **three widths** (1280, 768 and
 * 360, the narrowest this portal promises), in **four states** (at rest, under a real
 * mouse, under a real press, and under a real Tab), each of the last three checked to
 * have actually landed.
 *
 * **What is not measured:** the markup below is written here rather than drawn by the
 * portal, so it sees nothing a component puts on the element itself. An inline style is
 * the axis that beat the last jsdom guard, and it is answered where jsdom answers it
 * exactly: `entityStyle.test.ts` asserts the rendered button carries no `style`
 * attribute. That same test holds the first fixture against the chain the portal
 * renders, because a chain is a fact with two homes and it drifted twice.
 *
 * No new dependency. Chrome is driven over the DevTools Protocol with the WebSocket
 * built into Node.
 */
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = Number(process.env.BTL_CDP_PORT ?? 9333)
/** The three widths this portal promises (`CLAUDE.md`, UI standards): desktop, tablet,
 *  and the narrowest of them.
 *  Measured at one width only, a refusal written away inside `@media (max-width: ...)`
 *  is not there on a telephone and nothing says so: the shared table sheet already
 *  branches at 699.98px, and a review took the refusal out below it. */
const WIDTHS = [1280, 768, 360]
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

/** Set `BTL_APPEARANCE_DIFFS=1` to print the differences of every control instead of
 *  judging them. That is how the sets below were written, and how they are rewritten on
 *  the day the portal's own styling of these buttons legitimately changes. */
const SHOW = process.env.BTL_APPEARANCE_DIFFS === '1'

/** A colour the theme names, resolved in the page rather than copied here: a value
 *  written out as `rgb(163, 176, 196)` is right in one theme and a lie in the other. */
const MUTED = 'var(--text-muted)'
const BORDER = 'var(--border)'
const HOVER = 'var(--surface-hover)'

/** The properties Chrome draws letters with, and the properties it draws edges with.
 *
 *  Membership alone is not enough, and a review measured why: `-webkit-text-fill-color`
 *  is what Chrome actually draws letters with, so a rule setting it to the accent left
 *  the set of eighteen untouched, left `color` muted, and put a live-coloured word on a
 *  refused control. Every member of every refusal below holds a named value, so a member
 *  changing is the same event as a member appearing. */
const TEXT = [
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
  'caret-color',
  'color',
  'column-rule-color',
  'outline-color',
  'row-rule-color',
  'text-decoration-color',
  'text-emphasis-color',
]

const EDGE = [
  'border-block-end-color',
  'border-block-start-color',
  'border-bottom-color',
  'border-inline-end-color',
  'border-inline-start-color',
  'border-left-color',
  'border-right-color',
  'border-top-color',
]

/** The refusal of the button that opens a record, said twice over: as the exact set of
 *  properties in which it differs from the live control standing beside it, and as the
 *  value each of them must have (`Entity.css`, `.entity-open[aria-disabled='true']`). */
const OPEN_REFUSAL = {
  ...Object.fromEntries(TEXT.map((name) => [name, MUTED])),
  ...Object.fromEntries(EDGE.map((name) => [name, BORDER])),
  cursor: 'not-allowed',
}

/** The same eighteen on a pseudo-element, and the borders among them are muted rather
 *  than the border colour: a pseudo-element takes `currentColor` for every one of them,
 *  and on this control that is the muted colour. It does not inherit the control's own
 *  border colour, which was measured after this comparison was first written the other
 *  way round. */
const OPEN_PSEUDO = {
  ...Object.fromEntries([...TEXT, ...EDGE].map((name) => [name, MUTED])),
  cursor: 'not-allowed',
}

/** The refusal of the button that opens a calendar, which is not those eighteen but two
 *  declarations: a background and a cursor (`DatePicker.css`,
 *  `.datepicker__open[aria-disabled='true']`). Its colours are the ones it already had,
 *  because the sheet holds them against the plain hover rather than changing them.
 *
 *  Written as the computed properties the two declarations come out as, since that is
 *  what a browser compares: `background` is a shorthand and only its colour moves. */
const CALENDAR_REFUSAL = {
  'background-color': HOVER,
  cursor: 'default',
}

/** And on a pseudo-element, only the cursor: `cursor` is inherited and a background is
 *  not, so a `::before` of the refused button carries the refused cursor and the same
 *  transparent background as its twin. Measured with `BTL_APPEARANCE_DIFFS=1`, not
 *  reasoned out: an equality demanding the background back complains about a difference
 *  that paints nothing. */
const CALENDAR_PSEUDO = {
  cursor: 'default',
}

/** What the focus ring may change, and nothing else. A subset rather than an equality:
 *  a ring declared at the width the resting state already has drops out of the
 *  difference, and demanding all four turned a thicker, more visible ring into a
 *  complaint that there was no ring at all. */
const RING = ['outline-color', 'outline-offset', 'outline-style', 'outline-width']

/** Decisions this portal has already written down about these controls, which no
 *  comparison can carry: a fault that paints the live control the same way leaves no
 *  difference behind, and one that paints every state alike leaves none either.
 *
 *  `opacity` is the oldest of them. `Entity.css` says in its own words that the refusal
 *  is written in colours and never in `opacity`, because opacity dims the focus ring
 *  along with everything else and these controls stay in the order of focus on purpose
 *  (WCAG 2.2 SC 1.4.11). A review set `opacity: .35` on `.entity-open` and watched a
 *  guard that reads only the ring's own properties call the ring visible.
 *
 *  The background is the one entry a control may hold a different opinion about, since
 *  refusing with a background is what the calendar button does. It is named here for the
 *  control that paints none, and the control that paints one leaves it out and names it
 *  in its refusal instead. */
const QUIET = {
  'backdrop-filter': 'none',
  'background-color': TRANSPARENT,
  'background-image': 'none',
  'box-shadow': 'none',
  'clip-path': 'none',
  filter: 'none',
  'mask-image': 'none',
  'mix-blend-mode': 'normal',
  opacity: '1',
  rotate: 'none',
  scale: 'none',
  transform: 'none',
  translate: 'none',
  visibility: 'visible',
}

/** The markup the price list gives its open button, from EntityEditor and AdminPricing:
 *  a refused open button in a table cell inside the member shell, beside a live one.
 *
 *  **The whole chain.** `#root` comes from `index.html`, `.shell` and
 *  `main#content.shell__main` from `Shell.tsx`, `.adminsection` and `.adminsection__body`
 *  from `SectionNav.tsx`, which the route table wraps around every `administracija/*`
 *  screen. Left out, a rule keyed on any of them beats the refusal on specificity alone
 *  and is measured as though it were not there: that happened twice, and now
 *  `entityStyle.test.ts` holds this against the chain the portal renders.
 *
 *  The sentinel button standing first is where Tab starts from, and it is outside the
 *  chain on purpose so it changes nothing about what is measured.
 *
 *  Every attribute the portal writes is written here too, on **both** controls:
 *  `aria-describedby` and `aria-labelledby` on the refused one, and `aria-disabled=false`
 *  on the live one, which React always writes and this fixture once left out. A rule
 *  keyed on `[aria-disabled='false']` turned every live button in the price list into a
 *  copy of the refusal, so there was no difference left to find, and nothing said a word. An attribute selector weighs the same as a class, so a
 *  rule keyed on one the fixture has not got is a rule this never sees: measured, and
 *  `entityStyle.test.ts` now holds the attribute names of the whole chain as well. */
const PRICE_LIST = `
  <button type="button" id="before">start</button>
  <div id="root"><div class="shell"><main id="content" class="shell__main" tabindex="-1">
    <div class="adminsection"><div class="adminsection__body">
      <div class="member">
        <section class="member__panel" aria-labelledby="panel-name">
          <h2 id="panel-name">Cenovnik</h2>
          <div class="table-scroll">
            <table class="table"><tbody><tr>
              <td><button type="button" class="entity-open" aria-disabled="true" aria-label="Otvori" aria-describedby="note" id="refused">Otvori</button><span id="note" hidden>zatvoreno</span></td>
              <td><button type="button" class="entity-open" aria-disabled="false" aria-label="Otvori" id="live">Otvori</button></td>
            </tr></tbody></table>
          </div>
        </section>
      </div>
    </div></div>
  </main></div></div>
`

/** The markup the form of a new result gives the calendar button, from `DatePicker.tsx`
 *  and the field `FormRenderer.tsx` draws around it, on the one screen that refuses one:
 *  a date filled in from a race chosen out of the list is not the reader's to change, so
 *  the box is held and the calendar beside it is refused (`NewResult.tsx`, `led`).
 *
 *  **The whole chain, and it is a different one.** `#root`, `.shell` and
 *  `main#content.shell__main` are shared with the price list above; below them stand
 *  `.member` from `NewResult.tsx`, `form.form` from `FormRenderer.tsx` (`form--wide`
 *  only where a table stands under the fields, which this screen has not got), `.field`
 *  around the one field, and `.datepicker` around the box and its button. `.form__row`
 *  is not among them because a row is written into the definition of a form and
 *  `unos-rezultata` writes none.
 *
 *  **The box in front of the button is part of the fixture and not decoration.** It is
 *  the sibling `.datepicker .field__control` is written for, it is what Tab meets before
 *  the button, and it is where the difference between this control and the price list
 *  begins: it carries `aria-disabled` and `readonly` and no class of its own, which is
 *  what the portal draws today.
 *
 *  The live twin is a second date field of the same form rather than the same field
 *  twice: two fields is what a form draws, and the comparison needs a control the same
 *  sheet reaches through the same chain. Its button carries no `aria-disabled` at all,
 *  because `DatePicker.tsx` writes `undefined` where the price list writes `false`, and
 *  an attribute selector weighs as much as a class. */
const LOCKED_DATE = `
  <button type="button" id="before">start</button>
  <div id="root"><div class="shell"><main id="content" class="shell__main" tabindex="-1">
    <div class="member">
      <p class="member__note">Unesi rezultat</p>
      <form class="form" aria-labelledby="form-name" novalidate>
        <h1 class="form__title" id="form-name">Unos rezultata</h1>
        <p class="form__legend">Polja sa zvezdicom su obavezna</p>
        <div class="field">
          <span class="field__head">
            <label class="field__label" for="date-held" id="date-held-label">Datum</label>
            <span class="field__required" aria-hidden="true">*</span>
          </span>
          <div class="datepicker">
            <input id="date-held" name="date" class="field__control" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/gggg" aria-required="true" aria-invalid="false" aria-disabled="true" readonly value="17/10/2026">
            <button type="button" class="datepicker__open" aria-disabled="true" aria-expanded="false" aria-label="Otvori kalendar" id="refused"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path></svg></button>
          </div>
        </div>
        <div class="field">
          <span class="field__head">
            <label class="field__label" for="date-free" id="date-free-label">Datum</label>
            <span class="field__required" aria-hidden="true">*</span>
          </span>
          <div class="datepicker">
            <input id="date-free" name="date" class="field__control" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/gggg" aria-required="true" aria-invalid="false" value="">
            <button type="button" class="datepicker__open" aria-expanded="false" aria-label="Otvori kalendar" id="live"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path></svg></button>
          </div>
        </div>
      </form>
    </div>
  </main></div></div>
`

/** Both refused controls of this portal, each with the page it stands on and the
 *  difference it is allowed. Everything below runs once for each of them, on a page of
 *  its own: two controls in one document would have to be told apart by two pairs of
 *  ids, and the sentinel Tab starts from can stand before only one of them. */
const CONTROLS = [
  {
    name: 'the button that opens a record',
    markup: PRICE_LIST,
    refusal: OPEN_REFUSAL,
    pseudo: OPEN_PSEUDO,
    quiet: QUIET,
  },
  {
    name: 'the button that opens a calendar',
    markup: LOCKED_DATE,
    refusal: CALENDAR_REFUSAL,
    pseudo: CALENDAR_PSEUDO,
    /* Every quiet decision but one. This is the control that refuses **with** a
       background, so the property `QUIET` pins to nothing for the other one is the very
       property this one's refusal names, and it is asked once, where the control names
       it, rather than twice in two different words. */
    quiet: Object.fromEntries(
      Object.entries(QUIET).filter(([name]) => !(name in CALENDAR_REFUSAL)),
    ),
  },
]

const FIXTURE = (styles, markup) => `<!doctype html>
<html lang="sr" data-theme="dark"><head><meta charset="utf-8">${styles}</head>
<body>${markup}</body></html>`

/** Whole computed styles rather than a handful of properties, for both controls and for
 *  the two pseudo-elements a rule can paint over the button with.
 *
 *  The token probe hangs on `<html>`, so it reads what the theme says at the root. Hung
 *  on `<body>` it inherits whatever an ancestor redefined along with the button, and the
 *  comparison compares a fault with itself. */
const PSEUDOS = ['::before', '::after', '::first-line', '::first-letter', '::selection', '::marker']

/** The one pseudo-element Chrome computes out of its own defaults until something makes
 *  it inherit, and out of the control after that: a custom property declared on the
 *  control flipped it from one mode to the other. It is the only one asked loosely, and
 *  loosening the rest to suit it cost every value check they had. */
const LOOSE = '::selection'

/** Every colour a control names, read where the theme puts it rather than written out
 *  here, and the run stops if one of them is not declared at all: an unknown token
 *  resolves to whatever the probe inherited, which is an expectation about nothing. */
function tokensOf(control) {
  return [
    ...new Set(
      [
        ...Object.values(control.refusal),
        ...Object.values(control.pseudo),
        ...Object.values(control.quiet),
      ].filter((value) => value.startsWith('var(')),
    ),
  ].sort()
}

/** What a named value comes out as in the page: a colour the theme resolved, or the
 *  word itself where it is one. */
function valueOf(named, theme) {
  return named.startsWith('var(') ? theme[named] : named
}

const readFor = (tokens) => `(() => {
  const PSEUDOS = ${JSON.stringify(PSEUDOS)}
  const TOKENS = ${JSON.stringify(tokens)}
  const one = document.getElementById('refused')
  const all = (element, pseudo) => {
    const style = getComputedStyle(element, pseudo)
    const out = {}
    for (let i = 0; i < style.length; i += 1) {
      out[style[i]] = style.getPropertyValue(style[i])
    }
    return out
  }
  const probe = document.createElement('span')
  document.documentElement.append(probe)
  const root = getComputedStyle(document.documentElement)
  const missing = TOKENS.filter((token) => root.getPropertyValue(token.slice(4, -1).trim()) === '')
  const theme = {}
  for (const token of TOKENS) {
    probe.style.color = token
    theme[token] = getComputedStyle(probe).color
  }
  probe.remove()
  return JSON.stringify({
    refused: all(one, null),
    live: all(document.getElementById('live'), null),
    pseudo: PSEUDOS.reduce((into, name) => { into[name] = all(one, name); return into }, {}),
    pseudoLive: PSEUDOS.reduce((into, name) => { into[name] = all(document.getElementById('live'), name); return into }, {}),
    under: one.matches(':hover'),
    pressed: one.matches(':active'),
    ring: one.matches(':focus-visible'),
    missing,
    theme,
  })
})()`

const CENTRE = `(() => {
  const one = document.getElementById('refused')
  one.scrollIntoView({ block: 'center', inline: 'center' })
  const box = one.getBoundingClientRect()
  return JSON.stringify({
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
    seen: box.width > 0 && box.height > 0,
  })
})()`

/** Put the reader one step before the control, so Tab walks into it.
 *
 *  Not `blur()` for this: blurring empties `activeElement` but leaves the sequential
 *  focus navigation starting point where it was, so Tab walked past the control to the
 *  live one. `focus()` moves that starting point, which is what the sentinel is for. */
const START = `(() => {
  document.getElementById('before').focus()
  return JSON.stringify(document.activeElement === null ? 'none' : document.activeElement.id)
})()`

/** Where the keyboard has got to. One Tab reaches the price list's button and two reach
 *  the calendar's, because a date field is a box and then a button, so the walk is a
 *  walk rather than a number written per control: a count is a fact about markup kept
 *  away from the markup, and it goes stale the first time a control gains a neighbour. */
const AT = `(() => JSON.stringify({
  at: document.activeElement === null ? 'none' : document.activeElement.id,
  ring: document.getElementById('refused').matches(':focus-visible'),
}))()`

/** Whether anything on the page is still moving.
 *
 *  The calendar button carries `transition: border-color var(--fast), color var(--fast)`
 *  and `--fast` is 160ms, while every state below was read 120ms after it was asked for.
 *  So the theme was switched, the colours set off towards the new theme, the resting
 *  state was read while they were on their way, and the hovered state was read after
 *  they had arrived: measured, seventeen properties differed between hovering and not
 *  hovering in the light theme, on a control the sheet holds still under the pointer on
 *  purpose. The price list's button carries no transition at all, which is why one
 *  control could be measured for a fortnight without this.
 *
 *  Asked of the browser rather than waited out with a longer sleep, because a number of
 *  milliseconds written here is right until somebody changes `--fast`. */
const STILL = `(() => JSON.stringify(document.getAnimations().length))()`

/** And hands off before the next theme is read. */
const CLEAR = `(() => {
  if (document.activeElement instanceof HTMLElement) { document.activeElement.blur() }
  return JSON.stringify(document.getElementById('refused').matches(':focus-visible'))
})()`

let nextId = 0

async function send(socket, method, params = {}) {
  nextId += 1
  const id = nextId

  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data)

      if (message.id === id) {
        socket.removeEventListener('message', onMessage)
        if (message.error) {
          reject(new Error(`${method} failed: ${JSON.stringify(message.error)}`))

          return
        }

        resolve(message.result)
      }
    }

    socket.addEventListener('message', onMessage)
    socket.send(JSON.stringify({ id, method, params }))
  })
}

/** `Runtime.evaluate` reports a thrown expression as a *successful* reply carrying
 *  `exceptionDetails`, so without this the value arrives as `undefined` and the run dies
 *  further along complaining about JSON instead of about the page. */
async function evaluate(socket, expression) {
  const answer = await send(socket, 'Runtime.evaluate', { expression, returnByValue: true })

  if (answer.exceptionDetails) {
    const thrown = answer.exceptionDetails.exception?.description ?? answer.exceptionDetails.text

    throw new Error(`the page threw while being measured: ${thrown}`)
  }

  return JSON.parse(answer.result.value)
}

async function moveTo(socket, x, y) {
  await send(socket, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 })
  await new Promise((resolve) => setTimeout(resolve, 120))
}

/** Nothing is read while anything is still moving. A state read mid-transition is a
 *  state nobody ever sees, and it is compared with a state somebody does. */
async function still(socket) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await evaluate(socket, STILL)) === 0) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error('something on the page is still moving two seconds after it was asked to')
}

async function tab(socket) {
  for (const type of ['rawKeyDown', 'keyUp']) {
    await send(socket, 'Input.dispatchKeyEvent', {
      type,
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
    })
  }
  await new Promise((resolve) => setTimeout(resolve, 120))
}

/** The page a control is measured on, in the browser this script started. The first is
 *  the one Chrome opened with; the rest are walked to, and the walk is checked rather
 *  than waited out, because a measurement of the page before it is a measurement of the
 *  control that was there a moment ago. */
async function show(socket, address) {
  await send(socket, 'Page.navigate', { url: address })

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100))

    const where = await evaluate(
      socket,
      '(() => JSON.stringify({ href: location.href, state: document.readyState }))()',
    )

    if (where.href === address && where.state === 'complete') {
      return
    }
  }

  throw new Error(`the browser would not show ${address}`)
}

/** Every property in which two computed styles disagree. */
function differences(left, right) {
  /* The keys of both, not of the left one. A rule can give one control a custom property
     the other has not got, and a comparison that walks only the left never looks at it. */
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((name) => !name.startsWith('--'))
    .filter((name) => left[name] !== right[name])
    .sort()
}

/** One control, one theme, four states. The theme is pinned twice, on the root the way
 *  the portal writes it and as the emulated media feature, so which theme gets measured
 *  is decided here and not by the settings of whoever runs this. */
async function measure(socket, theme, control) {
  const READ = readFor(tokensOf(control))

  await send(socket, 'Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme }],
  })
  await evaluate(
    socket,
    `(() => { document.documentElement.dataset.theme = '${theme}'; return JSON.stringify(document.documentElement.dataset.theme) })()`,
  )

  /* Both hands off before anything is read. The second theme used to be measured with
     the control still focused from the first, so all three of its states were the focus
     state and a fault written for the light theme walked straight past: measured. */
  await moveTo(socket, 4, 4)
  await evaluate(socket, CLEAR)
  await still(socket)

  const resting = await evaluate(socket, READ)

  if (resting.missing.length > 0) {
    throw new Error(
      `${theme}: the theme declares no ${resting.missing.join(', ')}, so the refusal is held against nothing`,
    )
  }
  if (resting.under || resting.ring) {
    throw new Error(
      `${theme}: the control is still hovered or focused while the resting state is read`,
    )
  }

  const centre = await evaluate(socket, CENTRE)

  if (!centre.seen) {
    throw new Error(`${theme}: the control has no box on the page, so nothing was measured`)
  }

  await moveTo(socket, centre.x, centre.y)
  await still(socket)

  const hovered = await evaluate(socket, READ)

  if (!hovered.under) {
    throw new Error(
      `${theme}: the mouse did not land on the control (${centre.x}, ${centre.y}), so nothing about hovering was measured`,
    )
  }
  if (hovered.ring) {
    throw new Error(`${theme}: the control is focused while the hovered state is read`)
  }

  /* And while it is pressed. A state, not a property, so the blind spot the header owns
     up to does not cover it: a review lit the refusal up under `:active` and every
     comparison stayed quiet because nobody ever pressed it. */
  await send(socket, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: centre.x,
    y: centre.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })
  await new Promise((resolve) => setTimeout(resolve, 120))
  await still(socket)

  const pressed = await evaluate(socket, READ)

  await send(socket, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: centre.x,
    y: centre.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })

  if (!pressed.pressed) {
    throw new Error(`${theme}: the press did not reach the control, so nothing about :active was measured`)
  }

  /* And under the keyboard, the state these refusals are built around: it is
     `aria-disabled` and not `disabled`, so the control stays in the order of focus on
     purpose, and the ring is what a reader without a mouse has. Tab rather than
     `.focus()`, because `:focus-visible` is the browser's own judgement about how focus
     arrived. */
  await moveTo(socket, 4, 4)

  const from = await evaluate(socket, START)

  if (from !== 'before') {
    throw new Error(`${theme}: the sentinel before the control would not take focus (${from})`)
  }

  let landed = { at: 'before', ring: false }

  /* Bounded, and the bound is a fixture that has grown a control nobody meant to put in
     front of this one rather than a limit anybody is meant to reach. */
  for (let step = 0; step < 6 && landed.at !== 'refused'; step += 1) {
    await tab(socket)
    landed = await evaluate(socket, AT)
  }

  if (landed.at !== 'refused') {
    throw new Error(
      `${theme}: Tab from the sentinel never reached the control (it stopped on ${landed.at})`,
    )
  }

  await still(socket)

  const focused = await evaluate(socket, READ)

  if (!focused.ring) {
    throw new Error(
      `${theme}: Tab did not leave the control focus-visible, so nothing about the focus ring was measured`,
    )
  }

  return { resting, hovered, pressed, focused }
}

function complaintsFor(where, control, { resting, hovered, pressed, focused }) {
  const complaints = []
  const say = (text) => complaints.push(`${where}: ${text}`)
  const list = (names) => (names.length === 0 ? 'nothing' : names.join(', '))
  /* What this control is allowed to differ from its live twin in, and what each
     pseudo-element of it is allowed to differ in. Both are sorted, because a difference
     is. */
  const REFUSAL = Object.keys(control.refusal).sort()
  const ALLOWED = Object.keys(control.pseudo).sort()

  const states = [
    ['at rest', resting],
    ['under the mouse', hovered],
    ['while pressed', pressed],
    ['under the keyboard', focused],
  ]

  const lit = differences(hovered.refused, resting.refused)
  const ringed = differences(focused.refused, resting.refused)
  const refusal = differences(resting.refused, resting.live)

  if (SHOW) {
    console.log(`${where} hovered vs resting :`, list(lit))
    console.log(`${where} focused vs resting :`, list(ringed))
    console.log(`${where} refused vs live    :`, list(refusal))
    for (const name of PSEUDOS) {
      console.log(`${where} ${name.padEnd(15)} :`, list(differences(resting.pseudo[name], resting.pseudoLive[name])))
    }

    return []
  }

  if (lit.length > 0) {
    say(`under the mouse it changes, which is what said it was live (${list(lit)})`)
  }

  const held = differences(pressed.refused, resting.refused)

  if (held.length > 0) {
    say(`while pressed it changes, which is the same thing said with a finger down (${list(held)})`)
  }
  const strayed = ringed.filter((name) => !RING.includes(name))

  if (strayed.length > 0) {
    say(`under the keyboard it changes something other than its ring (${list(strayed)})`)
  }
  /* And it does change. Asked only as "nothing beyond the ring", an empty difference
     answers yes: a review declared `outline` on `.entity-open` itself, which outweighs
     the browser's own `:focus-visible`, so the control looked identical focused and
     resting and a reader without a mouse had no idea where they were. */
  if (ringed.length === 0) {
    say('under the keyboard nothing about it changes, so there is no sign of focus at all')
  }
  if (list(refusal) !== list(REFUSAL)) {
    say(`beside the live control it differs in ${list(refusal)}, and the refusal is ${list(REFUSAL)}`)
  }

  for (const [state, one] of states) {
    const seen = one.refused

    for (const [name, named] of Object.entries(control.refusal)) {
      /* The ring is allowed to take the focus state off the refused colour, and only
         there. */
      if (state === 'under the keyboard' && RING.includes(name)) {
        continue
      }

      const expected = valueOf(named, one.theme)
      /* And where the value came from a token, the token as well: `rgb(23, 36, 61)` is
         a number nobody can look up, and `var(--surface-hover)` is the line in the
         sheet that has to change if this complaint is the wrong one. */
      const because = named === expected ? '' : `, which is what ${named} says`

      if (seen[name] !== expected) {
        say(`${state} its ${name} is ${seen[name]} rather than ${expected}${because}`)
      }
    }

    for (const [name, named] of Object.entries(control.quiet)) {
      const expected = valueOf(named, one.theme)

      if (seen[name] !== expected) {
        say(`${state} its ${name} is ${seen[name]} rather than ${expected}`)
      }
    }

    /* Both controls are drawn with a border, and a refusal that quietly takes it away is
       a refusal a reader meets as a missing control. */
    for (const side of ['top', 'right', 'bottom', 'left']) {
      if (seen[`border-${side}-style`] !== 'solid' || !(parseFloat(seen[`border-${side}-width`]) > 0)) {
        say(`${state} its ${side} border is gone (${seen[`border-${side}-style`]} ${seen[`border-${side}-width`]})`)
      }
    }

    /* Every pseudo-element the specification gives this control, not the two that were
       thought of first: a review painted the label through `::first-line` and nothing
       here looked.
       Each is held against the same pseudo-element of the live control rather than
       against the control itself, because a pseudo-element differs from its element in
       fifty browser defaults and in nothing anybody wrote. Beside its twin it differs in
       the refusal and nothing else, which is the same closed question asked once more.
       A subset rather than an equality for `::selection`, because Chrome computes it out
       of its own defaults until something makes it inherit, and then out of the control:
       measured, a custom property declared on the control flipped it from one to the
       other and turned an equality into forty-three complaints about a change that
       painted nothing. */
    for (const name of PSEUDOS) {
      const own = differences(one.pseudo[name], one.pseudoLive[name])

      const apart = own.filter((property) => !ALLOWED.includes(property))

      if (apart.length > 0) {
        say(`${state} its ${name} differs from the live one in ${list(apart)}, which is not the refusal`)
      }
      if (name !== LOOSE && list(own) !== list(ALLOWED)) {
        say(`${state} its ${name} carries ${list(own)} of the refusal, and the refusal is ${list(ALLOWED)}`)
      }

      /* And that it draws nothing at all. The sideways comparison cannot carry this:
         a `content` given to both controls alike leaves no difference between them.
         This check existed, was dropped when the comparison turned sideways, and a
         review put `.entity-open::before { content: "!! " }` over both. */
      if ((name === '::before' || name === '::after') && one.pseudo[name].content !== 'none') {
        say(`${state} a ${name} is drawn over it (content ${one.pseudo[name].content})`)
      }

      /* And in the same values, not merely in the same property names. A review wrote
         `::first-line { color: var(--accent) }`, the names never moved, and the label
         came out in the live colour.
         The whole set, not only what still differs from the live control. Asked over the
         difference, a rule that puts the live colour back on the refused label takes that
         property out of the difference and out of the checking with it: measured, and the
         label came out in the live colour with nothing said. Only `::selection` is asked
         over the difference, because it is the one that sometimes inherits nothing. */
      const asked = name === LOOSE ? own.filter((taken) => ALLOWED.includes(taken)) : ALLOWED

      for (const property of asked) {
        const expected = valueOf(control.pseudo[property], one.theme)

        if (one.pseudo[name][property] !== expected) {
          say(`${state} its ${name} takes a ${property} of its own (${one.pseudo[name][property]}, and the refusal is ${expected})`)
        }
      }
    }
  }

  /* The live control beside it, which nothing about this fault should touch. If it stops
     looking live, the sheet is not reaching these buttons at all and every quiet check
     above is quiet for the wrong reason. */
  if (resting.live.cursor !== 'pointer') {
    say(`the live control beside it lost the pointer (${resting.live.cursor}), so the sheet is not reaching these buttons`)
  }

  /* A ring that is really there rather than merely declared: `outline: 2px solid
     transparent` is an idiom of this very repo (`ColumnChart.css`), and a negative offset
     large enough pulls the ring inside the control and out of sight. */
  const ring = focused.refused
  const width = parseFloat(ring['outline-width'])
  const offset = parseFloat(ring['outline-offset'])

  if (ring['outline-style'] === 'none' || !(width > 0)) {
    say(`under the keyboard it has no focus ring (${ring['outline-style']} ${ring['outline-width']})`)
  }
  if (ring['outline-color'] === TRANSPARENT) {
    say('under the keyboard its focus ring is transparent')
  }
  if (offset <= -width) {
    say(`under the keyboard its focus ring is pulled inside the control (offset ${ring['outline-offset']} against width ${ring['outline-width']})`)
  }

  return complaints
}

async function main() {
  const dist = join(process.cwd(), 'dist', 'assets')

  if (!existsSync(dist)) {
    throw new Error(`no ${dist}; run \`npm run build\` first`)
  }

  /* In the order `dist/index.html` names them, which is the order the browser cascades
     them in. Read off the folder instead, they come alphabetically by a hashed name,
     which is no order at all: measured, the same rule won or lost depending only on
     what its file was called. Today the build emits one sheet and it cannot matter;
     the first lazy route makes it matter. */
  const shell = readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf-8')
  const named = [...shell.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(
    (found) => String(found[1]).replace(/^\/?assets\//, ''),
  )
  /* And then everything else the build emitted. Vite writes the sheet of a lazily
     imported chunk into the folder and not into `index.html`, so reading the shell alone
     drops exactly the sheet the first lazy route brings, which was the case this was
     written for: measured, a fault in such a sheet went unseen. They are appended after
     the named ones because that is when the browser adds them, at run time. */
  const rest = readdirSync(dist)
    .filter((name) => name.endsWith('.css') && !named.includes(name))
    .sort()
  const sheets = [...named, ...rest]

  if (sheets.length === 0) {
    throw new Error('no built stylesheet; run `npm run build` first')
  }

  /* Named for this run. A browser left behind by an earlier run that never reached its
     `finally` sits on the port showing a fixture at the very same path, so matching by
     address matched somebody else's page holding somebody else's CSSOM: measured, it
     reported a broken sheet as sound. A pid alone is not enough, because Windows hands
     pids back out. Anything an interrupted run left behind is swept here. */
  for (const stale of readdirSync(dist).filter((name) => name.startsWith('refused-control-fixture'))) {
    rmSync(join(dist, stale), { recursive: true, force: true })
  }

  const styles = sheets.map((name) => `<link rel="stylesheet" href="${name}">`).join('')
  const run = `${process.pid}-${randomUUID()}`
  /* A page of its own for each control, all of them written before the browser starts:
     the browser is opened on the first and walked to the rest, and a page that was never
     written is a walk that ends on `about:blank` with every comparison quiet. */
  const pages = CONTROLS.map((control, index) => {
    const page = join(dist, `refused-control-fixture-${run}-${index}.html`)

    writeFileSync(page, FIXTURE(styles, control.markup))

    return { control, page, address: pathToFileURL(page).href }
  })
  const [first] = pages

  if (first === undefined) {
    throw new Error('no control to measure')
  }

  const profile = mkdtempSync(join(tmpdir(), 'btl-chrome-'))
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    first.address,
  ])

  chrome.on('error', (problem) => {
    console.error(`Chrome did not start from ${CHROME}: ${problem.message}`)
    console.error('set CHROME_PATH to the browser on this machine')
    process.exitCode = 1
  })

  try {
    let target = null

    for (let attempt = 0; attempt < 60 && target === null; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()

        target = list.find((one) => one.type === 'page' && one.url === first.address) ?? null
      } catch {
        target = null
      }
    }

    if (target === null) {
      throw new Error(
        `nothing on port ${PORT} is showing ${first.address}; a browser left over from an earlier run may be holding the port (set BTL_CDP_PORT or close it)`,
      )
    }

    const socket = new WebSocket(target.webSocketDebuggerUrl)

    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve)
      socket.addEventListener('error', reject)
    })

    const complaints = []

    for (const [index, one] of pages.entries()) {
      /* The first is the page the browser opened with, and asking it to go where it
         already is costs a reload and a second wait. */
      if (index > 0) {
        await show(socket, one.address)
      }

      for (const width of WIDTHS) {
        /* A size of its own, so the control has a box and the mouse has somewhere to land
           whatever window the browser happened to open with. */
        await send(socket, 'Emulation.setDeviceMetricsOverride', {
          width,
          height: 800,
          deviceScaleFactor: 1,
          mobile: false,
        })

        for (const theme of ['dark', 'light']) {
          complaints.push(
            ...complaintsFor(
              `${one.control.name}, ${theme} at ${width}px`,
              one.control,
              await measure(socket, theme, one.control),
            ),
          )
        }
      }
    }

    socket.close()

    if (SHOW) {
      return
    }

    if (complaints.length > 0) {
      console.error('a refused control does not look refused:')
      complaints.forEach((one) => console.error(`  - ${one}`))
      process.exitCode = 1

      return
    }

    console.log(
      `both refused controls still look refused in both themes, measured in Chrome (${CONTROLS.map((one) => one.name).join('; ')})`,
    )
  } finally {
    chrome.kill()
    for (const one of pages) {
      try {
        rmSync(one.page, { force: true })
      } catch {
        console.log(`fixture left behind: ${one.page}`)
      }
    }
    /* The profile is left to the system's temp folder if Windows refuses: Chrome holds
       its files for a moment after the kill, and a failed delete must not turn a
       finished measurement into a crash. */
    await new Promise((resolve) => setTimeout(resolve, 300))
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {
      console.log(`profile left behind: ${profile}`)
    }
  }
}

await main()
