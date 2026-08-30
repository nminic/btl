import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { within } from '@testing-library/react'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { bare } from '../test/sources'
import { ruleFor, ruleInMedia, unremarked } from '../test/stylesheet'

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
 *   9rem (144px) while the visible measure was 0px, which is the whole label gone.
 *
 * **Why this file no longer reads the sheet as text.** Its first form did, and the
 * third fault above is what that cost: a selector rewritten rather than renamed
 * still ends on a compound carrying the class, so every text reader said yes while
 * the rule had stopped applying. A fourth fault of the same shape was measured
 * beside it, over the cap: with `max-inline-size` deleted from `.league__race-name`
 * and the `6.5rem` of the narrow query left standing, a reader folding both rules
 * into one map still found the property, 2300 tests stayed green, and the heading
 * grew from 9rem (144px) to 243,11px on a 1280 screen, which is the growth the note
 * beside that very rule was written against.
 *
 * That last figure was written 282,27px until 30.08.2026 and no heading was ever
 * that. The two states this file describes as uncapped, the declaration deleted and
 * the `9rem` rewritten `90rem`, are one state at 1280: a cap of 1440px binds nothing
 * either. Measured in Chrome over both of them, to the same hundredth of a pixel,
 * „Šidski novogodišnji maraton 2019. (32,4 km)" came to 243,11px with 155,86px of
 * name inside it, and the tallest heading of the fourteen to 249,20px. 243,11 is the
 * one the sentence below already carried and the one that belongs here.
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
 * (`pages/league/LeagueResults.tsx`).
 *
 * **That blindness is a debt as well as a gift, and only the gift was written down
 * here until 29.08.2026.** The gift is the cap below: what shows up on the element is
 * the value of the base rule, which is exactly the one the fourth fault took away,
 * and with that declaration deleted the property comes back `none`, measured. The
 * debt is the other cap. The narrow query sets `max-inline-size: 6.5rem` on the same
 * element, and no case that asks the cascade can reach it: jsdom applies no
 * conditional group rule, so that declaration is invisible to every computed style
 * here. Deleted, this file stayed green until 30.08.2026, the screen's own tests
 * stayed green and so did the whole suite, 2300 tests over 132 files, while Chrome at
 * 360 grows the heading from 6.5rem (104px) to 9rem (144px) and the row of headings
 * with it, from 121,36px to 161,36px.
 *
 * **What holds it since 30.08.2026 is the third case, and it holds the writing and
 * not the width.** That case reads both caps out of the sheet through the parser, the
 * narrow one from inside its query, and holds them against the places the screen
 * gives the same two caps in words. So the declaration cannot be deleted, moved out
 * of that query or given another value without something failing. What is still held
 * nowhere is what it **does**: no case here can put a query into effect, nothing lays
 * anything out, and the 104 and the 144 pixels above are the browser's answer and not
 * this suite's. That is the boundary of this file, said here rather than left to be
 * worked out from „the value that shows up is the base one": the cap of the wide
 * screen is weighed as a property on an element, both caps are weighed as writing,
 * and neither of them is weighed as a width.
 *
 * **What is left of reading the source, and why any of it is left.** Two questions a
 * text reader answers exactly and the cascade cannot, one in each direction, and the
 * second case below asks both. The first is a rule in this sheet naming a class the
 * screen writes on nothing: it reaches no element, so no computed style anywhere can
 * report it. The second is the other way round, a class the screen writes that the
 * sheet never names.
 *
 * **That second direction was taken away on 29.08.2026 and is back since
 * 30.08.2026,** because what was wrong with it was its sentence and not its reading.
 * It failed saying „the screen writes X, which nothing in `League.css` dresses", and
 * the only evidence under that was that the name does not occur in the text of the
 * sheet. No text reader can close the gap between those two: a rule may carry the
 * name, declare nothing, and lose every argument it is in. So it now fails saying
 * what it has actually looked at, that `League.css` never names the class, which is a
 * fact about the source and is checkable exactly.
 *
 * **Why the case above does not answer it, measured.** That case finds the heading and
 * its two halves by what the screen draws and asks the cascade what each is wearing,
 * so an element the sheet has forgotten **entirely** arrives there as properties back
 * at their defaults. It cannot do the same for a class **added to an element that
 * already exists**: nothing new is drawn, and every property it asks about is still
 * declared by the class that stayed. Nor does it reach a property it is not asked
 * about. Of the nine declarations `.league__race-name` carries it asks three,
 * `display`, `max-inline-size` and `overflow`; the fourth property it asks of that
 * element, `flex-direction`, the rule does not declare at all. On the cell it asks
 * three of the five. So `writing-mode`, `transform`, `font-size`, `color`,
 * `text-transform` and `letter-spacing` are asked by nothing here.
 *
 * Both of those were measured on 30.08.2026, with this direction taken out for the
 * measurement. A rule split half way: `league__race-turn` added to the markup beside
 * `league__race-name`, `writing-mode` and `transform` taken out of that rule as though
 * they had moved, and no rule written for the new class. **132 files and 2301 tests
 * green,** while every heading in the grid stood up straight and the widest
 * competition went back to forty six flat labels across the top, which is the one
 * thing this heading exists to prevent. Narrower and of the same shape: a bare
 * `league__race-name--tall` on that element and nothing touched anywhere else, and
 * the fourteen other cases of this file and of `pages/league/leagueResults.test.tsx`
 * stayed green. With the direction restored the first fails naming
 * `league__race-turn` and the second naming `league__race-name--tall`.
 *
 * **What it does not prove, said as plainly as what it does.** That the name occurs
 * in the sheet is all of it. A rule carrying the class may declare nothing, may be
 * outweighed by everything it meets, may sit behind a query that never matches, and
 * all three pass here. Which rule wins on which property is the cascade's question
 * and the case above asks it, for the properties it names and no others. Between the
 * two of them the six declarations of `.league__race-name` listed above are still
 * held by nothing, and that is written here rather than left to be counted.
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

/** Where the portal sizes the text everything else is measured against, for the
 *  third case below. */
const ROOT = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf-8')

/**
 * And this file, whose own prose gives the caps in both units too, and where a figure
 * in pixels that nothing reads is the very fault the third case was written for.
 *
 * Read for the arithmetic alone. Which caps there **are** is asked of the screen,
 * because the sentences here also record what the cap was on a day when it was
 * something else, and holding those against today's sheet would fail every time a cap
 * legitimately moved.
 */
const HERE = readFileSync(join(process.cwd(), 'src', 'styles', 'raceHeadingHalves.test.ts'), 'utf-8')

/** The standing of a competition, which is the one screen these headings are drawn
 *  on. The same address `pages/league/leagueResults.test.tsx` and `pages/details.test.tsx`
 *  open it at. */
const RUN = '/sr/liga/brdska-2019/rezultati'

/**
 * What a `rem` is worth to a reader who has not touched the text.
 *
 * The browser's own default and not a fact about this portal, which is why nothing
 * here reads it out of the repository: there is nowhere to read it from. What the
 * portal decides is the line beside it, `font-size: 100%` on the root, which is the
 * decision to leave that default alone; the case below refuses any other value, and
 * without that line this multiplication would be arithmetic about nothing.
 *
 * Named the same and used the same way in `styles/tableWidths.test.ts`, where the
 * sums of a table's columns are counted in it.
 */
const ROOT_TEXT = 16

/** The query the sheet narrows these headings in, spelt the way a parser answers
 *  with it rather than the way it is typed. */
const NARROW = '(max-width: 699.98px)'

/**
 * Every place a cap is given in both units at once: the value as the sheet writes
 * it, and the pixels it comes to in brackets straight after.
 *
 * One spelling and no other, so that a figure in pixels is never written where
 * nothing can find it. Said in words rather than shown, because an example written
 * here would be a pair like any other to the reader below and would be held to the
 * same arithmetic, which is harmless and says nothing.
 *
 * Both files are read whole rather than through `bare`, because all of this is
 * prose. The caps are explained in comments, which is the only place either file
 * says anything about pixels at all.
 */
const CAPS = /([\d.]+)rem \((\d+(?:,\d+)?)px\)/g

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
     spelt with the other slash, `League.css` would stand in the tail as well, and
     nowhere near the end of it: measured, `globSync` comes back with this sheet
     sixteen files in and twenty eight behind it, so the second copy would take back
     every property the sixteen in front of it had won and lose only to the twenty
     eight after. The sheet meant to be standing at its worst would be standing
     better than it does on the screen, which is the direction that hides a fault
     rather than inventing one. */
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

      /* How wide the cap is, taken from the one other place the portal already
         writes it down: the note beside the markup. Read once, because it is a fact
         about the sheet and the screen's note rather than about one column.

         Exactly one sentence may say it, or what follows would be holding the sheet
         against one of two claims that are free to disagree with each other. */
      const capped = [...SCREEN.matchAll(/capped\s+at\s+([\d.]+rem)\b/g)]

      expect(
        capped.length,
        'the screen does not say in exactly one place what the heading is capped at',
      ).toBe(1)

      const cap = must(capped[0], 'what the screen says the cap is')[1] ?? ''

      for (const head of heads) {
        const box = within(head).getByTitle(/./)
        const halves = [...box.children]

        expect(halves.length, 'the heading is no longer two halves').toBe(2)

        const cell = getComputedStyle(head)
        const heading = getComputedStyle(box)
        const gives = getComputedStyle(must(halves[0], 'the half that may be cut'))
        const holds = getComputedStyle(must(halves[1], 'the half that may not'))

        /* The cell the turned heading stands in, and the one rule of this sheet that
           has to win an argument before it reaches anything at all:
           `.league__grid thead th.league__race` against the shared `.table th`. It is
           the fourth of the four classes here, and until 29.08.2026 nothing asked
           anything of it. Written `tbody` for `thead`, which is the shape of the
           third fault in the note above, the rule reaches no element and the heading
           falls back on the shared one: measured, `bottom` becomes `top`, `400`
           becomes `700`, and `center` becomes `left` on the first race column and
           `right` on the other thirteen.

           The note over that rule in `League.css` records three symptoms measured on
           13.08.2026, and two of the three are the first two above. The third is the
           padding, and it cannot be asked here: both rules write it in custom
           properties, jsdom substitutes none of them, and the property comes back `0`
           either way. Chrome has it going from `6px 2px` to `10px 8px`, and Chrome is
           the only place that says so.

           The alignment is not in that note at all. It is the same failure and it is
           written down inside the rule instead, over the declaration itself and with
           no date on it, which is why it is worth saying here which of the two homes
           each of these three comes from.

           None of the three is what its property computes to with nothing declaring
           it: bare, the cell is `middle`, `bold` and the empty string. So each of
           them answers on its own when the rule stops arriving. */
        expect(cell.verticalAlign, 'the heading is no longer read from the foot of its cell').toBe(
          'bottom',
        )
        expect(cell.fontWeight, 'the turned heading is dressed as a heading again').toBe('400')
        expect(cell.textAlign, 'the turned heading no longer stands in the middle of its column').toBe(
          'center',
        )

        /* The line itself: one flex row, capped, and clipping whatever overruns the
           cap. Without the row the two halves are two words and the precedence below
           decides nothing. */
        expect(heading.display, 'the heading is no longer a flex row').toBe('inline-flex')
        /* The cap at the width it is meant to be, which is not what stood here until
           29.08.2026: „greater than nought" is walked straight through by writing
           `9rem` as `90rem`, and that mutation kept the whole suite green while Chrome
           at 1280 grew the heading from 144px to 243,11px and the name inside it to
           155,86px, the very number the note above records as the fault itself.

           The width is still not written in this file. It is read out of the screen's
           own note, which is where it had been written down a second time and where
           nothing was holding it against the sheet: from here the sheet, the cascade
           and that note are one fact, and a cap changed in either home alone fails
           rather than drifting. It answers the fourth fault too, since `none` is what
           the property computes to with nothing declaring it. */
        expect(heading.maxInlineSize, 'the heading is not capped where the screen says it is').toBe(
          cap,
        )
        expect(heading.overflow, 'the heading no longer clips what overruns it').toBe('hidden')
        /* Which half a reader meets first, which the order of the two elements does
           not decide: inside a flex row that is `flex-direction` and `order`, and the
           case in `pages/league/leagueResults.test.tsx` that holds the order reads the
           children of the box. `flex-direction: row-reverse` on this rule turned all
           fourteen headings round against their own `title` with the suite green.

           `row` and `0` are also what the two compute to with nothing declaring them,
           so on their own they say nothing about a rule arriving; the properties above
           and below say that. What these say is that nothing has turned the line
           round, and that is the half the order of the elements cannot say. */
        expect(heading.flexDirection, 'the two halves are served the other way round').toBe('row')
        expect(gives.order, 'the name has been moved out of its place in the line').toBe('0')
        expect(holds.order, 'the measure has been moved out of its place in the line').toBe('0')

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
    /* Both ways round, and not against a list written here.

       A class the sheet styles and the screen no longer writes is a rule reaching
       nothing, which is the half of a rename that gets left behind and one of the two
       things the case above cannot see: the rule dresses no element, so no computed
       style anywhere reports it.

       A class the screen writes and the sheet never names is the other half of the
       same rename, and the case above misses it for a different reason: nothing new
       is drawn, so it finds the same elements wearing the same properties it asks
       about, and every property it does not ask about is where the fault sits. That
       direction stood here until 29.08.2026 and was taken away because its sentence
       claimed more than its evidence: „nothing dresses this class" is about the
       cascade, and all it had looked at was the text. Back since 30.08.2026 with the
       sentence its evidence carries, which is that the sheet never names the class at
       all. The note at the top says what each of the two proves and what neither of
       them does.

       No third copy of the names, which is what this comment used to claim while the
       case under it held them against four strings. Measured: a rename carried
       properly through both homes, which is the one change that ought to pass, failed
       with „the screen no longer writes the two halves", saying the opposite of what
       had happened. Two homes, and the one question of the two that the text of a
       sheet can actually answer. */
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

    /* A floor on each side, because two empty sets agree perfectly. On the sheet
       because the loop below runs over it and a reader that has stopped reading would
       pass over nothing at all; on the screen because the same failure there would
       fail the loop instead, which is a false alarm rather than a false pass and is
       still worth naming where it happens. Loose rather than the count there is
       today, which would be the list of names again in another shape and would have
       to be told about every rename. */
    expect(dressed.length, 'nothing in League.css is read as dressing these classes').toBeGreaterThan(
      1,
    )
    expect(written.length, 'the screen has stopped writing these classes').toBeGreaterThan(1)

    for (const css of dressed) {
      expect(
        written,
        `League.css dresses .${css}, which the screen writes on nothing`,
      ).toContain(css)
    }

    /* And the other way, whose failure says only what has been looked at. Not „nothing
       dresses this class", which is the cascade's answer and not a text reader's: a
       rule may carry the name, declare nothing and lose every argument it is in, and
       all three pass here. */
    for (const css of written) {
      expect(dressed, `the screen writes .${css}, and League.css never names it`).toContain(css)
    }
  })

  it('gives the caps in pixels the sheet and the root make them', () => {
    /* Every `:root` rule of the portal's own sheet, and not the first. `100%` there is
       the decision to leave the reader's text size alone, and it is the whole of what
       makes the pixels below derivable at all: put to `112.5%`, every `rem` on the
       portal is eighteen pixels and both figures in the prose are wrong by an eighth
       while every other case in this file stays green.

       Every rule rather than the first, because a second `:root` written later is the
       one that wins. `styles/tableWidths.test.ts` holds the same line for the sums of
       a table's columns, and its note records that a second rule appended to the file
       took every one of those sums out by an eighth with ten cases green. */
    const rootSizes = [
      ...unremarked(ROOT).matchAll(/:root[^{]*\{[^}]*?font-size:\s*([^;]+);/g),
    ].map((one) => (one[1] ?? '').trim())

    expect(rootSizes.length, 'nothing in index.css gives the root a size').toBeGreaterThan(0)
    expect(rootSizes.filter((size) => size !== '100%')).toEqual([])

    /* The two caps, asked of the parser rather than of the text (ADL A18). The narrow
       one from inside its own query and named by that query, so a cap moved to another
       width fails here rather than being found under a condition nobody asked about. */
    const wide = ruleFor(LEAGUE, '.league__race-name', 'League.css').maxInlineSize
    const narrow = ruleInMedia(LEAGUE, NARROW, '.league__race-name', 'League.css').maxInlineSize

    /* Each of the two really found, and said before the two are compared with the
       screen. A rule left standing with the cap taken out of it answers with the empty
       string, and without these the comparison below fails naming the screen for
       something the sheet did: measured on 30.08.2026, deleting the narrow cap failed
       with „the screen no longer gives both of the sheet caps", which is the wrong
       file and the wrong half of the change. */
    expect(wide, 'League.css no longer caps .league__race-name').not.toBe('')
    expect(narrow, `League.css no longer caps .league__race-name inside ${NARROW}`).not.toBe('')

    /* Which caps the prose speaks of is asked of the screen alone. Its note describes
       the heading as it stands, so the set of caps in it is the set in the sheet: a
       cap given twice is not counted twice, and a cap given nowhere fails.

       Not of this file, which records what the cap **used to be** as well. Three of
       the sentences above name `9rem` inside a measurement from a day when it was
       `9rem`, and a cap moved to `8rem` for a good reason would fail on all three
       while saying that the prose had gone wrong. The arithmetic below still holds
       them, because that is the half of the claim which stays true however the cap
       moves. */
    const given = [...`${SCREEN}\n${HERE}`.matchAll(CAPS)]
    const said = [...new Set([...SCREEN.matchAll(CAPS)].map((one) => `${one[1] ?? ''}rem`))].sort()

    expect(said, 'the screen no longer gives both of the sheet caps in both units').toEqual(
      [wide, narrow].sort(),
    )

    for (const one of given) {
      const rem = Number(one[1] ?? '')
      const pixels = Number((one[2] ?? '').replace(',', '.'))

      expect(pixels, `${one[0]} is not what that many rem come to at the root size`).toBeCloseTo(
        rem * ROOT_TEXT,
        2,
      )
    }
  })
})
