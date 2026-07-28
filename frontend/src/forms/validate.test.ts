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
    const field = text({ pattern: '^[MF]\\d{4}$' })

    expect(validateField(field, 'M0001')).toBeNull()
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

  it('starts empty, with checkboxes unticked', () => {
    expect(emptyValues(form)).toEqual({ ime: '', mejl: '', saglasnost: false })
  })

  it('collects one error per broken field', () => {
    expect(validateForm(form, emptyValues(form))).toEqual({
      ime: { key: 'form.errors.required' },
      saglasnost: { key: 'form.errors.required' },
    })
  })

  it('returns nothing when everything is right', () => {
    expect(
      validateForm(form, { ime: 'Vladan', mejl: 'v@primer.rs', saglasnost: true }),
    ).toEqual({})
  })

  it('treats a missing value as empty', () => {
    expect(validateForm(form, {}).ime).toEqual({ key: 'form.errors.required' })
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
