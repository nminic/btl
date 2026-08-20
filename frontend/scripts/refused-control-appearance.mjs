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
 * **What is measured, exactly:** the built stylesheet, over the ancestor chain the
 * price list gives this control, in **both themes**, in **three states** (at rest,
 * under a real mouse whose landing is checked, and under a real Tab whose landing is
 * checked), on every property that can paint the thing: colour, border, background,
 * cursor, shadow, opacity, visibility, filter, text decoration, and the focus ring.
 *
 * Each is compared with a **named** expectation rather than with itself in another
 * state. Two rounds of review were lost to that difference: a control painted in both
 * states answers a question about change with "nothing changed", and an inset shadow
 * filled the refusal with the accent at 1.4:1 against its own text while a check on the
 * background alone called it refused.
 *
 * **What is not measured, and this list is the honest part of the file:** the markup
 * below is written here rather than drawn by the portal, so it sees nothing a component
 * puts on the element itself. An inline style is exactly the axis that beat the last
 * jsdom guard, and it is answered where jsdom answers it exactly: `entityStyle.test.ts`
 * asserts that the rendered button carries no `style` attribute at all. Neither check
 * covers it alone; together they do.
 *
 * The chain of ancestors below is a fact with two homes, here and in the portal, and it
 * drifted twice: `#root`, `.shell` and `.shell__main` were missing, and then
 * `.adminsection` and `.adminsection__body` were, and each time a rule keyed on the
 * missing link walked past this measurement. It is no longer left to care: the same
 * `entityStyle.test.ts` reads this fixture, walks the chain the portal actually renders,
 * and fails the gate when the two stop agreeing.
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
/** What `background: transparent` computes to, which is what the sheet declares for
 *  this control in both of its states. */
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

/** The markup the price list gives this control, from EntityEditor and AdminPricing:
 *  a refused open button in a table cell inside the member shell, beside a live one.
 *
 *  **The whole chain, not the last few links.** `#root` comes from `index.html`,
 *  `.shell` and `main#content.shell__main` from `Shell.tsx`, and `.adminsection` with
 *  `.adminsection__body` from `SectionNav.tsx`, which the route table wraps around every
 *  `administracija/*` screen. Left out, a rule keyed on any of them beats the refusal on
 *  specificity alone and is measured as if it were not there: reviews wrote
 *  `#root .entity-open[aria-disabled='true']:hover` and then
 *  `.adminsection__body .entity-open[aria-disabled='true']:hover`, and watched both pass.
 *  `entityStyle.test.ts` now holds this chain against the rendered one.
 *
 *  The sentinel button before it all is where Tab starts from, and it is outside the
 *  chain on purpose so it changes nothing about what is measured.
 *
 *  `data-theme` sits on `<html>` and not on `<body>`, because that is where the portal
 *  writes it (`ThemeProvider.tsx`, `index.html`) and where `tokens.css` reads it. On
 *  `<body>` the attribute selects nothing and a fault written for a theme walks past. */
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

/** What the page is asked, in both states and both themes.
 *
 *  The probe hangs on `<html>` rather than on `<body>`, so it reads the tokens the
 *  theme defines at the root. Hung on `<body>`, it inherits whatever an ancestor
 *  redefined along with the button, and the comparison compares a fault with itself.
 *
 *  `one.matches(':hover')` is the browser's own answer to whether the mouse is on the
 *  control, and it is what turns the hover half of this measurement from a hope into a
 *  fact. Kept out of a template literal, where a backtick would end the string. */
const READ = `(() => {
  const one = document.getElementById('refused')
  const style = getComputedStyle(one)
  const live = getComputedStyle(document.getElementById('live'))
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
    cursor: style.cursor,
    color: style.color,
    borderColor: style.borderTopColor,
    background: style.backgroundColor,
    shadow: style.boxShadow,
    opacity: style.opacity,
    visibility: style.visibility,
    filter: style.filter,
    decoration: style.textDecorationLine,
    outline: style.outlineStyle + ' ' + style.outlineWidth,
    under: one.matches(':hover'),
    ring: one.matches(':focus-visible'),
    live: { color: live.color, cursor: live.cursor },
    theme,
  })
})()`

/** Put the reader one step before the control, so the next Tab lands on it.
 *
 *  Not `blur()`: blurring empties `activeElement` but leaves the sequential focus
 *  navigation starting point where it was, so on the second theme Tab walked past the
 *  refused control to the live one and the run stopped, saying the ring was never
 *  measured. `focus()` moves that starting point, which is what the sentinel button
 *  standing first in the fixture is for. */
const START = `(() => {
  document.getElementById('before').focus()
  return JSON.stringify(document.activeElement === null ? 'none' : document.activeElement.id)
})()`

const CENTRE = `(() => {
  const box = document.getElementById('refused').getBoundingClientRect()
  return JSON.stringify({
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
    seen: box.width > 0 && box.height > 0,
  })
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
 *  `exceptionDetails`, so without this the value arrives as `undefined` and the run
 *  dies further along complaining about JSON instead of about the page. */
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

/** One theme, both states. The theme is pinned twice: on the root, the way the portal
 *  writes it, and as the emulated media feature, so which theme gets measured is
 *  decided here and not by the settings of whoever runs this. */
async function measure(socket, theme) {
  await send(socket, 'Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme }],
  })
  await evaluate(
    socket,
    `(() => { document.documentElement.dataset.theme = '${theme}'; return JSON.stringify(document.documentElement.dataset.theme) })()`,
  )

  await moveTo(socket, 4, 4)

  const resting = await evaluate(socket, READ)

  if (resting.under) {
    throw new Error(`${theme}: the mouse is still on the control while the resting state is read`)
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

  /* And under the keyboard, which is the state this refusal is built around: it is
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

  /* The live control beside it, which nothing about this fault should touch. If it
     stops looking live, the sheet is not reaching these buttons at all and every
     quiet check below is quiet for the wrong reason. */
  if (hovered.live.cursor !== 'pointer') {
    say(`the live control beside it lost the pointer (${hovered.live.cursor}), so the sheet is not reaching these buttons`)
  }

  /* Every state, and every property that can paint this control, each named rather than
     compared with itself somewhere else. Asked as a difference between two states, a
     control painted in both answers that nothing changed: measured, an inset shadow
     filled the refusal with the accent while a check on the background alone called it
     refused. The portal paints with inset shadows itself (`styles/table.css`), so that
     is a house idiom and not an exotic way to break this. */
  for (const [where, state] of [
    ['at rest', resting],
    ['under the mouse', hovered],
    ['under the keyboard', focused],
  ]) {
    /* Compared with what the theme says at the root, so a token redefined anywhere on
       the way down shows up as the refusal resolving to something else. */
    if (state.color !== state.theme.muted) {
      say(`${where} its text is not the muted colour (${state.color}, theme says ${state.theme.muted})`)
    }
    if (state.borderColor !== state.theme.border) {
      say(`${where} its border is not the border colour (${state.borderColor}, theme says ${state.theme.border})`)
    }
    if (state.background !== TRANSPARENT) {
      say(`${where} it is filled rather than transparent (${state.background})`)
    }
    /* Named rather than merely not-pointer: `all: revert` and a bare `cursor: auto` both
       take the refusal off the pointer without ever reaching `pointer`. */
    if (state.cursor !== 'not-allowed') {
      say(`${where} it does not carry not-allowed (${state.cursor})`)
    }
    if (state.shadow !== 'none') {
      say(`${where} it is painted with a shadow (${state.shadow})`)
    }
    if (state.opacity !== '1') {
      say(`${where} it is dimmed rather than quiet (opacity ${state.opacity})`)
    }
    if (state.visibility !== 'visible') {
      say(`${where} it is not visible (${state.visibility})`)
    }
    if (state.filter !== 'none') {
      say(`${where} a filter is on it (${state.filter})`)
    }
    if (state.decoration !== 'none') {
      say(`${where} its text is decorated (${state.decoration})`)
    }
  }

  /* The ring is the whole reason the refusal is written in colours and not in
     `opacity`, and until now nothing measured it: `outline: none` on this control took
     it away in silence while every other check stayed quiet (WCAG 2.2 SC 1.4.11). */
  if (focused.outline.startsWith('none') || focused.outline.endsWith('0px')) {
    say(`under the keyboard it has no focus ring (${focused.outline})`)
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
     reported a broken sheet as sound. With the run's own name in it, that browser can
     no longer answer for this one, and the wait ends with the message about the port.
     Anything an interrupted run left behind is swept here rather than accumulating. */
  for (const stale of readdirSync(dist).filter((name) => name.startsWith('refused-control-fixture'))) {
    rmSync(join(dist, stale), { recursive: true, force: true })
  }

  /* A pid alone is not enough: Windows hands them back out, so a leftover browser could
     one day be showing the very name this run picks. */
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

        /* By address, not merely the first page. A Chrome left behind on this port
           from an interrupted run keeps it, the new one fails to bind, and without
           this the measurement is taken of somebody else's page and reported as if
           it were this one. */
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

    for (const theme of ['dark', 'light']) {
      console.log(`${theme} at rest  `, measured[theme].resting)
      console.log(`${theme} hovered  `, measured[theme].hovered)
      console.log(`${theme} focused  `, measured[theme].focused)
    }

    if (complaints.length > 0) {
      console.error('\nthe refused control does not look refused:')
      complaints.forEach((one) => console.error(`  - ${one}`))
      process.exitCode = 1

      return
    }

    console.log('\nthe refused control still looks refused in both themes, measured in Chrome')
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
