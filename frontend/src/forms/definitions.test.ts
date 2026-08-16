import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { FORMS as EXPORTED, formDef } from './definitions'
import sr from '../i18n/sr.json'
import { translate } from '../i18n/translate'

/* What every form definition has to be true of, checked over all of them at
 * once rather than one form at a time.
 *
 * A form is data (PDL P30), so the rules a form obeys cannot live in the
 * component that draws it: the owner edits a JSON file and the component never
 * hears about it. This file is where a rule about the data itself goes.
 */

const HERE = join(process.cwd(), 'src', 'forms', 'definitions')

/* Read off the disk rather than out of `./definitions`, so a definition added as
   a file is swept whether or not anybody remembered to read it there. Through
   `formDef` on the way, which is what says the field types are ones the portal
   can draw; the rule below holds the two lists to each other. */
const FORMS = readdirSync(HERE)
  .filter((name) => name.endsWith('.form.json'))
  .map((name) => ({
    name,
    form: formDef(JSON.parse(readFileSync(join(HERE, name), 'utf-8'))),
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

  it('is read by the module the screens import it from', () => {
    /* The folder and `./definitions` have to name the same set. A definition
       written as a file and not read there is a form no screen can draw, and a
       name read there for a file that is gone is an import that fails at
       build. Nothing else notices either, because both halves keep working for
       every form that is in both. */
    expect(Object.keys(EXPORTED).sort()).toEqual(FORMS.map(({ name }) => name).sort())
  })

  it('refuses a field type the portal cannot draw', () => {
    /* What `formDef` is for. Before it, `as FormDef` at each screen said the
       written type was one of the twelve without looking, so a typo in a
       definition reached the renderer, which has no branch for it: the field
       was drawn as nothing at all and the form asked for one thing less. */
    expect(() =>
      formDef({
        id: 'proba',
        titleKey: 'proba.title',
        submitKey: 'proba.submit',
        fields: [{ name: 'ime', type: 'tekst', labelKey: 'proba.ime' }],
      }),
    ).toThrow('Form proba, field ime: tekst is not a field type')
  })

  it('gives every long box a limit', () => {
    /* A box with no limit is a box somebody can paste a novel into, and the
       column underneath it is not that wide. It is also the one field on the
       form that says nothing about how much room is left, because there is
       nothing to count down from: the renderer draws no counter without a limit
       and refuses nothing at the door.

       This reaches the definitions and nothing else. Two boxes were edited
       outside a form: a biography rewritten by a moderator (PendingQueue, until
       06.08.2026) and the rules of a competition rewritten in place
       (LeagueDetail). Both took
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

  it('gives every long box written by hand a limit, from a definition', () => {
    /* The rule above reaches the definitions, and a box written by hand reaches
       nothing. Two exist: the rules of a
       competition rewritten in place, and the comment beside a rating. The second
       was written in the same week as this test with no limit at all, and every
       test on the portal passed.

       It draws `LongBox` now, which is the box that knows what a limit is: the
       room counted down, what a paste lost, and a word when the box is full. The
       other two are uncontrolled boxes that save on blur, so they carry the
       number and not the counting; what they must not do is take whatever is
       pasted, because the value goes back into the form that made it and the
       next person to open that form is told their own words are too long.

       Read off the source, because there is no other way to see a box that no
       definition knows about. The tag is bounded by its own first `>`: bounded
       by `/>` instead, a box written as a pair ran on to the next self-closing
       tag in the file and borrowed its `maxLength`. */
    const drawn = sourceFiles().filter(({ code }) => code.includes('<textarea'))
    const loose = drawn
      .filter(({ code }) =>
        code
          .split('<textarea')
          .slice(1)
          .some((one) => !one.slice(0, one.indexOf('>')).includes('maxLength=')),
      )
      .map(({ path }) => path)

    /* The three, so the sweep is known to have found the boxes rather than an
       empty list, and so a fourth has to be looked at rather than merely
       counted. There were four until 15.08.2026: a moderator used to rewrite a
       biography in place on the verification queue and publish what they left,
       and the owner withdrew that on 06.08.2026 (PDL P22). What a member wrote
       about themselves is now approved as written or refused with a reason, so
       there is no box to limit. */
    expect(drawn.map(({ path }) => path).sort()).toEqual([
      'forms/LongBox.tsx',
      'pages/LeagueDetail.tsx',
      'pages/event/GoingToEvent.tsx',
    ])
    expect(loose).toEqual([])

    /* And each takes the number from a definition rather than typing one. */
    for (const { path, code } of drawn) {
      expect(code, path).toMatch(/maxLength=\{(limitOf\(|maxLength\})/)
    }
  })

  it('says where a link goes wherever its words carry one, and the other way', () => {
    /* Three things have to agree: the words carry `{link}`, the field says what
       the link reads (`linkKey`) and where it leads (`linkTo`). Two of the three
       and the sentence goes wrong in one direction or the other: without the
       pair, „{link}" itself is drawn on the screen; without the mark, the link
       is dropped and nobody is told. The dictionary guard sees only that the key
       resolves (i18n/keys.test.ts), so this is where the three meet. */
    const wrong = FORMS.flatMap(({ name, form }) =>
      form.fields
        .filter((field) => {
          const marked = translate(sr, 'sr', field.labelKey).includes('{link}')
          const led = field.linkKey !== undefined && field.linkTo !== undefined

          return marked !== led
        })
        .map((field) => `${name}: ${field.name}`),
    )

    expect(wrong).toEqual([])
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

  it('asks a competitor for a result the same way on both roads to one', () => {
    /* Two forms reach the same queue: the one on a member's own profile and the
       one on the page of an event. The owner asked for a picture and a comment,
       both optional, and asked in the same breath that the way of reporting be
       the same wherever it is done (03.08.2026, PDL P9). One of the two had no
       comment at all, so what a member could say about a result depended on
       which door they came through. */
    const roads = ['unos-rezultata.form.json', 'prijava-sa-trke.form.json'].map((name) => {
      const found = FORMS.find((one) => one.name === name)

      if (found === undefined) {
        throw new Error(`nema forme ${name}`)
      }

      return found
    })

    for (const { name, form } of roads) {
      for (const wanted of ['comment', 'photo']) {
        const field = form.fields.find((one) => one.name === wanted)

        expect(field, `${name} nema polje ${wanted}`).toBeDefined()
        /* Optional on both, and optional means the flag is absent or false
           rather than merely falsy: `required: true` would make a member who has
           nothing to add unable to send anything at all. */
        expect(field?.required ?? false, `${name}: ${wanted} je obavezno`).toBe(false)
      }
    }
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

/** Every `.tsx` under `src`, with its path relative to it. The only way to see a
 *  box that no definition knows about. */
function sourceFiles(dir = join(process.cwd(), 'src'), prefix = ''): { path: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return sourceFiles(at, name)
    }

    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')
      ? [{ path: name, code: readFileSync(at, 'utf-8') }]
      : []
  })
}
