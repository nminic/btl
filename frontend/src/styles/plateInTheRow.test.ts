import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { PLATE_CLASSES } from '../test/plate'
import { everyRule, ruleFor } from '../test/stylesheet'

/**
 * WHERE THE PLATE SITS UP AND DOWN IN THE ROW THAT DRAWS IT.
 *
 * Owner, 28.09.2026, from a screenshot of a row of the main standing: „problem je što je ceo boks
 * koji čine okrugla slika, ime, prezime i članski broj vertikalno necentriran u odnosu na ostatak
 * reda. Ceo taj boks treba spustiti dodatno par piksela." Written into `PDL.md` under „Boks sa
 * slikom i imenom u redu tabele nije vertikalno centriran", where the same entry says what was NOT
 * decided: **how many pixels**, which is measured and not chosen.
 *
 * **The measurement, in a real browser over the built bundle, because jsdom lays nothing out**
 * (ADL A33). The plate is an inline box, so it sat on the BASELINE of its cell's line box, and
 * that line box also carries the cell's own invisible strut. The plate is far taller than the
 * strut, so the strut reached nothing above it and its descent reached 6,8px BELOW it: the line
 * box came out 6,8px taller than the plate, all of it underneath. The plate therefore stood 3,4px
 * above the middle of its own cell, and the row was 6,8px taller than anything drawn in it. Worst
 * row of each screen, as the distance the plate stood ABOVE the middle of its row:
 *
 * | screen | 360 | 768 | 1280 |
 * |---|---|---|---|
 * | main standing | −1,75 → −0,25 | 3,40 → −0,25 | 3,40 → −0,25 |
 * | top boards | 6,80 → 6,80 | 4,27 → 4,27 | 2,20 → −0,25 |
 * | standing of a competition | 2,68 → 1,30 | 2,68 → 0,50 | 2,68 → 0,50 |
 *
 * No screen gained a sideways scroll at any width and no row grew anywhere: every row that changed
 * got shorter, by the 6,8px that was never drawn.
 *
 * **The two residues are a decision rather than this fault, and saying which is the whole of the
 * boundary.** The 6,80 and 4,27 of the top boards are the rows where ANOTHER cell is taller than
 * the plate, and there every table on the portal but one puts its cells at the TOP on purpose
 * (`styles/table.css`: „a table is read across, and reading across needs a shared baseline"). On
 * the rows of that same screen where the plate IS the tallest cell it reads −0,25 after the change,
 * which is what the main standing reads everywhere. Only the main standing centres its own cells,
 * which is the owner's other sentence of the same day and is held in
 * `pages/rankingsMemberRow.test.ts`. Moving the other five tables off the shared rule would
 * overturn a written decision, so it is not done here.
 *
 * The 0,50 left on the standing of a competition is neither of those: it is half the rule under the
 * row. Its first cell at 1280 has 10px of padding above and below, no border above and 1px below,
 * and the plate stands 10,00px from the top of the row and 11,00px from the bottom, so the row box
 * holds a line the plate does not.
 *
 * **Why this file exists beside the golden text that already holds the sheet.**
 * `styles/leagueLayout.test.ts` compares the whole of `components/NamePlate.css` with the text a
 * browser was measured against, so a `vertical-align` taken away fails there too. What a golden
 * text cannot say is WHICH of its lines decides this, and it fails identically for a comma. The
 * case below says the decision in words, and the sweep under it answers the question a golden text
 * answers only for one file: **is there anywhere in the portal a second declaration that moves
 * this box up or down.** That is the mutation this was written against — not „put it back", which
 * every reading catches, but „push it further down", which a guard that only asserts one value
 * lets through and which would then say the box is MOVED rather than CENTRED.
 */

const SRC = join(process.cwd(), 'src')
const PLATE = join(SRC, 'components/NamePlate.css')

/**
 * WHETHER A PROPERTY DECIDES WHERE THE PLATE'S OWN BOX SITS UP AND DOWN.
 *
 * **A map with a floor rather than a list, and the floor is that an unclassified property FAILS**
 * (`CLAUDE.md`, „Spisak u čuvaru se piše zajedno sa svojim podom"). This is the shape
 * `test/stylesheet.ts` already uses for `overflow` and for the same reason written there: a list
 * of the ways to move a box is not a list anybody finishes by thinking about it. So nothing here
 * is „the properties the portal happens to write"; it is what these CSS properties mean, and a
 * property that arrives in a plate rule and is in neither half stops the sweep instead of passing
 * it.
 *
 * **`true` is anything that shifts the box itself**, whether by the line it sits on, by space
 * around it, by the flow it is taken out of, or by a painted offset. **`false` is what the plate
 * writes today that cannot move it**, each because it decides something inside the box or beside
 * it: what kind of box it is and how its own children are laid out, how the words in it are set,
 * and how wide the gap between the circle and the words is.
 */
const MOVES_THE_BOX = new Map([
  /* The line it sits on, which is this file's whole subject. */
  ['vertical-align', true],
  /* Space above or below it, in every spelling of the four the box model has. */
  ['margin', true],
  ['margin-top', true],
  ['margin-bottom', true],
  ['margin-block', true],
  ['margin-block-start', true],
  ['margin-block-end', true],
  /* Taken out of the flow, and then offset within it. */
  ['position', true],
  ['inset', true],
  ['inset-block', true],
  ['inset-block-start', true],
  ['inset-block-end', true],
  ['top', true],
  ['bottom', true],
  /* Painted somewhere other than where it was laid out. */
  ['transform', true],
  ['translate', true],
  /* Where a flex or grid child is put across its own line, which a plate becomes the day one of
     the six screens lays its cell out with either. */
  ['align-self', true],

  /* What kind of box it is, and how the circle and the words are arranged inside it. Neither moves
     the box in its line: `display` here is what MAKES it an inline box in the first place, and the
     case below reads its value rather than letting this map speak for it. */
  ['display', false],
  ['align-items', false],
  ['gap', false],
  /* How the words in it are set. */
  ['text-align', false],
  ['text-transform', false],
  ['letter-spacing', false],
  ['font-weight', false],
  /* And what the portal says to EVERY element, which reaches the plate as it reaches everything
     else: the two rules of `index.css` written `*, *::before, *::after`. Where the edges of a box
     are counted from, which changes how big it is and not where in a line it sits; and the four
     that stand still for anybody who asked for less motion (`prefers-reduced-motion`, WCAG 2.2 SC
     2.3.3), which decide how long a change takes rather than what it is. They are here because
     they are really declared on the plate, not because a reset is assumed harmless: a reset that
     one day says `margin` would come out of this sweep as the one thing that moves every box on
     the portal. */
  ['box-sizing', false],
  ['animation-duration', false],
  ['animation-iteration-count', false],
  ['transition-duration', false],
  ['scroll-behavior', false],
])

/** Every stylesheet the portal has, found rather than listed. */
function everySheet(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? everySheet(join(dir, entry.name))
      : entry.name.endsWith('.css')
        ? [join(dir, entry.name)]
        : [],
  )
}

/** Where a file sits under `src`, written the same way on either platform. */
function named(path: string): string {
  return relative(SRC, path).split(sep).join('/')
}

/**
 * THE PLATE IN BOTH SHAPES IT IS EVER DRAWN IN, so a selector can be asked whether it reaches THE
 * PLATE rather than something drawn inside it.
 *
 * The classes come from `test/plate.ts`, whose floor is `components/namePlate.test.tsx`: it renders
 * every shape the component has and reads `classList` off the DOM. The outer element writes its two
 * through a template (`` `plate${pair ? ' plate--pair' : ''}` ``), so no reading of the source has
 * them, and three guards on this portal have already died reading source for this.
 *
 * **Two elements and not one**, which is a hole closed rather than a symmetry: one competitor wears
 * `plate` alone and a pair wears both, and a rule written `.plate:not(.plate--pair)` reaches the
 * first and not the second. Asked of a single element carrying both, such a rule would answer no
 * and a margin under every single name would go unseen.
 */
function everyShapeOfThePlate(): HTMLElement[] {
  const own = PLATE_CLASSES.filter((one) => one === 'plate' || one === 'plate--pair')

  expect(own, 'the plate no longer wears the classes this guard is written against').toEqual([
    'plate',
    'plate--pair',
  ])

  return [['plate'], own].map((classes) => {
    const element = document.createElement('span')

    element.className = classes.join(' ')

    return element
  })
}

/** Whether that selector reaches the plate in either shape, asked of the DOM rather than read off
 *  the text. A selector jsdom cannot evaluate is not judged either way: the sweep stops and names
 *  it, because „I could not tell" is not „nothing moves the box". */
function reaches(selector: string, shapes: HTMLElement[]): boolean {
  try {
    return shapes.some((one) => one.matches(selector))
  } catch {
    expect.fail(`this guard cannot tell whether ${selector} reaches the plate`)
  }
}

describe('the plate on the middle of its row', () => {
  it('takes the plate off the baseline its cell writes text on', () => {
    /* „Ceo taj boks treba spustiti dodatno par piksela." Said as the one declaration that does it,
       so the diff of a change to this row lands here and not only on a golden text.

       `middle` and not `top`, though both measured the same on all three screens today: they agree
       only for as long as the plate is the taller of the two, and the plate is the shorter one the
       moment a cell is given a line taller than a circle. `top` would then pin it to the top of the
       line, which is the fault this file exists for, spelled the other way round. */
    expect(ruleFor(readFileSync(PLATE, 'utf-8'), '.plate', 'NamePlate.css').getPropertyValue('vertical-align')).toBe(
      'middle',
    )
  })

  it('is still the inline box that sentence is about', () => {
    /* The floor under the case above, and it is not decoration: `vertical-align` says nothing at
       all about a box that is not inline-level, so the reading above would go on passing over a
       plate turned into a block with the declaration left behind meaning nothing.

       `inline-flex` is also what keeps the link around the plate one box. Measured in a browser on
       28.09.2026 with `display: flex` in its place: on the standing of a competition each anchor
       went from ONE client rect at its own width to THREE stretched across the whole 160px column,
       which is the shape a focus ring is drawn on (WCAG 2.2 SC 2.4.11). */
    expect(ruleFor(readFileSync(PLATE, 'utf-8'), '.plate', 'NamePlate.css').getPropertyValue('display')).toBe(
      'inline-flex',
    )
  })

  it('is moved up or down from one declaration in the whole portal and no other', () => {
    /* **The half that says CENTRED rather than MOVED.** A reading of one value falls when the
       plate is put back on the baseline and stays green when a margin under it pushes it past the
       middle the other way, and those are two different claims. This one is the second: of every
       rule in every stylesheet the portal ships, the ones that reach the plate itself carry
       exactly one declaration between them that moves it.

       Three questions, each handed to something that already answers it rather than to a pattern,
       which is the lesson `styles/leagueLayout.test.ts` was rewritten twice to learn:

       - **which sheets there are:** the file system.
       - **which rules each sheet has, wherever it is written:** the browser's own parser
         (`everyRule`, which reaches inside a media query as well, so a rule that moves the plate on
         telephones alone is in here too).
       - **which of them reach the plate:** the DOM (`matches`), not a reading of the selector text,
         and in both shapes the plate is ever drawn in. Four drafts of another guard on this portal
         died reading selectors as text.

       **The boundary, written rather than left for a review to find.** A rule can reach the plate
       through an ancestor this fixture does not have — `.rankings__table .plate` would be such a
       rule — and `matches` answers no for it. That hole is not new and not this file's to close:
       `styles/leagueLayout.test.ts` holds the list of every sheet outside the plate's own that
       names one of its classes at all, with a count, so a sheet beginning to reach in fails there
       first. What that file says it does NOT do is read what such a rule says, and that is exactly
       what is read here. */
    const shapes = everyShapeOfThePlate()

    const found = everySheet(SRC).flatMap((path) => {
      const sheet = named(path)

      return everyRule(readFileSync(path, 'utf-8'), sheet)
        .filter((rule) => reaches(rule.selectorText, shapes))
        .flatMap((rule) =>
          [...rule.style].flatMap((property) => {
            const decides = MOVES_THE_BOX.get(property)

            expect(
              decides,
              `${sheet} writes ${property} on ${rule.selectorText}, and nothing here says whether it moves the plate`,
            ).not.toBeUndefined()

            return decides === true
              ? [`${sheet}: ${rule.selectorText} { ${property}: ${rule.style.getPropertyValue(property)} }`]
              : []
          }),
        )
    })

    expect(found).toEqual(['components/NamePlate.css: .plate { vertical-align: middle }'])
  })
})
