/**
 * Does the refused control still look refused, measured in a real browser.
 *
 * jsdom cannot answer this. Nine rounds of review on
 * `src/pages/admin/entityStyle.test.ts` proved it: every version tried to compute the
 * cascade and each was blind to the next axis, and the last one was beaten by an
 * inline style, which no stylesheet can outweigh. A browser computes the cascade
 * itself, so it is asked instead.
 *
 * Run by hand, not in the gate: it needs a build and a browser, and the gate must
 * stay fast. `node scripts/refused-control-appearance.mjs`
 *
 * No new dependency. Chrome is driven over the DevTools Protocol with the WebSocket
 * built into Node, and hovering is a real mouse move rather than a guess about what
 * `:hover` means.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9333

/** The markup the price list gives this control, from EntityEditor and AdminPricing:
 *  a refused open button in a table cell inside the member shell. */
const FIXTURE = (styles) => `<!doctype html>
<html lang="sr"><head><meta charset="utf-8">${styles}</head>
<body data-theme="dark">
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
</body></html>`

async function send(socket, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data)

      if (message.id === id) {
        socket.removeEventListener('message', onMessage)
        if (message.error) {
          reject(new Error(JSON.stringify(message.error)))

          return
        }

        resolve(message.result)
      }
    }

    socket.addEventListener('message', onMessage)
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function main() {
  const dist = join(process.cwd(), 'dist', 'assets')
  const sheets = readdirSync(dist).filter((name) => name.endsWith('.css'))

  if (sheets.length === 0) {
    throw new Error('no built stylesheet in dist/assets; run `npm run build` first')
  }

  const page = join(dist, 'refused-control-fixture.html')

  writeFileSync(page, FIXTURE(sheets.map((name) => `<link rel="stylesheet" href="${name}">`).join('')))

  const profile = mkdtempSync(join(tmpdir(), 'btl-chrome-'))
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    pathToFileURL(page).href,
  ])

  try {
    let target = null

    for (let attempt = 0; attempt < 60 && target === null; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()

        target = list.find((one) => one.type === 'page') ?? null
      } catch {
        target = null
      }
    }

    if (target === null) {
      throw new Error('Chrome did not open a page to talk to')
    }

    const socket = new WebSocket(target.webSocketDebuggerUrl)

    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve)
      socket.addEventListener('error', reject)
    })

    /* The page is asked what the theme says those tokens are, read at the root where
       the theme defines them. The refusal is written through them, so on screen it has
       to resolve to exactly those; a rule that redefines a token on an ancestor never
       touches the button and would pass any check that compares the button only with
       itself. Kept out of the evaluated string, where a backtick would end it. */
    const read = async (id, hovering) => {
      const script = `(() => {
        const one = document.getElementById('refused')
        const style = getComputedStyle(one)
        return JSON.stringify({
          cursor: style.cursor,
          color: style.color,
          borderColor: style.borderTopColor,
          background: style.backgroundColor,
          live: (() => { const l = getComputedStyle(document.getElementById('live')); return { color: l.color, cursor: l.cursor } })(),
          theme: (() => {
            const root = getComputedStyle(document.documentElement)
            const probe = document.createElement('span')
            document.body.append(probe)
            const asColour = (token) => {
              probe.style.color = 'var(' + token + ')'
              return getComputedStyle(probe).color
            }
            const answer = { muted: asColour('--text-muted'), border: asColour('--border'), accent: asColour('--accent') }
            probe.remove()
            void root
            return answer
          })(),
        })
      })()`

      if (hovering) {
        const box = await send(socket, id, 'Runtime.evaluate', {
          expression: `JSON.stringify(document.getElementById('refused').getBoundingClientRect())`,
          returnByValue: true,
        })
        const rect = JSON.parse(box.result.value)

        await send(socket, id + 1, 'Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
          buttons: 0,
        })
        await new Promise((resolve) => setTimeout(resolve, 120))
      }

      const answer = await send(socket, id + 2, 'Runtime.evaluate', {
        expression: script,
        returnByValue: true,
      })

      return JSON.parse(answer.result.value)
    }

    const resting = await read(10, false)
    const hovered = await read(20, true)

    socket.close()

    const complaints = []
    const accent = (colour) => colour === hovered.theme.accent

    /* Read at the root, so a token redefined on an ancestor shows up as the refusal
       resolving to something the theme did not say. */
    if (resting.color !== resting.theme.muted) {
      complaints.push(
        `at rest its text is not the muted colour (${resting.color}, theme says ${resting.theme.muted})`,
      )
    }
    if (resting.borderColor !== resting.theme.border) {
      complaints.push(
        `at rest its border is not the border colour (${resting.borderColor}, theme says ${resting.theme.border})`,
      )
    }
    if (hovered.color !== hovered.theme.muted || hovered.borderColor !== hovered.theme.border) {
      complaints.push(
        `under the mouse it stops being muted (${hovered.color} / ${hovered.borderColor})`,
      )
    }

    if (hovered.cursor === 'pointer') {
      complaints.push(`under the mouse the refused control carries the pointer (${hovered.cursor})`)
    }
    if (resting.cursor !== 'not-allowed') {
      complaints.push(`at rest the refused control does not carry not-allowed (${resting.cursor})`)
    }
    if (accent(hovered.color)) {
      complaints.push(`under the mouse its text is the live colour (${hovered.color})`)
    }
    if (hovered.background !== resting.background) {
      complaints.push(
        `under the mouse its background changes (${resting.background} to ${hovered.background})`,
      )
    }
    if (hovered.borderColor !== resting.borderColor) {
      complaints.push(
        `under the mouse its border changes (${resting.borderColor} to ${hovered.borderColor})`,
      )
    }

    console.log('at rest  ', resting)
    console.log('hovered  ', hovered)

    if (complaints.length > 0) {
      console.error('\nthe refused control does not look refused:')
      complaints.forEach((one) => console.error(`  - ${one}`))
      process.exitCode = 1

      return
    }

    console.log('\nthe refused control still looks refused, measured in Chrome')
  } finally {
    chrome.kill()
    /* The profile is left to the system's temp folder rather than removed here:
       Chrome holds its files for a moment after the kill and Windows refuses the
       delete, which would turn a passing measurement into a crash. */
    await new Promise((resolve) => setTimeout(resolve, 300))
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {
      console.log(`profile left behind: ${profile}`)
    }
  }
}

await main()
