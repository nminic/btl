import type { FieldDef, FormDef } from './types'
import { emptyValues, isVisible, trimValues, validateField, validateForm } from './validate'

const text = (extra: Partial<FieldDef> = {}): FieldDef => ({
  name: 'ime',
  type: 'text',
  labelKey: 'x',
  ...extra,
})

describe('validateField', () => {
  it('accepts an empty optional field', () => {
    expect(validateField(text(), '')).toBeNull()
    expect(validateField(text(), '   ')).toBeNull()
  })

  it('rejects an empty required field', () => {
    expect(validateField(text({ required: true }), '')).toEqual({ key: 'form.errors.required' })
  })

  it('checks the length', () => {
    expect(validateField(text({ minLength: 3 }), 'ab')).toEqual({
      key: 'form.errors.minLength',
      params: { min: 3 },
    })
    expect(validateField(text({ maxLength: 3 }), 'abcd')).toEqual({
      key: 'form.errors.maxLength',
      params: { max: 3 },
    })
    expect(validateField(text({ minLength: 2, maxLength: 4 }), 'abc')).toBeNull()
  })

  it('checks a pattern', () => {
    const field = text({ pattern: '^\\d{6}$' })

    expect(validateField(field, '000001')).toBeNull()
    expect(validateField(field, 'X1')).toEqual({ key: 'form.errors.pattern' })
  })

  it('checks an address of electronic mail', () => {
    const field = text({ type: 'email' })

    expect(validateField(field, 'trkac@primer.rs')).toBeNull()
    expect(validateField(field, 'trkac@')).toEqual({ key: 'form.errors.email' })
  })

  it('checks numeric bounds only for number fields', () => {
    const field = text({ type: 'number', min: 1, max: 300 })

    expect(validateField(field, '42')).toBeNull()
    expect(validateField(field, '0')).toEqual({ key: 'form.errors.min', params: { min: 1 } })
    expect(validateField(field, '900')).toEqual({ key: 'form.errors.max', params: { max: 300 } })
    expect(validateField(text({ min: 1 }), '0')).toBeNull()
  })

  it('rejects a number field that is not a number', () => {
    // Number('abc') is NaN and every comparison against NaN is false, so
    // without an explicit check the bounds silently pass anything.
    expect(validateField(text({ type: 'number', min: 1, max: 300 }), 'abc')).toEqual({
      key: 'form.errors.number',
    })
  })

  it('survives a pattern that does not compile', () => {
    // The owner edits these JSON files by hand, so a broken pattern is a
    // question of when. It must reject the value, never throw out of submit.
    const field = text({ pattern: '([a-z' })

    expect(() => validateField(field, 'bilo sta')).not.toThrow()
    expect(validateField(field, 'bilo sta')).toEqual({ key: 'form.errors.pattern' })
  })

  it('handles a checkbox as agreed or not agreed', () => {
    const field = text({ type: 'checkbox', required: true })

    expect(validateField(field, true)).toBeNull()
    expect(validateField(field, false)).toEqual({ key: 'form.errors.required' })
    expect(validateField(text({ type: 'checkbox' }), false)).toBeNull()
  })
})

describe('trimValues', () => {
  it('trims text and leaves everything else alone', () => {
    expect(trimValues({ ime: '  Vladan  ', saglasnost: true })).toEqual({
      ime: 'Vladan',
      saglasnost: true,
    })
  })
})

describe('validateForm', () => {
  const form: FormDef = {
    id: 'proba',
    titleKey: 't',
    submitKey: 's',
    fields: [
      text({ name: 'ime', required: true }),
      text({ name: 'mejl', type: 'email' }),
      text({ name: 'saglasnost', type: 'checkbox', required: true }),
    ],
  }

  /* The day is handed in rather than read: the portal has one clock and this
     rule must decide on the same day the field appeared on (src/clock). No
     field here depends on it, so it only has to be a day. */
  const today = new Date(Date.UTC(2026, 6, 28))

  it('starts empty, with checkboxes unticked', () => {
    expect(emptyValues(form)).toEqual({ ime: '', mejl: '', saglasnost: false })
  })

  it('collects one error per broken field', () => {
    expect(validateForm(form, emptyValues(form), today)).toEqual({
      ime: { key: 'form.errors.required' },
      saglasnost: { key: 'form.errors.required' },
    })
  })

  it('returns nothing when everything is right', () => {
    expect(
      validateForm(form, { ime: 'Vladan', mejl: 'v@primer.rs', saglasnost: true }, today),
    ).toEqual({})
  })

  it('treats a missing value as empty', () => {
    expect(validateForm(form, {}, today).ime).toEqual({ key: 'form.errors.required' })
  })
})

describe('conditional fields', () => {
  const parent: FieldDef = {
    name: 'parentConsent',
    type: 'text',
    labelKey: 'x',
    required: true,
    showWhenYoungerThan: { field: 'birthDate', years: 16 },
  }
  const today = new Date(Date.UTC(2026, 6, 28))

  it('is always visible without the rule', () => {
    expect(isVisible(text(), {}, today)).toBe(true)
  })

  it('appears only once the date says the competitor is under sixteen', () => {
    expect(isVisible(parent, {}, today)).toBe(false)
    expect(isVisible(parent, { birthDate: 'nije datum' }, today)).toBe(false)
    expect(isVisible(parent, { birthDate: '01/01/1990' }, today)).toBe(false)
    expect(isVisible(parent, { birthDate: '01/01/2015' }, today)).toBe(true)
  })

  it('is not demanded while it is hidden', () => {
    const form: FormDef = { id: 'p', titleKey: 't', submitKey: 's', fields: [parent] }

    // An adult must not be blocked by a signature they cannot even see.
    expect(validateForm(form, { birthDate: '01/01/1990' }, today)).toEqual({})
    expect(validateForm(form, { birthDate: '01/01/2015' }, today)).toEqual({
      parentConsent: { key: 'form.errors.required' },
    })
  })
})

describe('a picture that lets one field go and demands another', () => {
  /* Član 37, owner 22.08.2026: „Ukoliko podignete sliku, link ka zvaničnim
     rezultatima postaje neobavezan, ali polje Komentar postaje obavezno."

     Two fields and one answer between them, so both directions are measured
     here: the link with a picture and without, and the comment with a picture
     and without. Held on `validateForm` rather than on the flag, because what
     the member meets is whether the form goes through. */
  const link: FieldDef = {
    name: 'link',
    type: 'text',
    labelKey: 'x',
    required: true,
    optionalWhenFilled: { field: 'photo' },
  }
  const comment: FieldDef = {
    name: 'comment',
    type: 'textarea',
    labelKey: 'x',
    requiredWhenFilled: { field: 'photo' },
  }
  const photo: FieldDef = { name: 'photo', type: 'photo', labelKey: 'x' }
  const form: FormDef = { id: 'r', titleKey: 't', submitKey: 's', fields: [link, comment, photo] }
  const today = new Date(Date.UTC(2026, 7, 22))

  it('demands the link and leaves the comment alone while there is no picture', () => {
    expect(validateForm(form, { link: '', comment: '', photo: '' }, today)).toEqual({
      link: { key: 'form.errors.required' },
    })
  })

  it('lets the link go and demands the comment once the picture is there', () => {
    expect(validateForm(form, { link: '', comment: '', photo: 'sat.jpg' }, today)).toEqual({
      comment: { key: 'form.errors.required' },
    })
    expect(
      validateForm(form, { link: '', comment: 'Sat pokazuje 3:41', photo: 'sat.jpg' }, today),
    ).toEqual({})
  })

  it('reads a picture of blanks as no picture', () => {
    /* A file whose name is spaces is not a file. Trimmed rather than compared to
       the empty string, so a value that looks answered and is not cannot let the
       link go. */
    expect(validateForm(form, { link: '', comment: '', photo: '   ' }, today)).toEqual({
      link: { key: 'form.errors.required' },
    })

    /* And no key at all reads the same way. A form hands in a value for every
       field it defines, so this is the shape a caller writes by hand rather
       than one the screen produces; read as an answer it would let the link go
       for a picture nobody chose. */
    expect(validateForm(form, { link: '', comment: '' }, today)).toEqual({
      link: { key: 'form.errors.required' },
    })
  })

  it('leaves a field with neither rule as it is written', () => {
    expect(validateForm(form, { link: 'https://x.rs', comment: '', photo: '' }, today)).toEqual({})
  })
})

describe('a field asked of everybody and demanded of some', () => {
  const document_: FieldDef = {
    name: 'idNumber',
    type: 'text',
    labelKey: 'x',
    required: true,
    optionalWhenYoungerThan: { field: 'birthDate', years: 16 },
  }
  const form: FormDef = { id: 'p', titleKey: 't', submitKey: 's', fields: [document_] }
  const today = new Date(Date.UTC(2026, 6, 28))

  it('is still on the screen for the reader it is not demanded of', () => {
    /* Asked and not demanded, which is a different thing from hidden: a fifteen
       year old who does have a passport should be able to give it. */
    expect(isVisible(document_, { birthDate: '01/01/2015' }, today)).toBe(true)
  })

  it('is demanded of an adult and left to a child', () => {
    /* An identity card is issued at sixteen, so a child usually has neither card
       nor passport. Demanded of them, the only way to send the form is for a
       parent to type their own number, and the association ends up holding the
       document number of somebody who is not a member. Owner, 20.08.2026. */
    expect(validateForm(form, { birthDate: '01/01/1990', idNumber: '' }, today)).toEqual({
      idNumber: { key: 'form.errors.required' },
    })
    expect(validateForm(form, { birthDate: '01/01/2015', idNumber: '' }, today)).toEqual({})
  })

  it('is demanded while the date says nothing, which is not the same as saying young', () => {
    /* Three ways of saying nothing: no date, an empty one, and one that will not
       parse. A form hands in a value for every field it defines, so the first is
       the shape a caller writes by hand rather than one the screen produces. */
    expect(validateForm(form, {}, today)).toEqual({
      idNumber: { key: 'form.errors.required' },
    })
    expect(validateForm(form, { birthDate: '', idNumber: '' }, today)).toEqual({
      idNumber: { key: 'form.errors.required' },
    })
    expect(validateForm(form, { birthDate: 'nije datum', idNumber: '' }, today)).toEqual({
      idNumber: { key: 'form.errors.required' },
    })
  })

  it('still checks what is written in it when a child does write one', () => {
    const short: FormDef = {
      id: 'p',
      titleKey: 't',
      submitKey: 's',
      fields: [{ ...document_, maxLength: 5 }],
    }

    expect(validateForm(short, { birthDate: '01/01/2015', idNumber: 'predugacko' }, today)).toEqual({
      idNumber: { key: 'form.errors.maxLength', params: { max: 5 } },
    })
  })
})

describe('matching fields', () => {
  const form: FormDef = {
    id: 'p',
    titleKey: 't',
    submitKey: 's',
    fields: [
      { name: 'password', type: 'password', labelKey: 'x', required: true },
      { name: 'repeat', type: 'password', labelKey: 'x', required: true, matches: 'password' },
    ],
  }
  const today = new Date(Date.UTC(2026, 6, 28))

  it('accepts two that are the same', () => {
    expect(validateForm(form, { password: 'trkacka2027', repeat: 'trkacka2027' }, today)).toEqual({})
  })

  it('rejects two that differ', () => {
    expect(validateForm(form, { password: 'trkacka2027', repeat: 'nesto' }, today).repeat).toEqual({
      key: 'form.errors.matches',
    })
  })
})

describe('date fields', () => {
  it('demands the dd/mm/gggg shape', () => {
    expect(validateField(text({ type: 'date' }), '1985-04-12')).toEqual({ key: 'form.errors.date' })
    expect(validateField(text({ type: 'date' }), '12/04/1985')).toBeNull()
  })
})

describe('what a form starts out holding', () => {
  it('holds a country beside a place, which is a value with no field of its own', () => {
    /* A place writes the town and the country it came with (forms/types.ts).
       Missing from the values a form is seeded with, the country is a key the
       form never had, so an event saved without its town being touched carries
       whatever the record layer makes of a value that was never there. */
    const withPlace: FormDef = {
      id: 'proba',
      titleKey: 'proba.naslov',
      submitKey: 'form.submit',
      fields: [{ name: 'city', type: 'place', labelKey: 'proba.mesto' }],
    }

    expect(emptyValues(withPlace)).toEqual({ city: '', country: '' })
  })

  it('holds no country where there is no place to write one', () => {
    const plain: FormDef = {
      id: 'proba',
      titleKey: 'proba.naslov',
      submitKey: 'form.submit',
      fields: [{ name: 'ime', type: 'text', labelKey: 'proba.ime' }],
    }

    expect(emptyValues(plain)).toEqual({ ime: '' })
  })
})
