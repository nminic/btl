import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE BOX OF THE TEAM'S LOGO ON „IZMENI TIM” STAYS INSIDE THE PAGE, ON A TELEPHONE, A TABLET AND A DESKTOP (owner, PDL
 * 25.11.2026, „Logo tima, pitanja iz plana”: „urednik šalje logo na strani „Izmeni tim”, u posebnom okviru”).
 *
 * <p>Member 000001 runs Dunavski trkači in the served files. The box is measured as the team's editor first meets it,
 * with no logo yet: its heading, its sentence, the way to choose a picture and the button. Each must lie inside the
 * width of the page, and the page must not scroll sideways (CLAUDE.md, UI standards). Relations, never pixels.
 *
 * <p><b>What this does not measure, said once:</b> the box with a picture in it. The harness answers `/api` with JSON,
 * so a picture at `/api/photos/...` is a 404 here, and the chooser over a picture is the component every picture of the
 * portal is chosen with (`CropChooser`), measured on the member's own picture (`settings.geometry.ts`).
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
  '/api/me': {
    role: 'competitor',
    account: 1,
    mailLanguage: 'sr',
    /* The shape `settings.geometry.ts` answers for the same member. */
    member: {
      memberNumber: '000001',
      country: 'RS',
      firstSeason: 2014,
      membershipBasis: 'payment',
      active: true,
      referralCode: '7f07b38ff7ee7543',
      referredCount: 4,
      firstName: 'Vladan',
      lastName: 'Đurišić',
      gender: 'M',
      city: 'Beograd',
      ageBand: '40-54',
      beginner: false,
      categorySeason: 2027,
      categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
      bio: '',
      profileHidden: false,
      birthdayShown: 'none',
      address: 'Bulevar Pupina 10',
      phone: '+381 60 123 456',
      shirtSize: 'L',
    },
  },
  '/api/teams/1/own-logo': { waiting: null, standing: null },
}

const AT: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100, height: 300 },
]

for (const at of AT) {
  test(`the box of the team's logo stays inside the page, ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr/tim/dunavski-trkaci/izmena', '#team-logo', ANSWERS)

    const seen = await page.evaluate(() => {
      const box = document.querySelector('#team-logo')?.closest('section')
      const width = document.documentElement.clientWidth

      return {
        found: box !== null && box !== undefined,
        width,
        sideways: document.documentElement.scrollWidth - width,
        parts: box === null || box === undefined
          ? []
          : [...box.querySelectorAll<HTMLElement>('h2, p, button, label')].map((one) => {
              const drawn = one.getBoundingClientRect()

              return { what: one.tagName + ' ' + (one.textContent ?? '').slice(0, 30), left: drawn.left, right: drawn.right }
            }),
      }
    })

    if (!seen.found || seen.parts.length === 0) {
      throw notMeasured('the box of the team’s logo was not drawn')
    }

    for (const part of seen.parts) {
      expect(part.left, `${part.what} starts left of the page`).toBeGreaterThanOrEqual(0)
      expect(part.right, `${part.what} ends right of the page`).toBeLessThanOrEqual(seen.width + 0.5)
    }

    expect(seen.sideways, 'the page scrolls sideways').toBeLessThanOrEqual(0)
  })
}
