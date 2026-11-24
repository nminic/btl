import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SLACK, label, notMeasured, settle, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE CIRCLE THE ADMINISTRATION MOVES, ASKED OF CHROME (owner, 23.11.2026, PDL „Administracija sama podešava
 * krug na članovoj slici": „kad takmičar pošalje sliku na validaciju, ja kao Admin hoću da mogu da se poigram
 * krugom pre nego što mu je odobrim. Čak i kad mu uđem u podatke, želim da mogu da se poigram krugom pa da je
 * sačuvam.").
 *
 * <p>Two places, and on each: <b>the page does not move sideways</b> (PDL P24), <b>every slider stands whole
 * inside the page</b>, and <b>the circle moves from the keyboard</b>: a slider takes the arrow key and the
 * frame of the circle moves with it, which jsdom cannot show because it moves nothing on a key.
 *
 * <p><b>And the height, the same in both.</b> The circle is dragged over the picture in both places, so the
 * picture is capped to the window as it is for the member (`CropWindow`); on the card that is the owner's
 * decision of 24.11.2026: „Na kartici slike koja čeka administrator krug vuče po slici (prstom ili mišem), kao
 * član; slika se tada ograničava po visini kao kod člana." The picture is a tall telephone photograph, 1080 by
 * 2400, which is the shape that made the cap, and on a telephone of 360 by 640 the card's „Odobri" and
 * „Odbij" are reached past it, with page to scroll on beside the picture wherever it stands.
 */

const TALL = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="2400" viewBox="0 0 1080 2400"><rect width="1080" height="2400" fill="rgb(40,120,200)"/><rect y="1200" width="1080" height="1200" fill="rgb(200,120,40)"/></svg>`

const TALL_AS_DATA = `data:image/svg+xml,${encodeURIComponent(TALL)}`

const SUPERADMIN = { role: 'superadmin', account: 11, mailLanguage: 'sr' }

const NUMBER = '000001'

const ROW = {
  memberNumber: NUMBER,
  firstName: 'Vladan',
  lastName: 'Đurišić',
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  category: { season: 2027, ageBand: '40-54', beginner: false },
  categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
  firstSeason: 2014,
  bio: '',
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  photo: TALL_AS_DATA,
  crop: { x: 0.5, y: 0.3, size: 0.6 },
}

const HIS_DATA: Answers = {
  '/api/me': SUPERADMIN,
  '/api/competitors': [ROW],
  '/api/teams': [],
  '/api/pairs': [],
  [`/api/members/${NUMBER}/data`]: {
    memberNumber: NUMBER,
    firstName: 'Vladan',
    lastName: 'Đurišić',
    fatherName: 'Petar',
    gender: 'M',
    birthDate: '1980-04-02',
    idNumber: 'AB12345',
    email: 'vladan@primer.rs',
    emailConfirmed: true,
    viberCommunity: false,
    address: 'Ulica 1',
    phone: '+381 60 123 456',
    placeId: null,
    city: 'Beograd',
    country: 'RS',
    shirtSize: 'L',
    bio: '',
    photo: TALL_AS_DATA,
    crop: { x: 0.5, y: 0.3, size: 0.6 },
  },
}

const CARD = 21

const THE_QUEUE: Answers = {
  '/api/me': SUPERADMIN,
  '/api/competitors': [],
  '/api/teams': [],
  '/api/verification': [
    {
      queue: 'profiles',
      id: CARD,
      date: '2026-09-20',
      memberNumber: '000011',
      who: 'Neda Nedić',
      subject: 'Neda Nedić',
      subjectId: '',
      body: '',
      kind: 'photo',
      city: '',
      country: '',
      photoId: 9,
      crop: { x: 0.3, y: 0.7, size: 0.45 },
      rating: { organisation: 0, value: 0, ambience: 0 },
    },
  ],
}

const WIDTHS: At[] = [
  /* A telephone of 360 by 640, the window the cap on the member's chooser was measured in. */
  { width: 360, text: 100, height: 640 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

type Seen = {
  viewport: number
  sliders: { left: number; right: number; width: number }[]
  picture: { width: number; height: number; top: number; bottom: number } | null
  innerHeight: number
}

/** The sliders and the picture inside `within`, as boxes. */
const seenIn = (page: Page, within: string) =>
  page.evaluate((selector): Seen | null => {
    const root = document.querySelector(selector)

    if (root === null) {
      return null
    }

    const picture = root.querySelector('.crop__picture')
    const box = picture?.getBoundingClientRect()

    return {
      viewport: document.documentElement.clientWidth,
      sliders: [...root.querySelectorAll('.crop__slider input[type="range"]')].map((one) => {
        const found = one.getBoundingClientRect()

        return { left: found.left, right: found.right, width: found.width }
      }),
      picture: box === undefined ? null : { width: box.width, height: box.height, top: box.top, bottom: box.bottom },
      innerHeight,
    }
  }, within)

/** The slider moved across by the arrow key, and the frame of the circle with it. */
async function movesFromTheKeyboard(page: Page, within: string): Promise<void> {
  const across = page.locator(`${within} .crop__slider input[type="range"]`).first()
  const frame = page.locator(`${within} .crop__frame`).first()
  const before = { value: await across.inputValue(), left: await frame.evaluate((one) => one.getBoundingClientRect().left) }

  await across.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')

  const after = { value: await across.inputValue(), left: await frame.evaluate((one) => one.getBoundingClientRect().left) }

  expect(Number(after.value), 'the slider did not take the arrow key').toBeCloseTo(Number(before.value) + 0.02, 5)
  expect(after.left, 'the frame of the circle did not move with the slider').toBeGreaterThan(before.left)
  expect(await across.evaluate((one) => one === document.activeElement), 'the slider lost the focus').toBe(true)
}

function inside(seen: Seen, where: string): void {
  if (seen.sliders.length !== 3) {
    throw notMeasured(`${where} drew ${seen.sliders.length} sliders and not three`)
  }

  for (const one of seen.sliders) {
    expect(one.left, `a slider of ${where} starts off the page`).toBeGreaterThanOrEqual(-SLACK)
    expect(one.right, `a slider of ${where} runs off the page`).toBeLessThanOrEqual(seen.viewport + SLACK)
    expect(one.width, `a slider of ${where} has no width`).toBeGreaterThan(40)
  }
}

for (const at of WIDTHS) {
  test(`the moderator drags the circle of a waiting picture, capped, and reaches both buttons past it, ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr/administracija/verifikacija/trkacki-profil', '.submissions', THE_QUEUE)

    /* THE PICTURE ITSELF, which `/api` answers with JSON in the harness: served here and read again. */
    await page.route('**/api/verification/*/photo*', (route) =>
      route.fulfill({ status: 200, contentType: 'image/svg+xml', body: TALL }),
    )
    await page.reload()
    await settle(page, '.submissions')

    const toggle = page.locator(`button[aria-controls="${CARD}-card"]`)

    if (await toggle.isVisible()) {
      await toggle.click()
    }

    await page.locator(`[id="${CARD}-card"] .crop__slider input`).first().waitFor()
    await settle(page, `[id="${CARD}-card"] .crop__slider`)

    const card = `[id="${CARD}-card"]`
    const seen = await seenIn(page, card)

    if (seen === null || seen.picture === null) {
      throw notMeasured('the card drew no picture')
    }

    inside(seen, 'the card')
    /* CAPPED, as the member's is, and still the shape of the picture: the cap takes the width with it. */
    expect(seen.picture.height, 'the waiting picture that takes a drag is taller than the cap').toBeLessThanOrEqual(
      0.6 * seen.innerHeight + 1,
    )
    expect(seen.picture.height / seen.picture.width, 'the capped picture is not the shape of the picture').toBeCloseTo(
      2400 / 1080,
      1,
    )
    expect(
      await page.locator(`${card} .crop__picture`).evaluate((one) => getComputedStyle(one).touchAction),
      'the picture on the card does not take a drag',
    ).toBe('none')

    /* NO WALL: wherever the picture stands in the window, there is page above or below it to scroll on, and
       both buttons of the card come into the window and are what stands at their own middle. */
    expect(seen.innerHeight - seen.picture.height, 'the picture leaves no page to scroll on').toBeGreaterThan(
      0.3 * seen.innerHeight,
    )

    for (const name of ['Odobri', 'Odbij']) {
      const button = page.locator(card).getByRole('button', { name, exact: true })

      await button.scrollIntoViewIfNeeded()

      const reached = await button.evaluate((one) => {
        const box = one.getBoundingClientRect()
        const at = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)

        return { top: box.top, bottom: box.bottom, onTop: at !== null && one.contains(at) }
      })

      expect(reached.top, `„${name}" stands above the window`).toBeGreaterThanOrEqual(-SLACK)
      expect(reached.bottom, `„${name}" stands below the window`).toBeLessThanOrEqual(seen.innerHeight + SLACK)
      expect(reached.onTop, `something covers „${name}"`).toBe(true)
    }

    await movesFromTheKeyboard(page, card)

    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    expect(sideways, 'the page moves sideways').toBeLessThanOrEqual(0)
  })

  test(`the administration moves the circle of the picture on his data, ${label(at)}`, async ({ open }) => {
    const box = 'section[aria-labelledby="their-picture"]'
    const { page, probe } = await open(at, `/sr/takmicar/${NUMBER}-vladan-durisic/podaci`, `${box} .crop__slider`, HIS_DATA)
    const seen = await seenIn(page, box)

    if (seen === null || seen.picture === null) {
      throw notMeasured('the box drew no picture to move the circle over')
    }

    inside(seen, 'the box of his picture')
    /* CAPPED, as the member's own chooser is: the picture takes a drag here. */
    expect(seen.picture.height, 'the picture that takes a drag is taller than the cap').toBeLessThanOrEqual(
      0.6 * seen.innerHeight + 1,
    )

    await movesFromTheKeyboard(page, box)

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)
  })
}
