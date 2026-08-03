import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { FormDef } from './types'

/* What every form definition has to be true of, checked over all of them at
 * once rather than one form at a time.
 *
 * A form is data (PDL P30), so the rules a form obeys cannot live in the
 * component that draws it: the owner edits a JSON file and the component never
 * hears about it. This file is where a rule about the data itself goes.
 */

const HERE = join(process.cwd(), 'src', 'forms', 'definitions')

const FORMS = readdirSync(HERE)
  .filter((name) => name.endsWith('.form.json'))
  .map((name) => ({
    name,
    form: JSON.parse(readFileSync(join(HERE, name), 'utf-8')) as FormDef,
  }))

describe('every form definition in the portal', () => {
  it('is there to be checked at all', () => {
    /* So the file cannot pass by finding nothing: not the forms, and not the
       long boxes the rule below is about, which are five today. Delete them all
       and that rule goes green over an empty list. */
    expect(FORMS.length).toBeGreaterThan(5)
    expect(FORMS.flatMap(({ form }) => form.fields.filter((one) => one.type === 'textarea')).length)
      .toBeGreaterThan(4)
  })

  it('gives every long box a limit', () => {
    /* A box with no limit is a box somebody can paste a novel into, and the
       column underneath it is not that wide. It is also the one field on the
       form that says nothing about how much room is left, because there is
       nothing to count down from: the renderer draws no counter without a limit
       and refuses nothing at the door.

       This reaches the definitions and nothing else. Two boxes are edited
       outside a form: a biography rewritten by a moderator (PendingQueue) and
       the rules of a competition rewritten in place (LeagueDetail). Both took
       whatever was pasted, so a value could come back longer than the form that
       made it accepts and the next person to open that form was told their own
       text was too long. Both now read their limit off the definition through
       `limitOf`, which is what makes this rule cover them: take the limit out of
       the JSON and those two throw. */
    const missing = FORMS.flatMap(({ name, form }) =>
      form.fields
        .filter((field) => field.type === 'textarea' && field.maxLength === undefined)
        .map((field) => `${name}: ${field.name}`),
    )

    expect(missing).toEqual([])
  })

  it('gives every field a name of its own', () => {
    /* Two fields under one name are one field as far as the values are
       concerned: the second overwrites the first, and the form quietly asks for
       something it then throws away. */
    const clashes = FORMS.flatMap(({ name, form }) => {
      const seen = new Set<string>()

      return form.fields
        .filter((field) => {
          const twice = seen.has(field.name)
          seen.add(field.name)

          return twice
        })
        .map((field) => `${name}: ${field.name}`)
    })

    expect(clashes).toEqual([])
  })

  it('never asks for less than it will accept', () => {
    /* A field that wants at least fifty characters and takes at most forty can
       be filled in no way at all.

       Nothing in the portal has both a floor and a ceiling today, so this
       sweeps an empty list and says so rather than pretending to have checked
       something. It is here for the field that gets both, which is the moment
       the two can disagree. */
    const impossible = FORMS.flatMap(({ name, form }) =>
      form.fields
        .filter(
          (field) =>
            field.minLength !== undefined &&
            field.maxLength !== undefined &&
            field.minLength > field.maxLength,
        )
        .map((field) => `${name}: ${field.name}`),
    )

    expect(impossible).toEqual([])
  })
})
