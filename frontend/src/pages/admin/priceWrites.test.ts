import { describe, expect, it } from 'vitest'
import { amountsFrom } from './priceWrites'
import cena from '../../forms/definitions/admin-cena.form.json'

/**
 * WHAT THE PRICE FORM SENDS, read off the form rather than off a shape written here.
 *
 * <p><b>The one thing worth measuring in this module is what it does with a field that is
 * NOT a number</b>, because the honest answer and the cheap one differ by a silent price
 * change: `Number('')` is `0`, and nought is a price this route accepts -
 * `price_row_eur_not_negative` reads `eur >= 0`, and a membership the league gives away is a
 * real state of the product (Pravilnik član 15). So a form that lost its euro field would
 * have set the fee to nothing at all, and nobody would have been told.
 */
describe('the two amounts the form sends', () => {
  it('is the two numbers that were typed, and nothing else off the form', () => {
    /* The name is on the form and has nowhere to go: `price_row` has no column for one until
       `b102-ime-reda-cenovnika` lands (owner, 25.09.2026, PDL P12b). Sent all the same it
       would be a field the route ignores while a reader believes he renamed something. */
    expect(amountsFrom({ label: 'Rani upis', eur: '35', rsd: '4200' })).toEqual({
      eur: 35,
      rsd: 4200,
    })
  })

  it('keeps the para rather than rounding them away', () => {
    /* `numeric(10,2)`, and the route refuses a third decimal rather than letting PostgreSQL
       round it (`PricingWriteApi`, `theAmountIsNotKeptExactly`). Nothing here may round
       either: a price the portal quietly changed on the way out is the fault that refusal
       exists for. */
    expect(amountsFrom({ eur: '35.50', rsd: '4260.75' })).toEqual({ eur: 35.5, rsd: 4260.75 })
  })

  it('sends nothing rather than nought where a field was left empty', () => {
    /* THE MEASUREMENT THIS FILE EXISTS FOR, in both directions: the answer is null and it is
       explicitly not 0, because 0 is a price and null is „the form is not finished". A
       whitespace-only field is the same thing; `forms/validate.ts` already trims a required
       field, and a value that reaches here untrimmed must not become a price either. */
    expect(amountsFrom({ eur: '', rsd: '4200' })).toEqual({ eur: null, rsd: 4200 })
    expect(amountsFrom({ eur: '35', rsd: '   ' })).toEqual({ eur: 35, rsd: null })
    expect(amountsFrom({}).eur).toBeNull()
    expect(amountsFrom({}).eur).not.toBe(0)
  })

  it('sends nothing where the value is not a number at all', () => {
    /* A checkbox, and a word. `FormValues` holds every value as a string or a flag, so a
       boolean really can arrive here; `Number(true)` is 1, which would be one euro. */
    expect(amountsFrom({ eur: true, rsd: '4200' }).eur).toBeNull()
    expect(amountsFrom({ eur: 'trideset', rsd: '4200' }).eur).toBeNull()
  })

  it('sends nothing for a value that is a number but not a finite one', () => {
    /* `Number('Infinity')` is a number and `Number.isNaN` says nothing about it, which is why
       the question is `isFinite`: an infinite price is not an amount a column can keep, and it
       would reach the route as one. */
    expect(amountsFrom({ eur: 'Infinity', rsd: '4200' }).eur).toBeNull()
    expect(amountsFrom({ eur: '-Infinity', rsd: '4200' }).eur).toBeNull()
  })
})

describe('the form this module reads', () => {
  it('asks for exactly the two amounts the route takes, plus the name that is owed', () => {
    /* THE FLOOR UNDER THE FUNCTION ABOVE, and it is a query over the form rather than a list
       written here. `amountsFrom` names two fields; a form that renamed one of them would
       leave the route answered `theFormIsNotComplete` for every save, with every case in this
       file still green because they all pass their own names in.
     *
       `label` is expected and is the third: it is what PDL P12b turns into a column, and the
       day it has somewhere to go this case is where the change is noticed. */
    expect(cena.fields.map((one) => one.name)).toEqual(['label', 'eur', 'rsd'])
  })

  it('carries the ceiling the route enforces, which is PDL P12c said twice on purpose', () => {
    /* Owner, 25.09.2026: 1.000 EUR and 200.000 RSD, refused by the ROUTE, and „ako jednog dana
       zatreba veci iznos, menja se na dva mesta, i u ruti i u formi" - a cost he was shown and
       took. The backend holds the same pair against its own constants by reading this very
       file (`WhatAPriceMayCostTest`), so this case is the near side of that: moved here, the
       form and the route part company and one of the two guards says nothing. */
    const max = Object.fromEntries(cena.fields.map((one) => [one.name, one.max]))

    expect(max.eur).toBe(1000)
    expect(max.rsd).toBe(200000)
  })
})
