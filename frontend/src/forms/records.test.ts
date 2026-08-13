import { must } from '../test/at'
import { fieldDate, isoDate } from './dateField'
import { registracija } from './definitions'
import {
  applyChanges,
  limitOf,
  optionsFor,
  recordValue,
  shownValue,
  textFrom,
  valuesFor,
} from './records'
import type { FieldDef, FormDef } from './types'

const form: FormDef = {
  id: 'proba',
  titleKey: 'proba.naslov',
  submitKey: 'form.submit',
  fields: [
    { name: 'name', type: 'text', labelKey: 'proba.naziv' },
    { name: 'count', type: 'number', labelKey: 'proba.broj' },
    { name: 'day', type: 'date', labelKey: 'proba.datum' },
    { name: 'on', type: 'checkbox', labelKey: 'proba.kucica' },
    { name: 'land', type: 'country', labelKey: 'proba.drzava' },
    {
      name: 'pick',
      type: 'select',
      labelKey: 'proba.izbor',
      options: [{ value: 'a', labelKey: 'proba.a' }],
    },
    /* A choice whose list is data rather than a fixed set, so the definition
     * carries no options and the screen hands them in. */
    { name: 'open', type: 'select', labelKey: 'proba.otvoren' },
    /* Two buttons for a question the record keeps as a yes or a no
     * (data/types.ts, `firstSeason2027`). */
    {
      name: 'beginner',
      type: 'choice',
      labelKey: 'proba.kategorija',
      options: [
        { value: 'yes', labelKey: 'proba.prva' },
        { value: 'no', labelKey: 'proba.starosna' },
      ],
    },
    /* And one that answers with a word of its own, which must stay a word. */
    {
      name: 'sex',
      type: 'choice',
      labelKey: 'proba.pol',
      options: [
        { value: 'M', labelKey: 'proba.m' },
        { value: 'F', labelKey: 'proba.z' },
      ],
    },
  ],
}

const field = (name: string): FieldDef =>
  must(
    form.fields.find((one) => one.name === name),
    `a field called "${name}"`,
  )

describe('a date between the two shapes it has', () => {
  it('is shown the way the region reads it', () => {
    expect(fieldDate('2027-04-03')).toBe('03/04/2027')
    expect(isoDate('03/04/2027')).toBe('2027-04-03')
  })

  it('is empty rather than wrong when it is not a date', () => {
    // A half typed value must never be written down as though it were a date.
    expect(fieldDate('')).toBe('')
    expect(fieldDate('3. april 2027.')).toBe('')
    expect(isoDate('03/04')).toBe('')
    expect(isoDate('31/02/2027')).toBe('')
  })
})

describe('the values a form opens with', () => {
  it('are read off the record, in the shape each field holds', () => {
    const values = valuesFor(form, {
      name: 'Jadovnik',
      count: 42,
      day: '2027-07-04',
      on: true,
      land: 'RS',
      pick: 'a',
      open: 'evt-1',
      beginner: false,
      sex: 'M',
    })

    expect(values).toEqual({
      name: 'Jadovnik',
      count: '42',
      day: '04/07/2027',
      on: true,
      land: 'RS',
      pick: 'a',
      open: 'evt-1',
      /* A record's no read back as the word the buttons answer with, so the
         right one of the two opens taken. */
      beginner: 'no',
      sex: 'M',
    })
  })

  it('reads a yes back as the word the buttons answer with', () => {
    /* The other half of the pair above, so both ways round are walked: a record
       that says yes opens with the „Početnička" button taken. */
    expect(valuesFor(form, { beginner: true }).beginner).toBe('yes')
  })

  it('leaves a field the record has nothing for empty', () => {
    // A record with a hole in it is what a half written page looks like, and the
    // form has to open on it rather than showing the word "null".
    expect(valuesFor(form, { name: null, count: undefined })).toEqual({
      name: '',
      count: '',
      day: '',
      on: false,
      land: '',
      pick: '',
      open: '',
      beginner: '',
      sex: '',
    })
  })
})

describe('what the session remembers', () => {
  it('is the record shape written as text', () => {
    expect(
      textFrom(form, {
        name: 'Jadovnik',
        count: '42',
        day: '04/07/2027',
        on: false,
        land: 'RS',
        pick: 'a',
        open: 'evt-1',
        beginner: 'yes',
        sex: 'F',
      }),
    ).toEqual({
      name: 'Jadovnik',
      count: '42',
      day: '2027-07-04',
      on: 'false',
      land: 'RS',
      pick: 'a',
      open: 'evt-1',
      beginner: 'yes',
      sex: 'F',
    })
  })
})

describe('the overlay over a record', () => {
  it('leaves the record alone when nothing was changed', () => {
    const record = { name: 'Jadovnik', count: 42 }

    expect(applyChanges(record, undefined)).toBe(record)
  })

  it('puts every value back in the shape the record keeps it in', () => {
    // A screen that formats a number has to keep being handed a number, or the
    // change turns "42" into a string in the middle of a table of figures.
    expect(
      applyChanges(
        { name: 'Jadovnik', count: 42, on: true, off: false },
        { name: 'Jadovnik ultra', count: '46', on: 'false', off: 'true' },
      ),
    ).toEqual({ name: 'Jadovnik ultra', count: 46, on: false, off: true })
  })
})

describe('a value out of a form for a record that is being created', () => {
  it('takes its shape from the field type, there being nothing underneath', () => {
    expect(recordValue(field('count'), '42')).toBe(42)
    expect(recordValue(field('on'), 'true')).toBe(true)
    expect(recordValue(field('on'), 'false')).toBe(false)
    expect(recordValue(field('name'), 'Jadovnik')).toBe('Jadovnik')
  })

  it('turns the two words of a yes or no question into a yes or a no', () => {
    /* A pair of buttons writes „yes" or „no", and the record holding the answer
       holds a boolean (data/types.ts, `firstSeason2027`). Left as words, „no"
       was not „true" and so was false by accident, and „yes" was false as well:
       a beginner in the wrong category for a whole season, which PDL P7 says
       cannot be undone mid-season. */
    expect(recordValue(field('beginner'), 'yes')).toBe(true)
    expect(recordValue(field('beginner'), 'no')).toBe(false)
    /* And a choice whose answers are words of their own stays words. */
    expect(recordValue(field('sex'), 'M')).toBe('M')
    /* Decided by what the field offers, so a definition that offers nothing is
       not a yes or no question either: „yes" typed into it is the word „yes". */
    expect(recordValue({ name: 'prazan', type: 'choice', labelKey: 'proba.prazan' }, 'yes'))
      .toBe('yes')
  })

  it('reads the same two words back onto a record that already holds one', () => {
    expect(applyChanges({ beginner: false }, { beginner: 'yes' })).toEqual({ beginner: true })
    expect(applyChanges({ beginner: true }, { beginner: 'no' })).toEqual({ beginner: false })
  })
})

describe('the choices a select offers', () => {
  it('come from the definition, or from the screen, or nowhere', () => {
    expect(optionsFor(field('pick'), {})).toHaveLength(1)
    expect(optionsFor(field('open'), { open: [{ value: 'evt-1', labelKey: 'Jadovnik' }] })).toHaveLength(
      1,
    )
    expect(optionsFor(field('open'), {})).toEqual([])
  })
})

describe('the words the confirmation shows', () => {
  it('name a country rather than showing its code', () => {
    expect(shownValue(field('land'), 'RS', {})).toBe('Srbija')
  })

  it('fall back to the code for a country that is not on the list', () => {
    expect(shownValue(field('land'), 'ZZ', {})).toBe('ZZ')
  })

  it('say yes and no for a box rather than true and false', () => {
    expect(shownValue(field('on'), true, {})).toBe('admin.yes')
    expect(shownValue(field('on'), false, {})).toBe('admin.no')
  })

  it('name a choice through its option, wherever the option came from', () => {
    expect(shownValue(field('pick'), 'a', {})).toBe('proba.a')
    expect(
      shownValue(field('open'), 'evt-1', { open: [{ value: 'evt-1', labelKey: 'Jadovnik' }] }),
    ).toBe('Jadovnik')
  })

  it('shows plain text as it was typed', () => {
    expect(shownValue(field('name'), 'Jadovnik', {})).toBe('Jadovnik')
  })
})

describe('the limit a field carries in its definition', () => {
  /* Read rather than written out beside each of the two boxes that are edited
     outside a form, so the limit is one number in one file. */
  it('is the number in the definition', () => {
    expect(limitOf(registracija, 'bio')).toBe(360)
  })

  it('refuses a name that is not a field with a limit, rather than taking the cap off', () => {
    /* Returning undefined would leave the box with no `maxLength` at all, which
       is the thing the caller asked for the number to prevent. */
    expect(() => limitOf(registracija, 'nema-ovoga')).toThrow(/no field/)
    expect(() => limitOf(registracija, 'pol')).toThrow(/length limit/)
  })
})

describe('the country a form opens holding', () => {
  const withPlace: FormDef = {
    id: 'proba',
    titleKey: 'proba.naslov',
    submitKey: 'form.submit',
    fields: [{ name: 'city', type: 'place', labelKey: 'proba.mesto' }],
  }

  it('is the one on the record, so an untouched town does not blank it', () => {
    expect(valuesFor(withPlace, { city: 'Beograd', country: 'RS' })).toEqual({
      city: 'Beograd',
      country: 'RS',
    })
  })

  it('is empty where the record carries none, and not the word for nothing', () => {
    /* A record written before the field existed, or one the backend answers
       without a country. `String(undefined)` is "undefined", which is what the
       first version of this saved (entityForms.ts). */
    expect(valuesFor(withPlace, { city: 'Beograd' })).toEqual({ city: 'Beograd', country: '' })
  })
})
