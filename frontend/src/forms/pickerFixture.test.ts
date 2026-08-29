import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { first, htmlElement, must } from '../test/at'
import { chainToShell, markupOf, nameOf } from '../test/chain'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

/**
 * The chain the calendar button really stands in, held against the one the browser
 * check writes out by hand.
 *
 * `scripts/refused-control-appearance.mjs` measures whether a refused control still
 * looks refused, and it measures it over markup of its own, because it cannot render
 * the portal. That markup is a fact with two homes, and on the other control it drifted
 * twice: a rule keyed on an ancestor the fixture is missing beats the refusal on
 * specificity alone, and the measurement then says the refusal holds when what holds is
 * a fixture nobody draws. `entityStyle.test.ts` has held that chain since; this holds
 * the second one, which arrived on 29.08.2026 with the calendar button.
 *
 * **What this does not hold.** Whether the refusal wins, which is the browser's
 * question and is asked there. And every attribute of the box in front of the button:
 * its `value` is written by React as a property and only sometimes as an attribute, so
 * a comparison of attribute names would be a comparison of React's internals. Its
 * classes are compared, because that is the drift the portal already has coming: a date
 * locked by a chosen race carries `aria-disabled` and `readOnly` and no class at all,
 * and `btl-produkt/PENDING.md` records the change that gives it one.
 */
const ME = '000007'
/** A day inside the data, so the list of races is the same list every time this runs
 *  rather than the same list until the calendar catches up (`newResult.test.tsx`). */
const TODAY = '2026-08-23'

/** The classes of an element, in an order neither document chose. */
function classesOf(one: Element): string {
  return [...one.classList].sort().join(' ')
}

/** The calendar button of the date field, and not the one in the shell: the day the
 *  portal is read as is switched from a date field of its own (`clock/DateSwitch.tsx`),
 *  so „Otvori kalendar" names two controls on this screen and only one of them is ever
 *  refused. */
function opener(): HTMLElement {
  const field = must(screen.getByLabelText(/^Datum/).closest('.field'), 'the date field')

  return within(htmlElement(field)).getByRole('button', { name: 'Otvori kalendar' })
}

describe('the calendar button a browser measures', () => {
  it('is measured over the chain the portal draws around it', async () => {
    const script = readFileSync(
      join(process.cwd(), 'scripts/refused-control-appearance.mjs'),
      'utf-8',
    )
    const holder = document.createElement('div')

    holder.innerHTML = markupOf(script, 'LOCKED_DATE')

    const user = setupUser()

    renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, TODAY)

    /* The live one before the race is chosen and the refused one after, out of the same
       screen: this form has one date field, and the fixture stands them side by side
       because a difference needs two controls the same sheet reaches the same way. */
    await screen.findByLabelText(/^Naziv trke/)

    const free = nameOf(opener(), false)

    await user.type(screen.getByLabelText(/^Naziv trke/), 'beogradski maraton')
    await user.click(first(within(screen.getByRole('list', { name: '' })).getAllByRole('button')))

    const held = opener()

    /* The screen this is read off is the one the fixture says it is. Without it a form
       that stopped locking the date would be compared control for control and agree
       about everything, having nothing refused in it at all. */
    expect(held, 'the date this form filled in is not refused').toHaveAttribute(
      'aria-disabled',
      'true',
    )

    const inFixture = chainToShell(
      must(holder.querySelector('#refused'), 'the refused control in the fixture'),
    )
    const onScreen = chainToShell(held)

    /* Both have to get there, or two chains that stop early could agree about nothing. */
    expect(inFixture.at(-1), 'the fixture does not reach the shell').toContain('div.shell')
    expect(onScreen.at(-1), 'the screen does not reach the shell').toContain('div.shell')
    expect(inFixture).toEqual(onScreen)

    /* And the live twin, which the walk above never reaches because it walks upward from
       the refused one. `DatePicker.tsx` writes no `aria-disabled` at all where the price
       list writes `false`, and an attribute selector weighs as much as a class, so a
       fixture that wrote one would be measuring a button the portal has not got. */
    expect(nameOf(must(holder.querySelector('#live'), 'the live control in the fixture'), false)).toBe(
      free,
    )

    /* The box in front of the button, by its classes: it is what `.datepicker
       .field__control` is written for, and the dress of a held control is what it is
       expected to gain. */
    expect(
      classesOf(must(holder.querySelector('#date-held'), 'the held box in the fixture')),
    ).toBe(classesOf(screen.getByLabelText(/^Datum/)))

    /* Above the shell the two documents cannot agree and should not be asked to: under
       test the app is mounted in a container of the test library's own. What the fixture
       puts there is held against `index.html` by `entityStyle.test.ts`, for the other
       fixture of this same script, so here the two fixtures are held against each other
       and the mount point has one home for both. */
    const above = (one: string) =>
      nameOf(
        must(
          must(holder.querySelector('.shell'), `the shell in ${one}`).parentElement,
          `what ${one} puts above the shell`,
        ),
        true,
      )
    const mine = above('this fixture')

    holder.innerHTML = markupOf(script, 'PRICE_LIST')

    expect(mine).toBe(above('the other fixture'))
    expect(mine).toContain('#root')
  })
})
