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
 *     node scripts/refused-control-appearance.mjs
 *
 * Chrome is taken from `CHROME_PATH`, falling back to the usual Windows install; on
 * Linux and macOS that variable has to be given. The debugging port is `BTL_CDP_PORT`,
 * 9333 by default, and the browser this script talks to is the one it started, checked
 * by the address of the page rather than assumed.
 *
 * **What is measured, exactly:** the built stylesheet, over the ancestor chain the
 * price list gives this control, in **both themes**, at rest and under a real mouse
 * whose landing is checked rather than hoped for.
 *
 * **What is not measured, and this list is the honest part of the file:** the markup
 * below is written here rather than drawn by the portal, so it sees nothing a component
 * puts on the element itself. An inline style is exactly the axis that beat the last
 * jsdom guard, and it is answered where jsdom answers it exactly: `entityStyle.test.ts`
 * asserts that the rendered button carries no `style` attribute at all. Neither check
 * covers it alone; together they do.
 *
 * The chain of ancestors is copied from `index.html` and `Shell.tsx`, which makes it a
 * fact with two homes and therefore a fact that can drift: a wrapper added to the shell
 * and not added here takes any rule keyed on it out of this measurement without a word.
 * When the shell grows an element, it belongs in the fixture on the same day.
 *
 * No new dependency. Chrome is driven over the DevTools Protocol with the WebSocket
 * built into Node.
 */
import { spawn } from 'node:child_process'
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
 *  **The whole chain, not the last few links.** `#root` comes from `index.html`, and
 *  `.shell` and `main#content.shell__main` from `Shell.tsx`: every screen of the portal
 *  hangs under those three. Left out, a rule keyed on any of them beats the refusal on
 *  specificity alone and is measured as if it were not there, which was the shape of
 *  this fixture until a review wrote `#root .entity-open[aria-disabled='true']:hover`
 *  and watched it pass.
 *
 *  `data-theme` sits on `<html>` and not on `<body>`, because that is where the portal
 *  writes it (`ThemeProvider.tsx`, `index.html`) and where `tokens.css` reads it. On
 *  `<body>` the attribute selects nothing and a fault written for a theme walks past. */
const FIXTURE = (styles) => `<!doctype html>
<html lang="sr" data-theme="dark"><head><meta charset="utf-8">${styles}</head>
<body>
  <div id="root"><div class="shell"><main id="content" class="shell__main" tabindex="-1">
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
    under: one.matches(':hover'),
    live: { color: live.color, cursor: live.cursor },
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

  return { resting, hovered }
}

function complaintsFor(theme, { resting, hovered }) {
  const complaints = []
  const say = (text) => complaints.push(`${theme}: ${text}`)

  /* The live control beside it, which nothing about this fault should touch. If it
     stops looking live, the sheet is not reaching these buttons at all and every
     quiet check below is quiet for the wrong reason. */
  if (hovered.live.cursor !== 'pointer') {
    say(`the live control beside it lost the pointer (${hovered.live.cursor}), so the sheet is not reaching these buttons`)
  }

  /* Compared with what the theme says at the root, so a token redefined anywhere on
     the way down shows up as the refusal resolving to something else. */
  if (resting.color !== resting.theme.muted) {
    say(`at rest its text is not the muted colour (${resting.color}, theme says ${resting.theme.muted})`)
  }
  if (resting.borderColor !== resting.theme.border) {
    say(`at rest its border is not the border colour (${resting.borderColor}, theme says ${resting.theme.border})`)
  }
  if (hovered.color !== hovered.theme.muted || hovered.borderColor !== hovered.theme.border) {
    say(`under the mouse it stops being muted (${hovered.color} / ${hovered.borderColor})`)
  }

  /* Named rather than merely not-pointer. `all: revert` and a bare `cursor: auto` both
     take the refusal off the pointer without ever reaching `pointer`, and hovering is
     the one state in which a cursor is seen at all. */
  if (resting.cursor !== 'not-allowed') {
    say(`at rest the refused control does not carry not-allowed (${resting.cursor})`)
  }
  if (hovered.cursor !== 'not-allowed') {
    say(`under the mouse the refused control does not carry not-allowed (${hovered.cursor})`)
  }

  /* Named, not merely unchanged between the two states. Asked as a difference, a
     control painted solid in both states answers that nothing changed: a review wrote
     `.table .entity-open { background: var(--accent) !important }` and watched the
     refusal come out filled in the live colour, at 1.6:1 against its own text, while
     this said it still looked refused. */
  if (resting.background !== TRANSPARENT) {
    say(`at rest it is filled rather than transparent (${resting.background})`)
  }
  if (hovered.background !== TRANSPARENT) {
    say(`under the mouse it is filled rather than transparent (${hovered.background})`)
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
    rmSync(join(dist, stale), { force: true })
  }

  const page = join(dist, `refused-control-fixture-${process.pid}.html`)

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
