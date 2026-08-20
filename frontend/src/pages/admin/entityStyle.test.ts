import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'

/**
 * What the refusal on the entity screens declares, and nothing about who wins.
 *
 * jsdom applies no stylesheet, so every rendered test on these screens sees a control
 * that looks exactly like every other one. The fault this file was written for lived
 * there: a record that may no longer be opened was refused by `aria-disabled` and
 * still carried the pointer and lit up in the accent under the mouse, because the
 * only rules for that attribute in the portal are written for the shared button and
 * this control is not one.
 *
 * **Nine rounds of review, twenty-five high findings, and the lesson is about the
 * question rather than the answers.** Every version of this file tried to decide
 * whether the refusal *wins*, and each was right about the axis it knew and blind to
 * the next: comments and `@media print` in the text; nesting, which jsdom drops and
 * Vite ships; another file, capitals, an attribute selector, an escaped letter; a
 * rule with no `:hover` at all; weight taken from the wrong part of a group;
 * `:active` and `:focus`; the resting state; shorthands and longhands;
 * pseudo-elements; layers; a custom property redefined on an ancestor; `all: revert`;
 * a shout added to a rule already permitted; an at-statement inside a block hiding
 * everything after it; and, unanswerable in principle, an inline style, which no
 * stylesheet can outweigh and which left the whole suite green.
 *
 * **Who wins is a question for a browser, and it is not asked here.** It is asked by
 * `scripts/refused-control-appearance.mjs`, which measures the built sheet in headless
 * Chrome in both themes and in three states, at rest and under a real mouse and a real
 * Tab: the only oracle that is not another reimplementation of the cascade. That script
 * is run by hand and it writes no markup of the portal's own, so two things it cannot
 * see are answered below, where jsdom answers them exactly: what a component puts on the
 * element itself, and whether the ancestors it writes out are the ancestors the portal
 * draws.
 *
 * **What is left is what jsdom can answer exactly:** that the refusal is written, that
 * it applies unconditionally, and that it declares what it is meant to declare. That
 * is worth keeping, because it is what was missing on the day the fault shipped:
 * there was no such rule at all.
 */
const css = readFileSync(join(process.cwd(), 'src/pages/admin/Entity.css'), 'utf-8')

/** Every rule of the sheet that applies unconditionally, with its selector. A rule
 *  inside `@media` or `@supports` is not among them, which is the point: a refusal
 *  that stops at a screen width is not a refusal. */
function unconditional(): { selector: string; style: CSSStyleDeclaration }[] {
  const tag = document.createElement('style')

  tag.textContent = css
  document.head.append(tag)

  const sheet = tag.sheet

  expect(sheet, 'jsdom did not parse Entity.css').not.toBeNull()

  const rules = [...(sheet?.cssRules ?? [])]
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .map((rule) => ({ selector: rule.selectorText, style: rule.style }))

  tag.remove()

  return rules
}

/** The one rule written for exactly this selector, and a failure naming it where
 *  there is none. */
function ruleFor(selector: string): CSSStyleDeclaration {
  const found = unconditional().filter((rule) => rule.selector === selector)

  expect(found.length, `${selector} is not an unconditional rule of Entity.css`).toBe(1)

  return must(found[0], `the rule ${selector}`).style
}

/** Every ancestor from the control up to the outermost shell, named the same way
 *  whichever document it is walked in. Classes are sorted, because two homes for one
 *  chain must not disagree over the order somebody wrote them in. The control's own id
 *  is left out of its name: the fixture needs one to find the button by and the portal
 *  has none, while the classes of that same button are exactly what has to agree.
 *
 *  The cut is at the outermost `.shell`, not the first one met walking up. Cut at the
 *  first, a second `.shell` wrapped around the app leaves everything above it
 *  uncompared: a review wrapped one and watched the guard stay green. */
function chainToShell(from: Element): string[] {
  const walk: Element[] = []
  let step: Element | null = from

  while (step !== null) {
    walk.push(step)
    step = step.parentElement
  }

  const shell = walk.map((one) => one.classList.contains('shell')).lastIndexOf(true)

  return walk.slice(0, shell + 1).map((one, index) => nameOf(one, index > 0))
}

/** An element said the same way in either document: its tag, its id where that is a fact
 *  both documents share, and its classes in a fixed order. */
function nameOf(one: Element, withId: boolean): string {
  const named = one.id === '' || !withId ? '' : `#${one.id}`
  const classes = [...one.classList]
    .sort()
    .map((cls) => `.${cls}`)
    .join('')

  return `${one.tagName.toLowerCase()}${named}${classes}`
}

describe('a record that may no longer be opened', () => {
  it('says so with the cursor, not only with an attribute', () => {
    /* The pointer is what a reader with a mouse reads first, and it is the one signal
       that survives on a control kept in the order of focus. */
    expect(ruleFor(".entity-open[aria-disabled='true']").cursor).toBe('not-allowed')
  })

  it('goes quiet rather than dim, so the focus ring keeps its strength', () => {
    /* Colours and never `opacity`, for the reason Home.css gives where the same rule
       is written for the shared button: opacity dims the focus ring with everything
       else, and a refused control is one somebody can still land on (WCAG 2.2 SC
       1.4.11). */
    const refused = ruleFor(".entity-open[aria-disabled='true']")

    expect(refused.color).toBe('var(--text-muted)')
    expect(refused.borderColor).toBe('var(--border)')
    expect(refused.opacity).toBe('')
  })

  it('does not light up under the mouse, which is what said it was live', () => {
    const hovered = ruleFor(".entity-open[aria-disabled='true']:hover")

    expect(hovered.background).toBe('transparent')
    expect(hovered.borderColor).toBe('var(--border)')
    expect(hovered.color).toBe('var(--text-muted)')
    /* And the same two things this file asks of the resting refusal. The hover rule is
       written later and more tightly, so whatever it declares is what a reader with a
       mouse actually gets, and that is the one state in which the cursor is seen at
       all. Both were unchecked here, measured. */
    expect(hovered.cursor).toBe('')
    expect(hovered.opacity).toBe('')
  })

  it('is written more tightly than the plain hover it has to beat', () => {
    /* Not a claim about the cascade, which this file no longer makes: only that both
       rules exist, that both apply unconditionally, and that the refusal names the
       attribute the plain hover does not. Whether it wins is checked in a browser. */
    const hovers = unconditional()
      .map((rule) => rule.selector)
      .filter((selector) => selector.includes('.entity-open') && selector.includes(':hover'))

    expect(hovers).toEqual([".entity-open[aria-disabled='true']:hover", '.entity-open:hover'])
  })

  it('reaches the button the screen actually draws', async () => {
    /* The one thing jsdom answers exactly and the reduction dropped: whether the
       selector this file asserts about is the selector the rendered control matches.
       A review renamed the class in `EntityEditor.tsx` and the whole suite of 1990
       tests stayed green while every refusal rule stopped reaching the button. */
    renderAt('/sr/administracija/cenovnik', 'superadmin', null, undefined, '2026-11-01')

    const refused = await screen.findByRole('button', { name: 'Otvori: Preporuka novog člana' })

    expect(refused.matches(".entity-open[aria-disabled='true']")).toBe(true)
    expect(refused.matches('.entity-open')).toBe(true)

    /* And it carries no style of its own. This is the axis that beat the last version
       of this file in a browser and would beat the script in `scripts/` too, because
       that script writes its own markup: an inline style outweighs every stylesheet
       there is, so no sheet can be read to rule it out. Here it is not a question about
       the cascade at all, only about the attribute, and jsdom answers that exactly. */
    expect(refused.getAttribute('style')).toBeNull()
  })

  it('says out loud what it does not guarantee', () => {
    /* A guard believed to cover more than it does is worse than none, and this one was
       believed for nine rounds. The sentence is in the file, and this test is what
       keeps it there. */
    const guard = readFileSync(join(process.cwd(), 'src/pages/admin/entityStyle.test.ts'), 'utf-8')
    /* The header alone, not the whole file. Read whole, this test found the sentence
       written in its own assertion and passed over a header rewritten to claim the
       opposite: a review measured exactly that. */
    const header = guard.slice(0, guard.indexOf('const css'))

    expect(header).toContain('Who wins is a question for a browser, and it is not asked here')

    /* And the browser it sends the reader to is there to be run. The path is written in
       a comment, so nothing but this holds it: delete the script and the sentence above
       keeps promising the axis is covered while the suite stays green. Measured, it
       did. */
    const asked = [...header.matchAll(/`(scripts\/[\w/-]+\.mjs)`/g)].map((found) => found[1])

    expect(asked.length, 'the header names no script at all').toBeGreaterThan(0)

    /* Every name, not the first. A review added a sentence saying the measurement had
       moved to a second file, which does not exist, and the first name still did, so a
       check on one match passed while the reader was sent nowhere. */
    for (const one of asked) {
      const where = join(process.cwd(), must(one, 'a script named in the header'))

      expect(existsSync(where), `${one} is named in the header and is not there`).toBe(true)
      expect(readFileSync(where, 'utf-8').length, `${one} is empty`).toBeGreaterThan(0)
    }
  })

  it('is measured in a browser over the chain the portal actually draws', async () => {
    /* The one fact that lives in two places: the ancestors of this control. The script
       cannot render the portal, so it writes the chain out by hand, and a rule keyed on
       a link it is missing beats the refusal on specificity alone and is measured as
       though it were not there. It drifted twice, caught both times by a review and not
       by anything here: first `#root`, `.shell` and `.shell__main`, then `.adminsection`
       and `.adminsection__body`.

       So the fixture is read out of the script and put beside the chain this render
       produces. Neither home is the authority; they have to agree. */
    const script = readFileSync(
      join(process.cwd(), 'scripts/refused-control-appearance.mjs'),
      'utf-8',
    )
    /* From the fixture, not from the first `<body>` in the file: the sentence above it
       says the word too, and a boundary that lands in prose is one nobody notices until
       it moves. */
    const starts = script.indexOf('const FIXTURE')

    expect(starts, 'the script has no fixture').toBeGreaterThan(-1)

    const opens = script.indexOf('<body>', starts)
    const closes = script.indexOf('</body>', starts)

    expect(opens, 'the fixture has no body').toBeGreaterThan(-1)
    expect(closes, 'the fixture body is never closed').toBeGreaterThan(opens)

    const holder = document.createElement('div')

    holder.innerHTML = script.slice(opens + '<body>'.length, closes)

    const written = must(holder.querySelector('#refused'), 'the refused control in the fixture')

    renderAt('/sr/administracija/cenovnik', 'superadmin', null, undefined, '2026-11-01')

    const drawn = await screen.findByRole('button', { name: 'Otvori: Preporuka novog člana' })

    /* From the button itself, so its own classes are in the comparison: a review added
       one to `EntityEditor.tsx`, wrote a rule for it, and both guards stayed green. */
    const inFixture = chainToShell(written)
    const onScreen = chainToShell(drawn)

    /* Both have to get there, or two chains that stop early could agree about nothing. */
    expect(inFixture.at(-1), 'the fixture does not reach the shell').toBe('div.shell')
    expect(onScreen.at(-1), 'the screen does not reach the shell').toBe('div.shell')
    expect(inFixture).toEqual(onScreen)

    /* Above the shell the two documents cannot agree and should not be asked to: under
       test the app is mounted in a container of the test library's own, and in the
       portal it is `#root` from `index.html`. So each is held against its own home. */
    const above = must(
      must(holder.querySelector('.shell'), 'the shell in the fixture').parentElement,
      'what the fixture puts above the shell',
    )

    /* The whole element, classes and all, against the whole element `index.html` writes.
       Held only by its id, a class added on either side drifts unseen in both
       directions: a review put one on each in turn and watched this stay green. */
    const home = document.createElement('div')

    home.innerHTML = must(
      /<div id="root"[^>]*>\s*<\/div>/.exec(readFileSync(join(process.cwd(), 'index.html'), 'utf-8')),
      'the mount point in index.html',
    )[0]

    expect(nameOf(above, true)).toBe(
      nameOf(must(home.firstElementChild, 'the mount point in index.html'), true),
    )
    expect(nameOf(above, true)).toContain('#root')

    const mount = must(
      must(drawn.closest('.shell'), 'the shell on the screen').parentElement,
      'what the screen puts above the shell',
    )

    expect(mount.id, 'something stands between the mount point and the shell').toBe('')
    expect(mount.className, 'something stands between the mount point and the shell').toBe('')
    expect(must(mount.parentElement, 'above the mount point').tagName.toLowerCase()).toBe('body')
  })
})
