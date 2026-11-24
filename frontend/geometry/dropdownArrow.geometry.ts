import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * EVERY DROPDOWN ON A SCREEN WEARS THE PORTAL'S ARROW, ASKED OF CHROME (owner, 23.11.2026, PDL „Strelica
 * padajućeg izbora je veća”: „I dropdown strelica na 2027 stoji jako malo i skroz desno u ćošku, ne sviđa mi se.
 * Može li malo manje diskretna i estetski lepše?”, every dropdown of the portal).
 *
 * <p>`styles/dropdownArrow.test.ts` holds the cascade: one important rule, and no other important declaration
 * anywhere that could take it away. This holds what jsdom cannot: that the rule lands. On the screens with the
 * dropdowns the owner named (the season of a competition on the form of the administration, the SEZONA filter
 * of the tables and of the teams, and the box of a member on a row of results), <b>every</b> `select` and
 * `.dropdown` the page draws, read off the DOM and not listed here, has the browser's own arrow taken away, the
 * portal's arrow painted in the muted tone of its text (`--text-muted`, owner, 23.11.2026, PDL „Strelica padajućeg izbora je manja i suptilnija”), a chevron 8px wide in a box of 12px (the browser's was about 9) standing
 * in from the right edge and not in the corner, the text kept clear of it, and a height that is the height of the
 * boxes beside it. A telephone and a desktop.
 *
 * <p><b>THE ROOM AT THE EDGE IS THE ROOM THE LANGUAGE BOX HAS</b> (owner, 23.11.2026, PDL „Sve padajuće strelice
 * [...] odmiču se od desne ivice koliko i strelica izbora jezika”: „Ali na jezicima je strelica divno odmaknuta od
 * desne ivice, ne prilepljena kao na ostalim mestima!”). The language box of the header is measured here as one more
 * element with the same arrow (the same size, the same stroke, the muted tone of its text, `--text-muted`, and not the full colour), and its
 * own distance from the edge of its button is the measure: measured in Chrome 23.11.2026, 10px at 1280 and 6px on
 * the telephone header (`.shell__header--phone .lang__btn`, a narrower button). Every dropdown stands that far in
 * from its edge within a pixel on a desktop, and on a telephone it is never nearer to its edge than the language
 * box is, which is why the room is the desktop's 10px on every width and not the telephone header's 6px.
 *
 * <p><b>The mutation that fells it</b> is the browser's arrow given back to one of them (`appearance: auto
 * !important` on `.rankings__field select`), which `dropdownArrow.test.ts` fells as well.
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

function everyAnswer(dir = MOCK, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(
    readdirSync(dir, { withFileTypes: true }).flatMap((entry): [string, unknown][] => {
      const at = join(dir, entry.name)

      if (entry.isDirectory()) {
        return Object.entries(everyAnswer(at, `${prefix}${entry.name}/`))
      }

      return entry.name.endsWith('.json')
        ? [[`/api/${prefix}${entry.name.slice(0, -'.json'.length)}`, JSON.parse(readFileSync(at, 'utf-8'))]]
        : []
    }),
  )
}

const ANSWERS: Answers = {
  ...everyAnswer(),
  '/api/frozen-seasons': [],
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
}

/** The race of `maraton-maratona-2015` the results screen is opened on (`memberChoice.geometry.ts`). */
function theRace(): number {
  const events = ANSWERS['/api/events']
  const races = ANSWERS['/api/races']

  if (!Array.isArray(events) || !Array.isArray(races)) {
    throw notMeasured('the sample carries no events or no races')
  }

  const event: unknown = events.find((one: unknown) => Reflect.get(Object(one), 'slug') === 'maraton-maratona-2015')
  const id: unknown = Reflect.get(Object(event), 'id')
  const race: unknown = Reflect.get(Object(races.filter((one: unknown) => Reflect.get(Object(one), 'eventId') === id).at(-1)), 'id')

  if (typeof race !== 'number') {
    throw notMeasured('the sample has no race of maraton-maratona-2015')
  }

  return race
}

const SCREENS = [
  { name: 'the tables, SEZONA', path: '/sr/tabela', ready: '.rankings__field select' },
  { name: 'the teams, SEZONA', path: '/sr/timovi', ready: '.rankings__field select' },
  { name: 'the form of a competition, its season', path: '/sr/administracija/lige?izmena=1', ready: 'form select' },
  {
    name: 'a row of results, the member',
    path: `/sr/kalendar/maraton-maratona-2015/rezultati?trka=${String(theRace())}`,
    ready: '#league-row-1-member',
  },
]

/* The desktop shorter than the harness's default, so the shortest of these screens is still taller than the
   window and draws the scrollbar every reader's has (`support/harness.ts`). */
const SCREEN_SIZES: At[] = [
  { width: 360, text: 100 },
  { width: 1280, text: 100, height: 500 },
]
const WIDTHS: At[] = SCREEN_SIZES

for (const screen of SCREENS) {
  for (const at of WIDTHS) {
    test(`every dropdown on ${screen.name} wears the portal's arrow, ${label(at)}`, async ({ open }) => {
      const { page } = await open(at, screen.path, screen.ready, ANSWERS)

      /* Every dropdown the page draws, and the one this screen is opened for whatever it is dressed as: a box that
         lost its class is then measured, and found wanting, rather than left out of the measuring. */
      const seen = await page.evaluate((ready) =>
        [...new Set([...document.querySelectorAll<HTMLElement>(`select, .dropdown, ${ready}`)])]
          .filter((one) => one.getClientRects().length > 0)
          .map((one) => {
            const style = getComputedStyle(one)
            const box = one.getBoundingClientRect()
            const field = one.closest('.field, .race__row')
            /* A text box of the same field or row, where there is one: a dropdown is as tall as what stands
               beside it (`--control-height`). */
            const beside = field?.querySelector<HTMLElement>('input:not(.dropdown):not([type="checkbox"]):not([type="radio"])')
            /* The muted tone of the text, asked of the palette on the screen by a probe that wears it. */
            const probe = document.createElement('span')

            probe.style.color = 'var(--text-muted)'
            document.body.append(probe)

            const [r, g, b] = (getComputedStyle(probe).color.match(/\d+/g) ?? []).map(Number)

            probe.remove()
            const hex = [r, g, b].map((one) => (one ?? 0).toString(16).padStart(2, '0')).join('')

            return {
              what: `${one.tagName.toLowerCase()}#${one.id || one.getAttribute('name') || '?'}`,
              appearance: style.appearance,
              image: style.backgroundImage,
              repeat: style.backgroundRepeat,
              size: style.backgroundSize,
              position: style.backgroundPosition,
              paddingRight: parseFloat(style.paddingRight),
              width: box.width,
              height: box.height,
              besideHeight: beside === null || beside === undefined ? null : beside.getBoundingClientRect().height,
              textHex: hex,
            }
          }),
        screen.ready,
      )

      /* The language box of the header, asked the same way: where the box of its arrow ends against the inside of
         its button, how big the arrow is, how thick its line, and whether it is faded. */
      const lang = await page.evaluate(() => {
        const button = document.querySelector<HTMLElement>('.lang__btn')
        const caret = document.querySelector<SVGElement>('.lang__caret')
        const mutedProbe = document.createElement('span')

        mutedProbe.style.color = 'var(--text-muted)'
        document.body.append(mutedProbe)

        const mutedColour = getComputedStyle(mutedProbe).color

        mutedProbe.remove()

        if (button === null || caret === null) {
          return null
        }

        const box = button.getBoundingClientRect()
        const arrow = caret.getBoundingClientRect()
        const style = getComputedStyle(caret)

        return {
          gap: box.right - parseFloat(getComputedStyle(button).borderRightWidth) - arrow.right,
          width: arrow.width,
          height: arrow.height,
          stroke: parseFloat(style.strokeWidth),
          opacity: parseFloat(style.opacity),
          sameAsText: style.stroke === getComputedStyle(button).color,
          muted: style.stroke === mutedColour,
        }
      })

      if (seen.length === 0 || lang === null) {
        throw notMeasured(`${screen.path} drew no dropdown, or no language box`)
      }

      for (const one of seen) {
        expect(one.appearance, `${one.what} draws the browser's own arrow`).toBe('none')
        expect(one.image, `${one.what} wears no arrow of the portal`).toContain('data:image/svg+xml')
        expect(one.image, `${one.what}: the arrow is not in the muted colour of its text`).toContain(`%23${one.textHex}`)
        expect(one.repeat, one.what).toBe('no-repeat')
        expect(one.size, `${one.what}: the arrow is not the size the portal gives it`).toBe('12px 12px')
        /* `right 10px center`, as Chrome gives it back: the room of the language box at the edge. */
        const standsIn = Number(/^calc\(100% - ([\d.]+)px\) 50%$/.exec(one.position)?.[1])

        expect(Number.isFinite(standsIn), `${one.what}: the arrow stands at ${one.position}`).toBe(true)
        expect(standsIn, `${one.what}: the arrow stands nearer its edge than the language box's does`).toBeGreaterThanOrEqual(
          lang.gap - 1,
        )

        if (at.width >= 1000) {
          expect(standsIn, `${one.what}: the arrow is not as far from the edge as the language box's`).toBeCloseTo(lang.gap, 0)
        }

        expect(one.paddingRight, `${one.what}: the text can run under the arrow`).toBeGreaterThanOrEqual(standsIn + 12 + 4)
        expect(one.width, `${one.what} is too narrow to hold its arrow`).toBeGreaterThan(standsIn + 12 + 4)

        if (one.besideHeight !== null) {
          expect(one.height, `${one.what} is not as tall as the box beside it`).toBeCloseTo(one.besideHeight, 0)
        }
      }

      /* The language box wears the same arrow: the same box, the same line, the muted tone of its text. */
      expect(lang.width, 'the language arrow is not the size of the dropdowns').toBeCloseTo(12, 0)
      expect(lang.height, 'the language arrow is not the size of the dropdowns').toBeCloseTo(12, 0)
      expect(lang.stroke, 'the line of the language arrow is not the line of the dropdowns').toBeCloseTo(2, 1)
      expect(lang.opacity, 'the language arrow is faded').toBe(1)
      expect(lang.muted, 'the language arrow is not in the muted tone of the dropdowns').toBe(true)
      expect(lang.sameAsText, 'the language arrow is still in the full colour of its text').toBe(false)

      /* One arrow on the screen, the same picture on every dropdown of it. */
      expect(new Set(seen.map((one) => one.image)).size, seen.map((one) => one.what).join(', ')).toBe(1)

      /* And a select is still a control a reader can reach and hear as one: in the tab order, by its role. */
      const selects = page.locator('select:visible')

      for (let index = 0; index < (await selects.count()); index += 1) {
        const select = selects.nth(index)

        await select.focus()
        await expect(select, 'the select could not take the cursor').toBeFocused()
        expect(await select.evaluate((one) => one.tabIndex)).toBeGreaterThanOrEqual(0)
      }

      await expect(page.getByRole('combobox').first()).toBeVisible()
    })
  }
}
