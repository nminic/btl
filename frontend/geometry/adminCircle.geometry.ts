import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SLACK, label, notMeasured, settle, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE CIRCLE ON A PICTURE IS MOVED THE SAME WAY ON EVERY SCREEN THAT MOVES ONE, ASKED OF CHROME (owner,
 * 24.11.2026, PDL „Podešavanje kruga na slici radi identično na svakom mestu portala": „Zelim da ovo za sliku
 * radi identično kao za bilo koje prilagođavanje kruga na slici na portalu (unos članske, znaka tima i sl.)").
 *
 * <p>Four screens: the member's own picture, the administration's box on his data (owner, 23.11.2026, „Čak i
 * kad mu uđem u podatke, želim da mogu da se poigram krugom pa da je sačuvam."), the mark of a league, and the
 * moderator's card of a picture that waits (owner, 24.11.2026, „Na kartici slike koja čeka administrator krug
 * vuče po slici (prstom ili mišem), kao član; slika se tada ograničava po visini kao kod člana."). On every one
 * of them, at 360 (by 640), 768 and 1280, the same five things are asked by one function (`behavesTheSame`):
 *
 * - <b>the height</b>: the picture is capped at 60 per cent of the window, keeps the shape of the picture, and
 *   takes every touch (`touch-action: none`);
 * - <b>the sliders</b>: three, each whole inside the page;
 * - <b>the keyboard</b>: the arrow keys move the size slider and then the slider across, the frame of the
 *   circle moves with them, and the focus stays;
 * - <b>the drag</b>: a press in the middle of the circle carried to the right carries the circle with it;
 * - <b>the page</b> does not move sideways (PDL P24).
 *
 * <p>The picture is a tall telephone photograph, 1080 by 2400, the shape that made the cap; and on the card at
 * 360 by 640 „Odobri" and „Odbij" are reached past it. jsdom draws none of this, which is why it is asked here;
 * that the four screens draw it with one control is `components/oneFace.test.ts`'s.
 */

const TALL = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="2400" viewBox="0 0 1080 2400"><rect width="1080" height="2400" fill="rgb(40,120,200)"/><rect y="1200" width="1080" height="1200" fill="rgb(200,120,40)"/></svg>`

const TALL_AS_DATA = `data:image/svg+xml,${encodeURIComponent(TALL)}`

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every sample answer the portal reads, by the path it is asked at (the shape `dropdownArrow.geometry.ts` uses). */
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

const SUPERADMIN = { role: 'superadmin', account: 11, mailLanguage: 'sr' }

const NUMBER = '000001'

const CROP = { x: 0.5, y: 0.3, size: 0.6 }

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
  crop: CROP,
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
    crop: CROP,
  },
}

/** The member himself (the record `dataCard.geometry.ts` signs him in with), whose picture stands. */
const HIS_OWN: Answers = {
  '/api/competitors': [ROW],
  '/api/teams': [],
  '/api/pairs': [],
  '/api/me': {
    role: 'competitor',
    account: 1,
    mailLanguage: 'sr',
    member: {
      ...ROW,
      category: undefined,
      ageBand: '40-54',
      beginner: false,
      categorySeason: 2027,
      membershipBasis: 'payment',
      active: true,
      referralCode: '7f07b38ff7ee7543',
      referredCount: 4,
      address: 'Bulevar Pupina 10',
      phone: '+381 60 123 456',
      shirtSize: 'L',
      fatherName: 'Petar',
      birthDate: '1980-04-02',
      idNumber: 'AB12345',
      viberCommunity: false,
      photo: '/api/photos/abc',
    },
  },
  '/api/me/photo': { waiting: null, standing: { photo: '/api/photos/abc', crop: CROP } },
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

const THE_LEAGUES: Answers = {
  ...everyAnswer(),
  '/api/frozen-seasons': [],
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
}

const WIDTHS: At[] = [
  /* A telephone of 360 by 640, the window the cap on the member's chooser was measured in. */
  { width: 360, text: 100, height: 640 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

/** A picture route answered with the tall photograph, then the page read again so the picture is drawn. */
async function servedAPictureAt(page: Page, pattern: string, ready: string): Promise<void> {
  await page.route(pattern, (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: TALL }))
  await page.reload()
  await settle(page, ready)
}

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number }

/** The control inside `within`, as boxes. */
const seenIn = (page: Page, within: string) =>
  page.evaluate((selector) => {
    const root = document.querySelector(selector)
    const picture = root?.querySelector('.crop__picture')

    if (root === null || root === undefined || picture === null || picture === undefined) {
      return null
    }

    const box = (one: Element) => {
      const found = one.getBoundingClientRect()

      return { left: found.left, right: found.right, top: found.top, bottom: found.bottom, width: found.width, height: found.height }
    }

    return {
      viewport: document.documentElement.clientWidth,
      innerHeight,
      sliders: [...root.querySelectorAll('.crop__slider input[type="range"]')].map(box),
      picture: box(picture),
      touch: getComputedStyle(picture).touchAction,
    }
  }, within)

const frameOf = (page: Page, within: string) =>
  page.locator(`${within} .crop__frame`).first().evaluate((one): Box => {
    const found = one.getBoundingClientRect()

    return { left: found.left, right: found.right, top: found.top, bottom: found.bottom, width: found.width, height: found.height }
  })

/** The five things every screen that moves a circle must do alike (see the head of this file). */
async function behavesTheSame(page: Page, within: string, where: string): Promise<void> {
  await page.locator(`${within} .crop__slider input`).first().waitFor()

  const seen = await seenIn(page, within)

  if (seen === null) {
    throw notMeasured(`${where} drew no picture to move a circle over`)
  }

  if (seen.sliders.length !== 3) {
    throw notMeasured(`${where} drew ${seen.sliders.length} sliders and not three`)
  }

  /* THE HEIGHT. */
  expect(seen.picture.height, `the picture of ${where} is taller than the cap`).toBeLessThanOrEqual(0.6 * seen.innerHeight + 1)
  expect(seen.picture.height / seen.picture.width, `the picture of ${where} is not the shape of the picture`).toBeCloseTo(
    2400 / 1080,
    1,
  )
  expect(seen.touch, `the picture of ${where} does not take a drag`).toBe('none')

  /* THE SLIDERS. */
  for (const one of seen.sliders) {
    expect(one.left, `a slider of ${where} starts off the page`).toBeGreaterThanOrEqual(-SLACK)
    expect(one.right, `a slider of ${where} runs off the page`).toBeLessThanOrEqual(seen.viewport + SLACK)
    expect(one.width, `a slider of ${where} has no width`).toBeGreaterThan(40)
  }

  /* THE KEYBOARD: the circle made smaller first, so there is room across for it on every screen. */
  const [across, , size] = [0, 1, 2].map((n) => page.locator(`${within} .crop__slider input[type="range"]`).nth(n))

  if (across === undefined || size === undefined) {
    throw notMeasured(`${where} has no sliders to press`)
  }

  const before = { size: Number(await size.inputValue()), frame: await frameOf(page, within) }

  await size.focus()

  for (let press = 0; press < 20; press += 1) {
    await page.keyboard.press('ArrowLeft')
  }

  const smaller = { size: Number(await size.inputValue()), frame: await frameOf(page, within) }

  expect(smaller.size, `the size slider of ${where} did not take the arrow key`).toBeCloseTo(before.size - 0.2, 5)
  expect(smaller.frame.width, `the circle of ${where} did not shrink with its slider`).toBeLessThan(before.frame.width)

  const wasAcross = Number(await across.inputValue())

  await across.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')

  const moved = await frameOf(page, within)

  expect(Number(await across.inputValue()), `the slider across of ${where} did not take the arrow key`).toBeCloseTo(
    wasAcross + 0.02,
    5,
  )
  expect(moved.left, `the circle of ${where} did not move with the slider`).toBeGreaterThan(smaller.frame.left)
  expect(await across.evaluate((one) => one === document.activeElement), `the slider of ${where} lost the focus`).toBe(true)

  /* THE DRAG: pressed in the middle of the circle and carried right. */
  await page.locator(`${within} .crop__picture`).first().scrollIntoViewIfNeeded()

  const start = await frameOf(page, within)
  const middle = { x: start.left + start.width / 2, y: start.top + start.height / 2 }

  await page.mouse.move(middle.x, middle.y)
  await page.mouse.down()
  await page.mouse.move(middle.x + 10, middle.y, { steps: 2 })
  await page.mouse.move(middle.x + 20, middle.y, { steps: 2 })
  await page.mouse.up()

  const dragged = await frameOf(page, within)

  expect(dragged.left, `a drag did not carry the circle of ${where}`).toBeGreaterThan(start.left + 5)

  /* THE PAGE. */
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

  expect(sideways, `the page of ${where} moves sideways`).toBeLessThanOrEqual(0)
}

for (const at of WIDTHS) {
  test(`the member moves the circle of his own picture, ${label(at)}`, async ({ open }) => {
    const box = 'section[aria-labelledby="settings-picture"]'
    const path = `/sr/takmicar/${NUMBER}-vladan-durisic/podaci`
    const { page } = await open(at, path, box, HIS_OWN)

    await servedAPictureAt(page, '**/api/photos/**', `${box} .crop__slider`)
    await behavesTheSame(page, box, 'his own picture')
  })

  test(`the administration moves the circle of the picture on his data, ${label(at)}`, async ({ open }) => {
    const box = 'section[aria-labelledby="their-picture"]'
    const { page } = await open(at, `/sr/takmicar/${NUMBER}-vladan-durisic/podaci`, `${box} .crop__slider`, HIS_DATA)

    await behavesTheSame(page, box, 'the box of his data')
  })

  test(`the administration moves the circle of a league's mark, ${label(at)}`, async ({ open }) => {
    const box = 'section[aria-labelledby="league-mark-1"]'
    const { page } = await open(at, '/sr/administracija/lige?izmena=1', box, THE_LEAGUES)

    await page
      .locator(`${box} input[type="file"]`)
      .setInputFiles({ name: 'znak.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(TALL) })
    await behavesTheSame(page, box, "the league's mark")
  })

  test(`the first click of a mouse after the arrow keys is not lost: the button does not move under it, ${label(at)}`, async ({ open }) => {
    /* Owner, 24.11.2026 (PDL „Sitnice iz recenzije PR-a 815 i 811 i panela tima"): moved with the keyboard, then
       „Odobri" pressed with the mouse, and the first click went nowhere. The strip of sliders is on the screen only
       while the focus is in it, the mouse-down takes the focus out, and the strip folded away under the pointer: the
       button went up by the height of three sliders before the mouse-up, which then landed on what was under it.
       Asked of Chrome because jsdom lays nothing out: the button stands where it stood at the mouse-down, and the
       click is delivered to it. A listener of this case stands in the place of the approval, so nothing is sent. */
    const card = `[id="${CARD}-card"]`
    const { page } = await open(at, '/sr/administracija/verifikacija/trkacki-profil', '.submissions', THE_QUEUE)

    await servedAPictureAt(page, '**/api/verification/*/photo*', '.submissions')

    const toggle = page.locator(`button[aria-controls="${CARD}-card"]`)

    if (await toggle.isVisible()) {
      await toggle.click()
    }

    const button = page.locator(card).getByRole('button', { name: 'Odobri', exact: true })

    await button.evaluate((one) => {
      Reflect.set(window, 'pressesOfTheCase', 0)
      one.addEventListener(
        'click',
        (event) => {
          Reflect.set(window, 'pressesOfTheCase', Number(Reflect.get(window, 'pressesOfTheCase')) + 1)
          event.stopImmediatePropagation()
        },
        true,
      )
    })

    /* THE KEYBOARD: the focus is in a slider, which is what the arrow keys act on. */
    await page.locator(`${card} .crop__slider input`).first().focus()
    await button.scrollIntoViewIfNeeded()

    const before = await button.boundingBox()

    if (before === null) {
      throw notMeasured('the button of the card has no box')
    }

    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
    await page.mouse.down()

    const during = await button.boundingBox()

    expect(during, 'the button has no box in the middle of the press').not.toBeNull()
    expect(Math.abs((during?.y ?? 0) - before.y), 'the button moved while the mouse button was still down').toBeLessThanOrEqual(0.5)

    await page.mouse.up()
    expect(await page.evaluate(() => Reflect.get(window, 'pressesOfTheCase')), 'the click never reached the button').toBe(1)
  })

  /* THE SAME WITH A FINGER, at the two widths a finger is used at (owner, 24.11.2026, the second decision). The
     browser moves the focus of a tap on the mouse-down it imitates AFTER the finger is lifted, so the strip folded
     between the release and the click: a review measured the button from y 459,9 to 422,5 on the card at 360px and
     none of two taps reached it. */
  if (at.width < 1000) {
    test(`the first tap of a finger after the arrow keys is not lost, ${label(at)}`, async ({ open }) => {
      const card = `[id="${CARD}-card"]`
      const { page } = await open({ ...at, touch: true }, '/sr/administracija/verifikacija/trkacki-profil', '.submissions', THE_QUEUE)

      await servedAPictureAt(page, '**/api/verification/*/photo*', '.submissions')

      const toggle = page.locator(`button[aria-controls="${CARD}-card"]`)

      if (await toggle.isVisible()) {
        await toggle.click()
      }

      const button = page.locator(card).getByRole('button', { name: 'Odobri', exact: true })

      await button.evaluate((one) => {
        Reflect.set(window, 'tapsOfTheCase', 0)
        one.addEventListener(
          'click',
          (event) => {
            Reflect.set(window, 'tapsOfTheCase', Number(Reflect.get(window, 'tapsOfTheCase')) + 1)
            event.stopImmediatePropagation()
          },
          true,
        )
      })

      await page.locator(`${card} .crop__slider input`).first().focus()
      await button.scrollIntoViewIfNeeded()

      const before = await button.boundingBox()

      if (before === null) {
        throw notMeasured('the button of the card has no box')
      }

      await page.touchscreen.tap(before.x + before.width / 2, before.y + before.height / 2)
      /* Past the third of a second the strip is kept for, so what is read is where it settled. */
      await page.waitForTimeout(500)

      expect(await page.evaluate(() => Reflect.get(window, 'tapsOfTheCase')), 'the tap never reached the button').toBe(1)
    })
  }

  test(`the moderator drags the circle of a waiting picture and reaches both buttons past it, ${label(at)}`, async ({ open }) => {
    const card = `[id="${CARD}-card"]`
    const { page } = await open(at, '/sr/administracija/verifikacija/trkacki-profil', '.submissions', THE_QUEUE)

    await servedAPictureAt(page, '**/api/verification/*/photo*', '.submissions')

    const toggle = page.locator(`button[aria-controls="${CARD}-card"]`)

    if (await toggle.isVisible()) {
      await toggle.click()
    }

    await behavesTheSame(page, card, 'the card of a waiting picture')

    /* NO WALL: the picture leaves page to scroll on, and both buttons come into the window and are what stands
       at their own middle. */
    const seen = await seenIn(page, card)

    if (seen === null) {
      throw notMeasured('the card lost its picture')
    }

    expect(seen.innerHeight - seen.picture.height, 'the picture leaves no page to scroll on').toBeGreaterThan(0.3 * seen.innerHeight)

    for (const name of ['Odobri', 'Odbij']) {
      const button = page.locator(card).getByRole('button', { name, exact: true })

      await button.scrollIntoViewIfNeeded()

      const reached = await button.evaluate((one) => {
        const found = one.getBoundingClientRect()
        const there = document.elementFromPoint(found.left + found.width / 2, found.top + found.height / 2)

        return { top: found.top, bottom: found.bottom, onTop: there !== null && one.contains(there) }
      })

      expect(reached.top, `„${name}" stands above the window`).toBeGreaterThanOrEqual(-SLACK)
      expect(reached.bottom, `„${name}" stands below the window`).toBeLessThanOrEqual(seen.innerHeight + SLACK)
      expect(reached.onTop, `something covers „${name}"`).toBe(true)
    }
  })
}
