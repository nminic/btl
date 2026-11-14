import { EVENT_KINDS, kindHasRaces } from '../../data/types'
import { dogadjaj } from '../../forms/definitions'
import type { FieldDef, FormDef } from '../../forms/types'
import { must } from '../../test/at'
import { formWithTheKindHeld, kindIsHeld } from './eventKindHeld'

/**
 * THE KIND OF AN EVENT THAT HAS A RESULT IS HELD BETWEEN A SCORED AND AN UNSCORED RACE (owner, 14.11.2026, PDL
 * „Ostale discipline kao lična evidencija", second round of questions on the plan, decision 6).
 *
 * <p>The screen's own cases are `unscoredEvents.test.tsx`; these are the two functions that decide it, asked of the
 * words alone.
 */

const kindOf = (form: FormDef): FieldDef =>
  must(
    form.fields.find((one) => one.name === 'kind'),
    'a kind field on the form',
  )

const offered = (form: FormDef): string[] => (kindOf(form).options ?? []).map((one) => one.value)

describe('which kinds of event have races under them', () => {
  it('is a scored race and an unscored one, and no other kind that exists', () => {
    expect(EVENT_KINDS.filter((one) => kindHasRaces(one))).toEqual(['race', 'unscored'])
    /* A word the portal does not know has none either: a false answer, not a thrown one. */
    expect(kindHasRaces('')).toBe(false)
    expect(kindHasRaces('triathlon')).toBe(false)
  })
})

describe('whether the kind of an event is held', () => {
  it('is, for a scored or an unscored race with at least one result', () => {
    expect(kindIsHeld('race', 1)).toBe(true)
    expect(kindIsHeld('unscored', 40)).toBe(true)
  })

  it('is not, with no result, or for a kind that cannot be swapped, or for one nobody found', () => {
    expect(kindIsHeld('race', 0)).toBe(false)
    expect(kindIsHeld('unscored', 0)).toBe(false)
    expect(kindIsHeld('training', 3)).toBe(false)
    expect(kindIsHeld('gathering', 3)).toBe(false)
    expect(kindIsHeld('', 3)).toBe(false)
  })
})

describe('the form of an event whose kind is held', () => {
  it('takes the unscored race out of the list of a scored one that has a result', () => {
    expect(offered(formWithTheKindHeld(dogadjaj, 'race', 1))).toEqual(['race', 'training', 'gathering'])
  })

  it('takes the scored race out of the list of an unscored one that has a result', () => {
    expect(offered(formWithTheKindHeld(dogadjaj, 'unscored', 3))).toEqual([
      'unscored',
      'training',
      'gathering',
    ])
  })

  it('carries no rule on the field, which the owner keeps to a closed list of', () => {
    /* `forms/fieldHint.test.tsx` refuses a new one (31.08.2026), so the reason is a sentence of the screen. */
    expect(kindOf(formWithTheKindHeld(dogadjaj, 'race', 1)).hintKey).toBeUndefined()
  })

  it('leaves every other field of the form as it was', () => {
    const held = formWithTheKindHeld(dogadjaj, 'race', 1)

    expect(held.fields.filter((one) => one.name !== 'kind')).toEqual(
      dogadjaj.fields.filter((one) => one.name !== 'kind'),
    )
    expect(held.id).toBe(dogadjaj.id)
  })

  it('holds nothing where the event has no result, and hands back the same form', () => {
    expect(formWithTheKindHeld(dogadjaj, 'race', 0)).toBe(dogadjaj)
    expect(formWithTheKindHeld(dogadjaj, 'unscored', 0)).toBe(dogadjaj)
  })

  it('holds nothing of a kind that cannot be swapped, whatever stands under it', () => {
    /* A training and a gathering keep every kind on offer, and so does an event not found yet (a new one has no
       stored kind). The kind THEY are changed to is what asks the question over the races, and that is elsewhere. */
    expect(formWithTheKindHeld(dogadjaj, 'training', 4)).toBe(dogadjaj)
    expect(formWithTheKindHeld(dogadjaj, 'gathering', 4)).toBe(dogadjaj)
    expect(formWithTheKindHeld(dogadjaj, '', 4)).toBe(dogadjaj)
  })

  it('goes through a form with no field of the kind, as a copy is, and a field with no list', () => {
    const without: FormDef = { ...dogadjaj, fields: dogadjaj.fields.filter((one) => one.name !== 'kind') }

    expect(formWithTheKindHeld(without, 'race', 2).fields).toEqual(without.fields)

    const bare: FormDef = {
      ...dogadjaj,
      fields: dogadjaj.fields.map((one) => (one.name === 'kind' ? { ...one, options: undefined } : one)),
    }

    expect(kindOf(formWithTheKindHeld(bare, 'race', 2)).options).toBeUndefined()
  })
})
