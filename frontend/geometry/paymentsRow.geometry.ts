import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE ROW OF UPLATE AS THE OWNER CLEANED IT, AND THE PAGE ITS PENCIL OPENS, ASKED OF CHROME (owner,
 * 10.11.2026, PDL „Ekran Uplate: izmena podataka pre knjiženja i čišćenje reda": „Dodaj ikonicu olovkice
 * kao na redu članova, na poziciji pre štikle na kraju").
 *
 * <p>Asked at 360, 768 and 1280, because a sideways scroll is seen nowhere else (`CLAUDE.md`): the page
 * does not scroll sideways, the pencil stands to the left of the tick on one line on every width, and
 * both can be reached. The page of the data of somebody with no member number is asked the same.
 *
 * <p>And „Obriši" (owner, 23.11.2026: „Dodaj mi dugme za brisanje prijavljenih članova u listi uplata"), on
 * the row the server offers it on: after the tick, on the same line, held apart from it by at least the
 * 16px the row of the members keeps between „Storniraj" and its own „Obriši" (`Activation.css`), reachable,
 * and the page still does not scroll sideways.
 */

const ADDRESS = '/sr/administracija/verifikacija/uplate'

const ANSWERS: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/payments': {
    season: 2027,
    accounts: [
      { competitorId: 41, memberNumber: '', firstName: 'Ana', lastName: 'Ilić', city: 'Novi Sad',
        currency: 'RSD', expected: 4800, price: 4800, balance: 0, mayBeDeleted: true },
      { competitorId: 58, memberNumber: '', firstName: 'Petar', lastName: 'Marko', city: 'Ljubljana',
        currency: 'EUR', expected: 43, price: 40, balance: 12.75, mayBeDeleted: false },
      { competitorId: 23, memberNumber: '000031', firstName: 'Jovana', lastName: 'Ilić', city: 'Beograd',
        currency: 'RSD', expected: 4800, price: 4800, balance: 6000, mayBeDeleted: false },
    ],
  },
  '/api/members/unnumbered/58/data': {
    memberNumber: null, firstName: 'Petar', lastName: 'Marko', fatherName: 'Jovan', gender: 'M',
    birthDate: '1990-05-15', idNumber: 'AB123', email: 'petar@primer.rs', emailConfirmed: false,
    address: 'Ulica 1', phone: '060111222', placeId: null, city: 'Ljubljana', country: 'SI',
    shirtSize: 'M', bio: null, photo: null, crop: null, viberCommunity: false,
  },
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

for (const at of WIDTHS) {
  test(`the pencil stands before the tick and the page does not scroll sideways at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, ADDRESS, 'table.activate', ANSWERS)

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)

    for (const name of ['Ana Ilić', 'Petar Marko', 'Jovana Ilić']) {
      const pencil = page.getByRole('link', { name: `Izmeni podatke: ${name}` })
      const row = page.getByRole('row').filter({ has: pencil })
      const tick = row.getByRole('button', { name: 'Aktiviraj' })

      await pencil.scrollIntoViewIfNeeded()
      await expect(pencil).toBeInViewport()
      await expect(tick).toBeInViewport()

      const [a, b] = await Promise.all([pencil.boundingBox(), tick.boundingBox()])

      if (a === null || b === null) {
        throw new Error(`no box for the pencil or the tick of ${name}`)
      }

      /* To the left, on the same line, and not over it. */
      expect(a.x + a.width).toBeLessThanOrEqual(b.x + 0.5)
      expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThanOrEqual(1)
    }
  })

  test(`„Obriši" stands after the tick, held apart from it, and the page does not scroll sideways at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, ADDRESS, 'table.activate', ANSWERS)

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)

    const cross = page.getByRole('button', { name: 'Obriši: Ana Ilić' })
    const row = page.getByRole('row').filter({ has: cross })
    const tick = row.getByRole('button', { name: 'Aktiviraj' })

    await cross.scrollIntoViewIfNeeded()
    await expect(cross).toBeInViewport()
    await expect(tick).toBeInViewport()

    const [a, b] = await Promise.all([tick.boundingBox(), cross.boundingBox()])

    if (a === null || b === null) {
      throw new Error('no box for the tick or the cross of Ana Ilić')
    }

    /* To the right of the tick, on the same line, and at least a finger's slop away from it. */
    expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(16)
    expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThanOrEqual(1)

    /* Offered on one row only: the two the server does not offer it on carry none. */
    await expect(page.getByRole('button', { name: /^Obriši/ })).toHaveCount(1)
  })

  test(`the page of the data of somebody with no number does not scroll sideways at ${label(at)}`, async ({ open }) => {
    const { probe, page } = await open(at, '/sr/administracija/podaci-clana/58', 'form', ANSWERS)

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Podaci' })).toBeVisible()
  })
}
