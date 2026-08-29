import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { within } from '@testing-library/react'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { bare } from '../test/sources'
import { unremarked } from '../test/stylesheet'

/**
 * The two halves of a race column heading, weighed over the heading the portal
 * really draws.
 *
 * A column of a competition grid is headed by one turned line holding two elements:
 * what the race is called, and when it was run with what it measured
 * (`pages/league/LeagueResults.tsx`). The line is capped and clipped, so on every
 * screen narrower than the label something is lost, and **which** of the two is lost
 * is the whole of the decision. It is written nowhere but in `League.css`, in three
 * rules, and until 29.08.2026 nothing measured any of them.
 *
 * **Three faults a review measured that day, every one of them with the whole gate
 * green:**
 *
 * - `.league__race-called` renamed in `League.css` alone. 2297 tests stayed green
 *   while Chrome on a 1280 screen cut „ km)" off ` 5. 8. 2022. (42,2 km)`, and on a
 *   360 both columns of „Šidski novogodišnji maraton" read alike again, which is the
 *   fault the whole change was made for.
 * - `white-space: pre` turned to `normal` on `.league__race-measure`. A flex item
 *   drops the whitespace at its own edges, so the heading came out
 *   „Mrazijada2019. (6,4 km)".
 * - `.league__race-called` left under its own name and merely narrowed, to
 *   `.league__grid tbody .league__race-called`. That is the tightening this sheet
 *   does at four other places, where it names `thead` or `tbody` to win an argument
 *   about specificity, with the wrong one of the two: the heading is in `thead`, so
 *   the rule reaches nothing at all. 2300 tests over 132 files stayed green, and in
 *   Chrome over the built sheet at 1280 the name wanted 155,86px inside a cap of
 *   144px while the visible measure was 0px, which is the whole label gone.
 *
 * **Why this file no longer reads the sheet as text.** Its first form did, and the
 * third fault above is what that cost: a selector rewritten rather than renamed
 * still ends on a compound carrying the class, so every text reader said yes while
 * the rule had stopped applying. A fourth fault of the same shape was measured
 * beside it, over the cap: with `max-inline-size` deleted from `.league__race-name`
 * and the `6.5rem` of the narrow query left standing, a reader folding both rules
 * into one map still found the property, 2300 tests stayed green, and the heading
 * grew from 144px to 282,27px on a 1280 screen, which is the growth the note beside
 * that very rule was written against.
 *
 * Whether a rule reaches an element and wins is a question about the cascade, and
 * jsdom computes it for the properties it knows. So it is asked of the cascade
 * instead, over the standing the portal really draws, with every sheet the portal
 * has laid over it in the worst order for the one being defended. Three rounds of
 * review on another change the same day settled that shape, and one thing they
 * measured is why the sheets are all of them rather than the ones this screen asks
 * for: nine rules in the built stylesheet reached one form control through an
 * ancestor, and every one of them outweighed the rule being defended.
 *
 * **What jsdom still cannot see, said plainly.** It applies no conditional group
 * rule, so `@media`, `@supports` and `@container` are invisible here and the portal
 * uses all three; and it lays nothing out, so nothing about where the cut actually
 * falls can be asked at all. Both were measured in Chrome over the built sheet, and
 * the numbers are written beside the markup that produced them
 * (`pages/league/LeagueResults.tsx`). The blindness to `@media` is what makes the
 * cap below answerable: the value that shows up is the one from the base rule, which
 * is exactly the one the fourth fault took away.
 *
 * **What is left of reading the source, and why any of it is left.** One question a
 * text reader answers exactly and the cascade cannot: a rule in this sheet dressing
 * a class the screen writes on nothing. Such a rule reaches no element, so no
 * computed style anywhere can report it, and it is the half of a rename that gets
 * left behind. That is the second case below, and it is the whole of what this file
 * still asks of the text.
 *
 * **Kept as a file rather than folded into the screen's own tests**, which draw the
 * same standing and would have spared it an address and a query. What is in the way
 * is the `<style>`: the sheets have to hang on the document while the cascade is
 * asked, and `pages/league/leagueResults.test.tsx` says in its own words why a
 * `finally` there cannot be relied on to take something down, since a case that times
 * out goes on running into the next one. Cases in that file ask whether something is
 * visible, and visibility is computed, so a sheet left hanging would be answering
 * them. Here the most a leak can reach is the case below it.
 */
/** Where the rules being defended live, spelt the way the glob below spells a path
 *  so the two can be compared. */
const OWN = join('src', 'pages', 'league', 'League.css')

const LEAGUE = readFileSync(join(process.cwd(), OWN), 'utf-8')
const SCREEN = readFileSync(join(process.cwd(), 'src', 'pages', 'league', 'LeagueResults.tsx'), 'utf-8')

/** The standing of a competition, which is the one screen these headings are drawn
 *  on. The same address `pages/league/leagueResults.test.tsx` and `pages/details.test.tsx`
 *  open it at. */
const RUN = '/sr/liga/brdska-2019/rezultati'

/**
 * Every stylesheet the portal has, in the worst possible order for `League.css`:
 * its own first and all the others after it, so a rule of the same weight anywhere
 * else has its best chance of taking a property away from it.
 *
 * Not the sheets `LeagueResults.tsx` asks for. A built stylesheet is one file and
 * the browser reads all of it, so a rule in a sheet this screen never imports still
 * meets these elements. The count that made that concrete is in the note at the top.
 */
function everySheetWorstCase(): string {
  const all = globSync('src/**/*.css')
  const others = all.filter((file) => file !== OWN)

  /* The filter really found it. Written another way round, or run where a path is
     spelt with the other slash, this would leave `League.css` in the tail as well
     and the sheet meant to be standing at its worst would be standing last. */
  expect(others.length, 'League.css is not among the sheets the portal has').toBe(all.length - 1)

  return [OWN, ...others]
    .map((file) => readFileSync(join(process.cwd(), file), 'utf-8'))
    .join('\n')
}

describe('the heading of a race column', () => {
  it('wears what the sheet gives it, over the markup the portal draws', async () => {
    const style = document.createElement('style')

    style.textContent = everySheetWorstCase()
    document.head.append(style)

    try {
      const { findAllByRole } = renderAt(RUN)
      /* The race columns and not the two that head the names and the totals: the
         label is on a `title`, because it is the only place the whole of it survives
         once the name has been cut, and those two carry none. Found that way rather
         than by class, so nothing here is a second home for a class name. */
      const heads = (await findAllByRole('columnheader')).filter(
        (head) => within(head).queryByTitle(/./) !== null,
      )

      expect(heads.length, 'the grid draws no race columns at all').toBeGreaterThan(0)

      for (const head of heads) {
        const box = within(head).getByTitle(/./)
        const halves = [...box.children]

        expect(halves.length, 'the heading is no longer two halves').toBe(2)

        const heading = getComputedStyle(box)
        const gives = getComputedStyle(must(halves[0], 'the half that may be cut'))
        const holds = getComputedStyle(must(halves[1], 'the half that may not'))

        /* The line itself: one flex row, capped, and clipping whatever overruns the
           cap. Without the row the two halves are two words and the precedence below
           decides nothing. */
        expect(heading.display, 'the heading is no longer a flex row').toBe('inline-flex')
        /* That there is a cap, and not how wide it is. The width belongs to the
           sheet alone and a number repeated here would be a second home for it; what
           this asks is what the fourth fault in the note above took away. `none` is
           what the property computes to with nothing declaring it, and `parseFloat`
           of that is not a number. */
        expect(
          Number.parseFloat(heading.maxInlineSize),
          'the heading is no longer capped',
        ).toBeGreaterThan(0)
        expect(heading.overflow, 'the heading no longer clips what overruns it').toBe('hidden')

        /* The half that gives way, and is allowed all the way down to nothing: a flex
           item will not shrink below its own content without that, and then the whole
           heading overruns the cap and the ellipsis never appears.

           The two that clip stand first because they are the two that answer when the
           rule reaches nothing at all: neither `hidden` nor `ellipsis` is what its
           property computes to with nothing declaring it, so the rule taken away from
           this element is reported here, in its own words. */
        expect(gives.overflow, 'the name no longer clips').toBe('hidden')
        expect(gives.textOverflow, 'the name loses its ellipsis').toBe('ellipsis')
        /* Zero as the sheet writes it, which jsdom normalises to `0px`, against the
           bare `0` it supplies where nothing declares the property. So this does
           answer when the declaration goes missing, and it answers through a
           difference in spelling rather than in width; measured by deleting that one
           line with the rest of the rule left standing. */
        expect(gives.minInlineSize, 'nothing lets the name below its own content').toBe('0px')
        /* Last, and alone it says nothing about the rule arriving: `1` is also what an
           item computes to with nothing declaring it. What it says is the half of the
           precedence whose other half is the measure below, where the declared value
           is not a default and a missing rule does show. */
        expect(Number(gives.flexShrink), 'the name no longer gives way').toBeGreaterThan(0)

        /* And the half that does not, which is what tells this column from its
           neighbour. Turn this one round and the browser serves the name first: two
           columns of one event reading alike, which is the fault of 29.08.2026 in its
           original form. */
        expect(Number(holds.flexShrink), 'the measure gives way like the name').toBe(0)
        /* The one space in front of the measure lives in the text and not in a
           margin, so that what the element says is exactly what the label says and
           the screen's own test may compare the two. A flex item drops the
           whitespace at its own edges. */
        expect(holds.whiteSpace, 'the space in front of the measure is dropped').toBe('pre')
      }
    } finally {
      /* Or every sheet the portal has is left hanging over the case below, and over
         anything added to this file after it. Why that is a risk this file may carry
         and the screen's own tests may not is in the note at the top. */
      style.remove()
    }
  })

  it('is named the same in the sheet and on the screen', () => {
    /* Both ways round, and neither against a list written here. A class the screen
       writes and the sheet has forgotten is a heading nothing dresses; a class the
       sheet styles and the screen no longer writes is a rule reaching nothing, which
       is the half of a rename that gets left behind and the one thing above this
       cannot see.

       No third copy of the names, which is what this comment used to claim while the
       case under it held them against four strings. Measured: a rename carried
       properly through both homes, which is the one change that ought to pass, failed
       with „the screen no longer writes the two halves", saying the opposite of what
       had happened. Two homes, asked whether they agree. */
    const dressed = [
      ...new Set(
        [...unremarked(LEAGUE).matchAll(/\.(league__race[\w-]*)/g)].map((found) => found[1] ?? ''),
      ),
    ]
    /* Comments blanked first: this screen explains itself at greater length than it
       draws, and the note over the heading names the sheet and the classes in it. */
    const written = [
      ...new Set(
        [...bare(SCREEN).matchAll(/className="([^"]*)"/g)]
          .flatMap((found) => (found[1] ?? '').split(/\s+/))
          .filter((one) => one.startsWith('league__race')),
      ),
    ]

    /* A floor, because two empty sets agree perfectly. Loose rather than the count
       there is today, which would be the list of names again in another shape and
       would have to be told about every rename: what has to be caught here is a
       reading that has stopped reading, and that one comes back with none or one. */
    expect(written.length, 'the screen has stopped writing these classes').toBeGreaterThan(1)

    for (const css of written) {
      expect(dressed, `the screen writes ${css}, which nothing in League.css dresses`).toContain(css)
    }

    for (const css of dressed) {
      expect(
        written,
        `League.css dresses .${css}, which the screen writes on nothing`,
      ).toContain(css)
    }
  })
})
