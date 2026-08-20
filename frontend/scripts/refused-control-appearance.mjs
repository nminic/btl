/**
 * Does the refused control still look refused, measured in a real browser.
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
 * **Nothing here enumerates what could paint the control, and that is the whole design.**
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
 *   refused against live, and the difference has to be the named set below. Something
 *   new painting it shows up as a property nobody put in that set; the refusal going
 *   missing shows up as one of them absent.
 *
 * Those three close the open question. On top of them sit a few named facts no
 * comparison can carry, because a fault that paints both controls the same way, or both
 * states the same way, leaves no difference behind: the refusal is transparent, carries
 * no image, keeps a real border, is drawn in the muted colour the theme names, and its
 * ring is genuinely visible rather than merely declared.
 *
 * **What is measured:** the built stylesheet, over the ancestor chain the price list
 * gives this control, in both themes, in three states, with the mouse and the Tab both
 * checked to have landed.
 *
 * **What is not measured:** the markup below is written here rather than drawn by the
 * portal, so it sees nothing a component puts on the element itself. An inline style is
 * the axis that beat the last jsdom guard, and it is answered where jsdom answers it
 * exactly: `entityStyle.test.ts` asserts the rendered button carries no `style`
 * attribute. That same test holds this fixture against the chain the portal renders,
 * because this chain is a fact with two homes and it drifted twice.
 *
 * No new dependency. Chrome is driven over the DevTools Protocol with the WebSocket
 * built into Node.
 */
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = Number(process.env.BTL_CDP_PORT ?? 9333)
const VIEWPORT = { width: 1280, height: 800 }
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

/** Set `BTL_APPEARANCE_DIFFS=1` to print the three differences instead of judging them.
 *  That is how the two sets below were written, and how they are rewritten on the day
 *  the portal's own styling of these buttons legitimately changes. */
const SHOW = process.env.BTL_APPEARANCE_DIFFS === '1'

/** The refusal, said as the exact set of properties in which it differs from the live
 *  control standing beside it. Written from a measurement, not from the stylesheet. */
const REFUSAL = [
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
  'border-block-end-color',
  'border-block-start-color',
  'border-bottom-color',
  'border-inline-end-color',
  'border-inline-start-color',
  'border-left-color',
  'border-right-color',
  'border-top-color',
  'caret-color',
  'color',
  'column-rule-color',
  'cursor',
  'outline-color',
  'row-rule-color',
  'text-decoration-color',
  'text-emphasis-color',
]

/** What the focus ring is allowed to change, and nothing else. */
const RING = ['outline-color', 'outline-offset', 'outline-style', 'outline-width']

/** The markup the price list gives this control, from EntityEditor and AdminPricing:
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
 *  `data-theme` sits on `<html>` and not on `<body>`, because that is where the portal
 *  writes it (`ThemeProvider.tsx`, `index.html`) and where `tokens.css` reads it. */
const FIXTURE = (styles) => `<!doctype html>
<html lang="sr" data-theme="dark"><head><meta charset="utf-8">${styles}</head>
<body>
  <button type="button" id="before">start</button>
  <div id="root"><div class="shell"><main id="content" class="shell__main" tabindex="-1">
    <div class="adminsection"><div class="adminsection__body">
      <div class="member">
        <section class="member__panel">
          <div class="table-scroll">
            <table class="table"><tbody><tr>
              <td><button type="button" class="entity-open" aria-disabled="true" id="refused">Otvori</button></td>
              <td><button type="button" class="entity-open" id="live">Otvori</button></td>
            </tr></tbody></table>
          </div>
        </section>
      </div>
    </div></div>
  </main></div></div>
</body></html>`

/** Whole computed styles rather than a handful of properties, for both controls and for
 *  the two pseudo-elements a rule can paint over the button with.
 *
 *  The token probe hangs on `<html>`, so it reads what the theme says at the root. Hung
 *  on `<body>` it inherits whatever an ancestor redefined along with the button, and the
 *  comparison compares a fault with itself. */
const READ = `(() => {
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
  const asColour = (token) => {
    probe.style.color = 'var(' + token + ')'
    return getComputedStyle(probe).color
  }
  const theme = {
    muted: asColour('--text-muted'),
    border: asColour('--border'),
    accent: asColour('--accent'),
  }
  probe.remove()
  return JSON.stringify({
    refused: all(one, null),
    live: all(document.getElementById('live'), null),
    before: all(one, '::before'),
    after: all(one, '::after'),
    under: one.matches(':hover'),
    ring: one.matches(':focus-visible'),
    theme,
  })
})()`

const CENTRE = `(() => {
  const box = document.getElementById('refused').getBoundingClientRect()
  return JSON.stringify({
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
    seen: box.width > 0 && box.height > 0,
  })
})()`

/** Put the reader one step before the control, so the next Tab lands on it.
 *
 *  Not `blur()` for this: blurring empties `activeElement` but leaves the sequential
 *  focus navigation starting point where it was, so Tab walked past the control to the
 *  live one. `focus()` moves that starting point, which is what the sentinel is for. */
const START = `(() => {
  document.getElementById('before').focus()
  return JSON.stringify(document.activeElement === null ? 'none' : document.activeElement.id)
})()`

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

/** Every property in which two computed styles disagree. */
function differences(left, right) {
  return Object.keys(left)
    .filter((name) => left[name] !== right[name])
    .sort()
}

/** One theme, three states. The theme is pinned twice, on the root the way the portal
 *  writes it and as the emulated media feature, so which theme gets measured is decided
 *  here and not by the settings of whoever runs this. */
async function measure(socket, theme) {
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

  const resting = await evaluate(socket, READ)

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

  const hovered = await evaluate(socket, READ)

  if (!hovered.under) {
    throw new Error(
      `${theme}: the mouse did not land on the control (${centre.x}, ${centre.y}), so nothing about hovering was measured`,
    )
  }
  if (hovered.ring) {
    throw new Error(`${theme}: the control is focused while the hovered state is read`)
  }

  /* And under the keyboard, the state this refusal is built around: it is
     `aria-disabled` and not `disabled`, so it stays in the order of focus on purpose,
     and the ring is what a reader without a mouse has. Tab rather than `.focus()`,
     because `:focus-visible` is the browser's own judgement about how focus arrived. */
  await moveTo(socket, 4, 4)

  const from = await evaluate(socket, START)

  if (from !== 'before') {
    throw new Error(`${theme}: the sentinel before the control would not take focus (${from})`)
  }

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

  const focused = await evaluate(socket, READ)

  if (!focused.ring) {
    throw new Error(
      `${theme}: Tab did not leave the control focus-visible, so nothing about the focus ring was measured`,
    )
  }

  return { resting, hovered, focused }
}

function complaintsFor(theme, { resting, hovered, focused }) {
  const complaints = []
  const say = (text) => complaints.push(`${theme}: ${text}`)
  const list = (names) => (names.length === 0 ? 'nothing' : names.join(', '))

  const lit = differences(hovered.refused, resting.refused)
  const ringed = differences(focused.refused, resting.refused)
  const refusal = differences(resting.refused, resting.live)

  if (SHOW) {
    console.log(`${theme} hovered vs resting :`, list(lit))
    console.log(`${theme} focused vs resting :`, list(ringed))
    console.log(`${theme} refused vs live    :`, list(refusal))

    return []
  }

  if (lit.length > 0) {
    say(`under the mouse it changes, which is what said it was live (${list(lit)})`)
  }
  if (list(ringed) !== list(RING)) {
    say(`under the keyboard it changes something other than its ring (${list(ringed)}, and the ring is ${list(RING)})`)
  }
  if (list(refusal) !== list(REFUSAL)) {
    say(`beside the live control it differs in ${list(refusal)}, and the refusal is ${list(REFUSAL)}`)
  }

  /* And the few facts no difference can carry, because a fault that paints both controls
     or both states the same way leaves no difference behind. */
  for (const [where, state] of [
    ['at rest', resting],
    ['under the mouse', hovered],
    ['under the keyboard', focused],
  ]) {
    const one = state.refused

    if (one['background-color'] !== TRANSPARENT) {
      say(`${where} it is filled rather than transparent (${one['background-color']})`)
    }
    if (one['background-image'] !== 'none') {
      say(`${where} something is painted behind it (${one['background-image']})`)
    }
    if (one.color !== state.theme.muted) {
      say(`${where} its text is not the muted colour (${one.color}, theme says ${state.theme.muted})`)
    }
    if (one['border-top-color'] !== state.theme.border) {
      say(`${where} its border is not the border colour (${one['border-top-color']}, theme says ${state.theme.border})`)
    }
    if (one.cursor !== 'not-allowed') {
      say(`${where} it does not carry not-allowed (${one.cursor})`)
    }

    for (const side of ['top', 'right', 'bottom', 'left']) {
      if (one[`border-${side}-style`] !== 'solid' || !(parseFloat(one[`border-${side}-width`]) > 0)) {
        say(`${where} its ${side} border is gone (${one[`border-${side}-style`]} ${one[`border-${side}-width`]})`)
      }
    }

    for (const [side, pseudo] of [
      ['before', state.before],
      ['after', state.after],
    ]) {
      if (pseudo.content !== 'none') {
        say(`${where} a ::${side} is drawn over it (content ${pseudo.content})`)
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

  const sheets = readdirSync(dist).filter((name) => name.endsWith('.css'))

  if (sheets.length === 0) {
    throw new Error('no built stylesheet in dist/assets; run `npm run build` first')
  }

  /* Named for this run. A browser left behind by an earlier run that never reached its
     `finally` sits on the port showing a fixture at the very same path, so matching by
     address matched somebody else's page holding somebody else's CSSOM: measured, it
     reported a broken sheet as sound. A pid alone is not enough, because Windows hands
     pids back out. Anything an interrupted run left behind is swept here. */
  for (const stale of readdirSync(dist).filter((name) => name.startsWith('refused-control-fixture'))) {
    rmSync(join(dist, stale), { recursive: true, force: true })
  }

  const page = join(dist, `refused-control-fixture-${process.pid}-${randomUUID()}.html`)

  writeFileSync(page, FIXTURE(sheets.map((name) => `<link rel="stylesheet" href="${name}">`).join('')))

  const address = pathToFileURL(page).href
  const profile = mkdtempSync(join(tmpdir(), 'btl-chrome-'))
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    address,
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

        target = list.find((one) => one.type === 'page' && one.url === address) ?? null
      } catch {
        target = null
      }
    }

    if (target === null) {
      throw new Error(
        `nothing on port ${PORT} is showing ${address}; a browser left over from an earlier run may be holding the port (set BTL_CDP_PORT or close it)`,
      )
    }

    const socket = new WebSocket(target.webSocketDebuggerUrl)

    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve)
      socket.addEventListener('error', reject)
    })

    /* A size of its own, so the control has a box and the mouse has somewhere to land
       whatever window the browser happened to open with. */
    await send(socket, 'Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false,
    })

    const measured = {
      dark: await measure(socket, 'dark'),
      light: await measure(socket, 'light'),
    }

    socket.close()

    const complaints = [
      ...complaintsFor('dark', measured.dark),
      ...complaintsFor('light', measured.light),
    ]

    if (SHOW) {
      return
    }

    if (complaints.length > 0) {
      console.error('the refused control does not look refused:')
      complaints.forEach((one) => console.error(`  - ${one}`))
      process.exitCode = 1

      return
    }

    console.log('the refused control still looks refused in both themes, measured in Chrome')
  } finally {
    chrome.kill()
    try {
      rmSync(page, { force: true })
    } catch {
      console.log(`fixture left behind: ${page}`)
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
