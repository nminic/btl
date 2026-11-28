import { expect } from '@playwright/test'
import { label, settle, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE PICTURE SENT AS THE PROOF OF A RUN, IN THE QUEUE OF RESULTS, ASKED OF CHROME AT 360, 768 AND 1280.
 *
 * <p>The owner, 28.11.2026: „Odradi i sliku kao dokaz uz rezultat"; the moderator sees it „uz rezultat u redu za
 * proveru" (28.09.2026). jsdom lays nothing out, so what is asked here is what only a browser answers: the picture,
 * a tall telephone photograph of 1080 by 2400, is drawn small inside its cell and inside the window, the table's
 * box does not scroll and the page does not move sideways (PDL P24); and where the picture cannot be loaded, the
 * sentence that stands in for it does neither either.
 */

const TALL = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="2400" viewBox="0 0 1080 2400"><rect width="1080" height="2400" fill="rgb(40,120,200)"/></svg>`

const A_RUN = {
  queue: 'results',
  subjectId: '',
  city: '',
  country: '',
  rating: { organisation: 0, value: 0, ambience: 0 },
  kind: '',
  raceDate: '2027-03-06',
  raceKind: 'length',
  distanceKm: 21.0975,
  ascentM: 150,
  descentM: 150,
  seconds: 5400,
  link: '',
  eventId: null,
  eventName: null,
  eventKind: null,
}

const THE_QUEUE: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/competitors': [],
  '/api/teams': [],
  '/api/races': [],
  '/api/events': [],
  '/api/verification': [
    {
      ...A_RUN,
      id: 711,
      date: '2027-03-08',
      memberNumber: '000010',
      who: 'Aleksandar Konstantin Papadopulos-Karamanlis',
      subject: 'Beogradski polumaraton kroz Košutnjak i Topčider',
      body: 'Sat je pokazivao 1:30:00 na cilju, zvanična lista još nije objavljena https://primer.rs/rezultati',
      raceId: 11,
      photoId: 55,
      crop: { x: 0.5, y: 0.5, size: 1 },
    },
    {
      ...A_RUN,
      id: 712,
      date: '2027-03-09',
      memberNumber: '000020',
      who: 'Bojan Bojić',
      subject: 'Novosadska desetka',
      body: '',
      raceId: 12,
      link: 'https://primer.rs/novi-sad',
      photoId: null,
      crop: null,
    },
  ],
}

const WIDTHS: At[] = [
  { width: 360, text: 100, height: 640 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

const PATH = '/sr/administracija/verifikacija/rezultati'

/** What the page and the row of the picture take up, read off the browser. */
const seen = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const proof = document.querySelector('.review__proof')
    const cell = proof?.closest('td')
    const box = document.querySelector('.table-scroll')

    if (proof === null || proof === undefined || cell === null || cell === undefined || box === null) {
      throw new Error('the proof or its cell or the table is not on the page')
    }

    const picture = (proof.querySelector('img') ?? proof).getBoundingClientRect()
    const within = cell.getBoundingClientRect()

    return {
      sideways: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      viewport: document.documentElement.clientWidth,
      picture: { left: picture.left, right: picture.right, width: picture.width, height: picture.height },
      cell: { left: within.left, right: within.right },
      inside: box.scrollWidth,
      outside: box.clientWidth,
      loaded: proof.querySelector('img')?.complete === true && (proof.querySelector('img')?.naturalWidth ?? 0) > 0,
    }
  })

for (const at of WIDTHS) {
  test(`the picture sent as proof stays small inside its cell and the page, at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, PATH, '.review__proof', THE_QUEUE)

    /* First as the harness answers it, a 404: the sentence that stands in for the picture. */
    const failed = await seen(page)

    expect(failed.sideways).toBe(0)
    expect(failed.inside, `the table's box scrolls: ${JSON.stringify(failed)}`).toBeLessThanOrEqual(failed.outside)
    expect(failed.picture.right, JSON.stringify(failed)).toBeLessThanOrEqual(failed.cell.right + 0.5)

    /* Then with the picture there. */
    await page.route('**/api/verification/*/photo*', (route) =>
      route.fulfill({ status: 200, contentType: 'image/svg+xml', body: TALL }),
    )
    await page.reload()
    await settle(page, '.review__proof img')
    await page.waitForFunction(() => {
      const img = document.querySelector('.review__proof img')

      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
    })

    const drawn = await seen(page)

    expect(drawn.loaded).toBe(true)
    expect(drawn.sideways).toBe(0)
    expect(drawn.inside, `the table's box scrolls: ${JSON.stringify(drawn)}`).toBeLessThanOrEqual(drawn.outside)
    expect(drawn.picture.left).toBeGreaterThanOrEqual(drawn.cell.left - 0.5)
    expect(drawn.picture.right).toBeLessThanOrEqual(Math.min(drawn.cell.right, drawn.viewport) + 0.5)
    /* Small, as the sheet says, and the tall photograph keeps its shape: at most 6rem by 6rem. */
    expect(drawn.picture.height).toBeLessThanOrEqual(96.5)
    expect(drawn.picture.width).toBeLessThanOrEqual(96.5)
    expect(drawn.picture.width).toBeGreaterThan(30)

    /* And Odobri on its row is pressable now that the picture has been seen. */
    await expect(page.locator('tr', { hasText: '000010' }).getByRole('button', { name: 'Odobri' })).toHaveAttribute(
      'aria-disabled',
      'false',
    )
  })
}
