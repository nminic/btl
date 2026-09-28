import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { renderAt } from '../test/render'
import { bare, sources, WHOLE_PORTAL } from '../test/sources'
import { at } from '../test/at'
import { FORMS } from './definitions'
import { FormRenderer } from './FormRenderer'

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

/** Whether this rule is one of those that hand a control the shared height.
 *
 *  SAYING SOMETHING ABOUT HEIGHT IS NOT THE SAME AS GIVING ONE, and reading it as
 *  the same is what let a whole third of this guard go quiet: the exemption below
 *  („the tick is `auto`") is a rule inside a field declaring a height, so a set built
 *  from „declares a height" answered for `field__control` even with the shared rule
 *  renamed away from it. Measured on 28.09.2026 by an independent review, over the
 *  twelve files that name any of these classes: `.field .field__control,` renamed to
 *  `.field .field__control--gone,` left 241 cases passing while the text box, the
 *  calendar button and the country beside a town all came apart on the screen. */
function givesTheHeight(rule: Rule): boolean {
  return (
    insideAField(rule.selector) &&
    rule.declarations.some(
      ([property, value]) => TALL.includes(property) && value.includes(`var(${TOKEN})`),
    )
  )
}

/** Whether this rule is one of those that let a control out of the shared height. */
function letsItOut(rule: Rule): boolean {
  return (
    insideAField(rule.selector) &&
    rule.declarations.some(([property, value]) => TALL.includes(property) && value === OPT_OUT)
  )
}

/**
 * The input types a browser draws as a MARK rather than as a box, and the boundary
 * this file cannot cross.
 *
 * <p>A mark and a box are the same class here - both are `.field__control` - so the
 * type is the only thing that tells them apart, and it is named in the sheet for the
 * same reason. What is held below is not this list but what the portal DRAWS: every
 * mark standing in a field has to be let out by a rule that matches it. A third kind
 * of input that a browser draws as a mark would have to be added here by hand, and
 * nothing in jsdom can discover one, because jsdom lays nothing out. That is written
 * down rather than guarded.
 */
const MARKS = ['checkbox', 'radio']

/**
 * The screens that write a `.field` by hand, read off the sources rather than kept.
 *
 * <p><b>The list this replaces was never written down, and that is what went wrong.</b>
 * The prose over the shared rule named the one thing OUTSIDE a field that wears the
 * class and said nothing about what is inside one, and it was read as saying that a
 * field is what the renderer draws. It is not: a radio written by hand came out 48px
 * tall on two screens a member uses, and no definition asks for a radio at all, so
 * nothing drawn from `FORMS` could ever have shown it.
 *
 * <p>Asked of the class name as it is written in JSX, which is what these screens
 * really write; a wrapper built out of a variable would be missed, and that is the
 * limit of this sweep rather than a claim about it.
 */
function handWrittenFields(): string[] {
  const all = sources()

  expect(all.length, 'the sweep of the portal found almost nothing').toBeGreaterThan(WHOLE_PORTAL)

  return all
    .filter((one) => /className="field[\s"]/.test(bare(one.code)))
    .map((one) => relative(SRC, one.path).split(/[\\/]/).join('/'))
    .sort()
}

/**
 * Every form the portal defines, drawn.
 *
 * <p>EVERY FORM AND NOT THE REGISTRATION ALONE. The owner named three dropdowns on one
 * screen, but one renderer draws all thirteen definitions across six screens, so a fix
 * measured on the registration says nothing about the other twelve unless they are
 * drawn too. Drawn here rather than visited in a browser because most of them are
 * behind a sign-in and none of them needs to be visited to answer this: what is asked
 * is which controls exist, and that is the same answer in jsdom as on a screen.
 */
function drawEveryForm(): void {
  for (const form of Object.values(FORMS)) {
    render(
      <ClockProvider simulatedDay={null}>
        <I18nProvider locale="sr">
          <FormRenderer form={form} onSubmit={() => undefined} />
        </I18nProvider>
      </ClockProvider>,
    )
  }
}

/** Every element standing inside a field, whatever draws it. */
function everythingInAField(): Element[] {
  return [...document.querySelectorAll('.field')].flatMap((field) => [
    field,
    ...field.querySelectorAll('*'),
  ])
}

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

  it('is actually given to every control a field draws, and the list comes from the DOM', () => {
    /* THE HALF THE FIRST DRAFT OF THIS FILE WAS MISSING, and a mutation found it: the
       case above says where a height may COME FROM, and says nothing about whether any
       control is given one. Take the shared rule out altogether and that case went on
       passing, because what was left - the tick opting out - is a legal answer to the
       only question it asks. Measured on 28.09.2026: „revert the shared height"
       SURVIVED a guard of four cases, which is exactly the shape of a guard that reads
       as though it works.
     *
       THE CONTROLS ARE NOT LISTED HERE. They are read off a form the portal really
       draws, through the one link that says which control a field is about: its label
       names it (`htmlFor`), and for a group of buttons, which has no single control to
       name, the boxes are the labels inside the group. A field type added tomorrow is
       read on the day it is drawn, and a field that stops being drawn stops being
       asked about. */
    drawEveryForm()

    const drawn = new Set<string>()

    for (const field of document.querySelectorAll('.field')) {
      for (const label of field.querySelectorAll<HTMLLabelElement>('label[for]')) {
        /* Except inside a group of buttons, where the control a label names is not the
           box anybody sees. The radio itself is laid over the whole of its label and
           made invisible, on purpose and with its reasons written beside it
           (`.choice__input`, `forms/FormRenderer.css`): it is the size of the label
           rather than the other way round, so asking how tall it is asks nothing. The
           boxes of a group are collected below, as the labels they are. */
        if (label.closest('[role="radiogroup"]') !== null) {
          continue
        }

        const control = document.getElementById(label.htmlFor)

        for (const name of control?.classList ?? []) {
          drawn.add(name)
        }
      }

      for (const box of field.querySelectorAll('[role="radiogroup"] label')) {
        for (const name of box.classList) {
          drawn.add(name)
        }
      }
    }

    expect(drawn.size, 'the form drew no control this could ask about').toBeGreaterThan(0)

    /* Which of those the sheets actually GIVE THE HEIGHT TO. A class is answered for
       if some rule inside a field names it and hands it the token - not merely if some
       rule inside a field mentions a height while naming it, which is what this asked
       until 28.09.2026 and which the exemption below satisfied all by itself. */
    const answered = new Set(ALL.filter(givesTheHeight).flatMap((rule) => classesOf(rule.selector)))

    /* A control that carries no class of its own cannot be reached by a sheet, and the
       renderer gives every one of them one; `field__control` is that class for all but
       the buttons of a choice. */
    for (const name of drawn) {
      expect(
        [...answered].some((said) => said === name),
        `nothing tells ${name} how tall to be, so it works it out for itself`,
      ).toBe(true)
    }
  })

  it('names, in the sheet, only classes something in a field really wears', () => {
    /* THE JOIN BETWEEN THE TWO HALVES, WHICH NEITHER HALF CLAIMED. The case above
       walks from the DOM to the sheet, so it cannot see a class the SHEET names and
       nothing wears: `datepicker__open` never entered its set at all, because the set
       is built from labels and no label points at the button that opens a calendar.
       Measured by an independent review on 28.09.2026: `.field .datepicker__open {`
       renamed to `.field .datepicker__open--gone {` left 241 cases passing over twelve
       files while the button lost its height on the screen.
     *
       So the same question is asked walking the other way, and one token of change is
       all either of them needs to be wrong: a class is a name two sides say, and a
       guard that hears only one of them hears nothing. */
    drawEveryForm()

    const worn = new Set(everythingInAField().flatMap((one) => [...one.classList]))

    expect(worn.size, 'nothing was drawn inside a field at all').toBeGreaterThan(0)

    const named = ALL.filter(givesTheHeight)

    expect(named.length, 'no rule inside a field hands anything the shared height').toBeGreaterThan(
      0,
    )

    for (const rule of named) {
      for (const name of classesOf(rule.selector)) {
        expect(
          worn.has(name),
          `${rule.path} ${rule.selector} gives the height to .${name}, and nothing in a field wears it`,
        ).toBe(true)
      }
    }
  })

  it('is not asked of the controls that are marks rather than boxes', async () => {
    /* The height above binds everything in a field, and a mark is in a field. Without
       something saying otherwise it stops being its own square and becomes a rectangle
       the size of an empty text box - and nothing else would notice, because the rule
       it loses to is correct and the mark simply comes out the wrong shape.
     *
       ~~ASKED OF THE TEXT OF THE SELECTOR~~, which is the third of the three ways this
       file read as though it worked. It asked whether SOME rule inside a field had the
       word „checkbox" anywhere in its selector and said `auto`, and never whether that
       rule reached the tick: rename `.field .field__control[type='checkbox']` to a
       class nothing wears and the word is still there, so the case passed while the
       tick stood at the height of a text box. THE SELECTOR ENGINE IS ASKED INSTEAD, of
       the element itself, which is one question with one answer however the selector
       happens to be spelled.
     *
       AND OF EVERY MARK THE PORTAL DRAWS, not of the one the renderer draws. A radio
       is a mark and no definition asks for one, so the marks are collected from the
       screens that write a field by hand as well - which is exactly where a review
       found a radio 48px tall. */
    drawEveryForm()

    /* A member's settings, because that is where the portal writes a field by hand and
       puts a radio in it. Awaited on the control itself rather than on the screen
       around it: a case that renders and reads at once reads a screen still being
       drawn. */
    renderAt('/sr/podesavanja', 'competitor', '000007')
    expect(await screen.findByRole('radio', { name: 'Tamna' })).toBeInTheDocument()

    /* THE MARKS THE SHARED HEIGHT WOULD OTHERWISE REACH, which is not the same as every
       mark in a field and is not a list of exceptions either: the radio inside a group
       of buttons is a mark too, and it is laid over the whole of its label at
       `opacity: 0` and sized by its own rule (`.choice__input`), so the shared height
       never reaches it and it has nothing to be let out of. Asked by matching the very
       rules that hand out the height, so the answer moves with them. */
    const marks = everythingInAField().filter(
      (one) =>
        MARKS.some((kind) => one.matches(`input[type="${kind}"]`)) &&
        ALL.filter(givesTheHeight).some((rule) =>
          rule.selector.split(',').some((part) => one.matches(part.trim())),
        ),
    )

    /* And it is asking about something. The exemption is allowed to exist because the
       portal really draws marks in fields; a portal that drew none would be telling
       this file about a control it no longer has. */
    expect(
      marks.length,
      'no field draws a mark any more, so nothing needs to opt out',
    ).toBeGreaterThan(0)

    for (const kind of MARKS) {
      expect(
        marks.some((one) => one.matches(`input[type="${kind}"]`)),
        `no field draws a ${kind}, so the sheet lets out a control the portal has not got`,
      ).toBe(true)
    }

    for (const mark of marks) {
      expect(
        ALL.filter(letsItOut).some((rule) =>
          rule.selector.split(',').some((part) => mark.matches(part.trim())),
        ),
        `${mark.id === '' ? mark.outerHTML : `#${mark.id}`} would be given the height of a text box`,
      ).toBe(true)
    }
  })

  it('is paid for by every screen that writes a field by hand, and those are counted', () => {
    /* THE FLOOR UNDER THE TWO TYPES NAMED IN THE SHEET, and the thing whose absence
       cost a high finding on 28.09.2026.
     *
       Nothing here can decide that a third kind of input is a mark: jsdom lays nothing
       out, so it cannot see that a control came out the wrong shape, and a browser is
       not run in this gate. What CAN be held is the moment somebody has to look: the
       shared height reaches whatever stands inside a `.field`, and a field is written
       both by the renderer and by hand. A fourth screen that writes one by hand is a
       screen nobody has measured, and it fails here on the day it is written rather
       than on the day a member notices.
     *
       Held as the list of files rather than as a number of wrappers, because adding a
       second tick to a screen already counted changes nothing anybody needs to look
       at, and a guard that asks a question with a known answer is asked once and then
       disbelieved. */
    expect(handWrittenFields()).toEqual([
      'forms/FormRenderer.tsx',
      'pages/event/GoingToEvent.tsx',
      'pages/member/Membership.tsx',
      /* THE FIRST SCREEN THIS CASE EVER STOPPED, and it stopped it the day it arrived: the
         block that hides a profile moved out of the settings into a screen of its own, and
         a screen that writes a field by hand is a screen nobody has measured. Measured in
         Chrome over the built package at 360, 768 and 1280 before it was written down
         here: the tick is 18,39 square, which is the 1,15rem it is given and not the
         height of a text box, so the way out above already reaches it. */
      'pages/member/ProfileVisibility.tsx',
      'pages/member/Settings.tsx',
    ])
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
