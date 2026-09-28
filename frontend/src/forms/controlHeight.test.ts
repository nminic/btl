import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bare } from '../test/sources'
import { at } from '../test/at'
import { FORMS } from './definitions'

/**
 * EVERY CONTROL IN A FIELD IS THE SAME HEIGHT, AND EVERY FIELD PUTS ITS CONTROL THE
 * SAME DISTANCE UNDER ITS NAME.
 *
 * <p>Owner, 28.09.2026, over a picture of the registration: „sredi i visine i
 * vertikalne pozicije svih dropdown polja (datum rodjenja, drzava, velicina majice).
 * Moraju biti savrseno visine tekstualnih boksova i dugmadi u tim redovima, a
 * vertikalna pozicija mora biti identicna (npr. trenutno Velicina majice boks bezi i
 * pocinje iznad nivoa dugmadi Kategorija)."
 *
 * <p><b>Two requirements, and they had two different causes.</b> Measured in Chrome
 * over the built package at 1280 before anything was changed: a text box 46,13px, the
 * button that opens a calendar 46,13, a select 44, a group of buttons 44, the country
 * beside a town 43,33 - and the group of buttons began 30,79px into its field while
 * everything beside it began at 28,79. So the height came from five controls working
 * it out five ways, and the position from one field disagreeing about a gap.
 *
 * <p><b>Why this is a guard over the sheets and not over the screen.</b> jsdom computes
 * no layout, so a case that renders a form can read every attribute of a control and
 * not one pixel of it. The question „is everything in this row the same height" cannot
 * be asked there at all. What can be asked, and answered completely, is where a height
 * is allowed to come from - and that is the question this asks.
 *
 * <p><b>Both are properties, not lists of pixels.</b> A guard that wrote down the
 * numbers would have to be right about a number nobody has chosen yet, and this portal
 * has already paid four rounds of review for that shape. „Anything inside a field that
 * says how tall it is says it with the one token" is true or false about a sheet
 * without knowing what the token is worth, and it stays true the day somebody changes
 * what it is worth.
 *
 * <p><b>The floor is the file system and the parser, never a list kept here.</b> Every
 * `.css` the portal has is read, every rule in it is parsed, and the rules that answer
 * for a form field are picked out by the class names in their own selectors. A sheet
 * added tomorrow is read on the day it is added.
 */

const SRC = join(process.cwd(), 'src')

/** The one name a height inside a field may be written with (`styles/tokens.css`). */
const TOKEN = '--control-height'

/** What a rule may say about its own block size, beside the token. `auto` is how a
 *  control opts out, and the one that does is the tick: it is a mark of 1,15rem and
 *  not a box, so the height of a text box turns it into a rectangle. */
const OPT_OUT = 'auto'

type Rule = { path: string; selector: string; declarations: [string, string][] }

/** Every stylesheet the portal has, wherever it lives. */
function sheets(dir = SRC, prefix = ''): { path: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    const full = join(dir, entry.name)

    if (entry.isDirectory()) {
      return sheets(full, name)
    }

    return entry.name.endsWith('.css') ? [{ path: name, code: readFileSync(full, 'utf-8') }] : []
  })
}

/**
 * The rules of one sheet, as a selector and what it declares.
 *
 * Innermost blocks only, which is what the pattern gives: a rule inside `@media`
 * is found with its own selector, and the wrapper around it matches nothing. That
 * is the shape `styles/cellSpecificity.test.ts` already reads sheets with.
 */
function rules(path: string, code: string): Rule[] {
  const text = bare(code)
  const found: Rule[] = []

  for (const block of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = at(block, 1).trim()
    const body = at(block, 2)

    if (selector === '' || selector.startsWith('@')) {
      continue
    }

    found.push({
      path,
      selector,
      declarations: [...body.matchAll(/([a-z-]+)\s*:\s*([^;]+)/g)].map((one) => [
        at(one, 1).trim(),
        at(one, 2).trim(),
      ]),
    })
  }

  return found
}

/** The class names a selector is written with, as names rather than as text. */
function classesOf(selector: string): string[] {
  return [...selector.matchAll(/\.([\w-]+)/g)].map((one) => at(one, 1))
}

/**
 * Whether what this rule is dressing is a field itself, rather than something that
 * happens to stand in one.
 *
 * <p>The subject of a selector is its rightmost part, and that distinction is not
 * pedantry here: it is what the first draft of this file got wrong and what the case
 * below caught on the day it was written. `.form__row .field--place .place` names a
 * field in the middle of itself, and the gap it declares is the one BETWEEN a town
 * and the country beside it - sideways, inside the field - not the one between a name
 * and the control under it. Read as a field's own gap it looked like a third opinion
 * about the same thing, and it is not an opinion about that thing at all.
 */
function isAField(selector: string): boolean {
  return selector.split(',').some((part) => {
    const names = classesOf(part)
    const last = names[names.length - 1]

    return last !== undefined && (last === 'field' || last.startsWith('field--'))
  })
}

/** Whether this rule answers for something standing inside a field of a form.
 *
 *  Asked of the class names and not of the text, which is the whole of what keeps
 *  `clock/DateSwitch.css` out of it: that sheet dresses a `.field__control` of its
 *  own and pins it shorter on purpose, in the shell of every screen and inside no
 *  field at all. `.date-switch .field__control` names `date-switch` and
 *  `field__control` and never names `field`, so it is not this rule's business. */
function insideAField(selector: string): boolean {
  return classesOf(selector).some((name) => name === 'field' || name.startsWith('field--'))
}

const ALL = sheets().flatMap((one) => rules(one.path, one.code))

/** Every property by which a rule can say how tall something is. */
const TALL = ['height', 'min-height', 'max-height', 'block-size', 'min-block-size', 'max-block-size']

describe('how tall a control in a form is', () => {
  it('is said with the one token, wherever it is said', () => {
    /* THE MUTATION THIS IS WRITTEN AGAINST IS A HEIGHT ON ONE CONTROL, not on all of
       them: put `min-block-size: 2.75rem` back on the buttons of a choice and this
       fails while every other control keeps its own. A guard that compared the
       controls to each other would have passed that, because it would have been
       comparing two numbers this file never reads. */
    const said = ALL.flatMap((rule) =>
      rule.declarations
        .filter(([property]) => TALL.includes(property))
        .filter(() => insideAField(rule.selector))
        .map(([property, value]) => ({ where: `${rule.path} ${rule.selector}`, property, value })),
    )

    /* And it is asking about something. A sweep that matched nothing would pass this
       file for ever, and it is the one way a guard over sheets dies quietly: a class
       is renamed, `insideAField` stops recognising anything, and every case here goes
       green over a portal it is no longer reading. */
    expect(said.length, 'no rule inside a field says how tall anything is').toBeGreaterThan(0)

    for (const one of said) {
      expect(one.value, `${one.where} sets ${one.property} without ${TOKEN}`).toMatch(
        new RegExp(`var\\(${TOKEN}\\)|^${OPT_OUT}$`),
      )
    }
  })

  it('is not asked of the one control that is a mark rather than a box', () => {
    /* The height above binds everything in a field, and a tick is in a field. Without
       something saying otherwise it stops being 1,15rem square and becomes a rectangle
       the size of an empty text box - and nothing else would notice, because the rule
       it loses to is correct and the tick simply comes out the wrong shape.
     *
       Held as „somebody says so" rather than as a number, and the reason the exemption
       is allowed to exist at all is read from the definitions rather than remembered:
       a portal with no checkbox on any form would not need one, and would be telling
       this file about a control it no longer draws. */
    const draws = Object.values(FORMS).flatMap((form) => form.fields.map((field) => field.type))

    expect(draws, 'no form asks for a tick any more, so nothing needs to opt out')
      .toContain('checkbox')

    const optsOut = ALL.filter(
      (rule) => insideAField(rule.selector) && rule.selector.includes('checkbox'),
    ).flatMap((rule) =>
      rule.declarations.filter(([property, value]) => TALL.includes(property) && value === OPT_OUT),
    )

    expect(optsOut.length, 'the tick would be given the height of a text box').toBeGreaterThan(0)
  })

  it('is worth one thing, said in one place', () => {
    const declared = ALL.flatMap((rule) =>
      rule.declarations
        .filter(([property]) => property === TOKEN)
        .map(([, value]) => `${rule.path}: ${value}`),
    )

    expect(declared, `${TOKEN} is not declared exactly once`).toHaveLength(1)
  })
})

describe('where a field puts its control under its name', () => {
  /**
   * The exemption below is measured rather than remembered.
   *
   * A checkbox field keeps a gap of its own, and it may: a tick and its sentence are
   * not a box under a name, and nothing ever stands beside it to be out of line with.
   * That second half is the part worth proving, and it is proved from the definitions
   * themselves rather than from anybody's memory of them - a checkbox put on a row
   * tomorrow takes this exemption away on the day it is written.
   */
  const KEEPS_ITS_OWN = 'field--checkbox'

  it('never asks a checkbox to stand beside anything', () => {
    const onARow = Object.values(FORMS).flatMap((form) =>
      form.fields.filter((field) => field.row !== undefined).map((field) => field.type),
    )

    expect(onARow.length, 'no form puts any field on a row').toBeGreaterThan(0)
    expect(onARow, `a checkbox now shares a row, so ${KEEPS_ITS_OWN} may not keep its own gap`)
      .not.toContain('checkbox')
  })

  it('is the same distance for every field that can share a row', () => {
    /* TWO MUTATIONS, AND BOTH HAVE TO FAIL, which is the difference between „the
       control was moved" and „the control is in line". Widen the gap of a choice and
       its buttons fall below the box beside them; narrow it and they rise above it.
       Neither is caught by a case that only knows the gap changed, so what is held
       here is that there is exactly ONE gap among the fields that can stand together. */
    const gaps = ALL.filter(
      (rule) => isAField(rule.selector) && !classesOf(rule.selector).includes(KEEPS_ITS_OWN),
    ).flatMap((rule) =>
      rule.declarations
        .filter(([property]) => property === 'gap' || property === 'row-gap')
        .map(([, value]) => ({ where: `${rule.path} ${rule.selector}`, value: value.split(' ')[0] })),
    )

    expect(gaps.length, 'no field declares a gap at all').toBeGreaterThan(1)
    expect(
      [...new Set(gaps.map((one) => one.value))],
      `fields disagree about the gap under a name: ${gaps.map((one) => `${one.where} = ${one.value}`).join(', ')}`,
    ).toHaveLength(1)
  })
})
