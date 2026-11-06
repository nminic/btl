import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SLACK, notMeasured } from './harness.ts'

/**
 * WHERE THE FIELDS OF THE MEMBER'S OWN FORM LAND, as boxes: one per field the registration draws, found by
 * the name its control is sent under, measured from the field around the control (its name, its rule, its
 * box), in the order the form draws them.
 */
export type Landed = { name: string; top: number; bottom: number; left: number; right: number }

/** The fields of the member's own form (`profile/memberData.ts`, `hisOwnForm`), in the registration's order. */
export const HIS_FIELDS = [
  'firstName',
  'lastName',
  'fatherName',
  'gender',
  'birthDate',
  'idNumber',
  'address',
  'phone',
  'city',
  'shirtSize',
] as const

/**
 * THE ROWS OF THE REGISTRATION, as the member's own form draws them from 51.25em (PDL 06.11.2026, „Profil:
 * forma „Podaci" po obliku forme za prijavu"; the thirds of 12.08.2026): the two names and the father's
 * beside each other, the gender, the day and the document beside each other under them, the address and
 * the telephone beside each other. The town and the size each stand on a row of their own.
 */
export const HIS_ROWS: readonly (readonly (typeof HIS_FIELDS)[number][])[] = [
  ['firstName', 'lastName', 'fatherName'],
  ['gender', 'birthDate', 'idNumber'],
  ['address', 'phone'],
  ['city'],
  ['shirtSize'],
]

export const fieldsOf = (page: Page, card: string) =>
  page.evaluate(
    ({ selector, names }) => {
      const root = document.querySelector(selector)

      if (root === null) {
        return null
      }

      return names.map((name) => {
        const control = root.querySelector(`[name="${name}"]`)
        const field = control?.closest('.field') ?? null
        const box = field?.getBoundingClientRect()

        return box === undefined
          ? null
          : { name, top: box.top, bottom: box.bottom, left: box.left, right: box.right }
      })
    },
    { selector: card, names: [...HIS_FIELDS] },
  )

function landed(found: (Landed | null)[] | null, who: string): Landed[] {
  if (found === null) {
    throw notMeasured(`${who}: the card was not drawn`)
  }

  const every = found.filter((one): one is Landed => one !== null)

  if (every.length !== HIS_FIELDS.length) {
    throw notMeasured(`${who}: ${HIS_FIELDS.length - every.length} of the fields were not drawn`)
  }

  return every
}

/**
 * <p><b>In thirds where the screen is wide</b>: the fields of a row share a top and stand left to right,
 * each clear of its neighbour, a row of three no wider than the form and each of its fields under half
 * of it (a third, give or take the gaps), and every row below the one before it.
 */
export function expectTheRegistrationsRows(found: (Landed | null)[] | null, who: string): void {
  const every = landed(found, who)
  const at = (name: string): Landed => {
    const one = every.find((field) => field.name === name)

    if (one === undefined) {
      throw notMeasured(`${who}: ${name} was not drawn`)
    }

    return one
  }
  const left = Math.min(...every.map((one) => one.left))
  const right = Math.max(...every.map((one) => one.right))

  HIS_ROWS.forEach((row, index) => {
    const fields = row.map(at)
    const first = fields[0]

    if (first === undefined) {
      throw notMeasured(`${who}: an empty row`)
    }

    for (const [next, one] of fields.slice(1).entries()) {
      const before = fields[next]

      if (before === undefined) {
        throw notMeasured(`${who}: a row lost a field`)
      }

      expect(Math.abs(one.top - first.top), `${who}: ${one.name} stands on the row of ${first.name}`).toBeLessThanOrEqual(SLACK)
      expect(one.left, `${who}: ${one.name} stands right of ${before.name}, clear of it`).toBeGreaterThanOrEqual(before.right - SLACK)
    }

    if (row.length === 3) {
      for (const one of fields) {
        expect(one.right - one.left, `${who}: ${one.name} is a third of the form, not half of it`).toBeLessThan((right - left) / 2)
      }
    }

    const above = HIS_ROWS[index - 1]

    if (above !== undefined) {
      const lowest = Math.max(...above.map((name) => at(name).bottom))

      expect(first.top, `${who}: the row of ${first.name} stands below the row before it`).toBeGreaterThanOrEqual(lowest - SLACK)
    }
  })
}

/** <p><b>In one column where it is not</b>: every field below the one before it, and none beside another. */
export function expectOneColumn(found: (Landed | null)[] | null, who: string): void {
  const every = landed(found, who)

  for (const [next, one] of every.slice(1).entries()) {
    const before = every[next]

    if (before === undefined) {
      throw notMeasured(`${who}: a field was lost`)
    }

    expect(one.top, `${who}: ${one.name} stands below ${before.name}`).toBeGreaterThanOrEqual(before.bottom - SLACK)
  }
}
