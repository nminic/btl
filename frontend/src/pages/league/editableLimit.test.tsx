import { screen, within } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { SLOW } from '../../test/slow'

/**
 * That each box of a competition is bounded by **its own** field.
 *
 * **Why this is a file of its own, and why it asks what it asks.** `EditableText` draws both the
 * terms and the prizes, and it read the cap off `rules` for both until 07.09.2026. A review
 * measured what that costs the day the two numbers part: with the prizes lowered to 500 in the
 * definition, the box on this screen let a moderator write three thousand characters, and the
 * administration form then told them their own text was too long. That is the very fault `limitOf`
 * exists to prevent, moved one screen along.
 *
 * **The definition gives both fields the same number today, and that is exactly the problem.** A
 * case that reads the attribute off the screen and compares it with `limitOf(liga, field)` passes
 * whichever field the component asks about, because both answers are 4000: one value with two
 * sources, which is a case that measures nothing (a mutation put `'rules'` back and it stayed
 * green).
 *
 * So the two sources are pulled apart where they are answered. `limitOf` is replaced by one that
 * gives each field a number of its own, and then the only way a box can carry the right number is
 * by having asked about itself. The precedent for standing in front of a shared module this way is
 * `pages/league/genderBlocks.test.ts`, which does it to prove where a value comes from rather than
 * what it is.
 */
vi.mock('../../forms/records', async (real) => ({
  ...(await real<typeof import('../../forms/records')>()),
  /* Two numbers that cannot be confused with each other or with anything in the definition, so a
     box carrying either one says which field it asked about. */
  limitOf: (_form: unknown, field: string) => (field === 'prizes' ? 137 : 4242),
}))

describe('the box that holds what an organiser writes about a competition', () => {
  it('is bounded by the field it draws, and not by the first of the two', async () => {
    const user = setupUser()

    renderAt('/sr/lige?sezona=2027', 'superadmin')

    const box = within(
      must(
        (await screen.findByRole('heading', { level: 2, name: /RunTrace liga/ })).closest('li'),
        'the box of the competition',
      ),
    )

    /* Since 17.10.2026 the box is the editor of a written text, which holds the limit by refusing
       what would pass it and counts the room down beside it, rather than by an attribute: so what is
       read is the room it says it has, which is the limit less what is already written. The served
       texts carry no marks of Markdown, so what is written is as long as what is drawn. */
    for (const [heading, limit] of [
      ['Propozicije', 4242],
      ['Nagrade', 137],
    ] as const) {
      const section = must(box.getByRole('heading', { name: heading }).closest('section'), 'section')

      await user.click(within(section).getByRole('button', { name: 'Izmeni' }))

      const typing = within(section).getByRole('textbox', { name: heading })
      const written = must(typing.textContent, 'the words in the box').length

      expect(written, 'the box holds the served text').toBeGreaterThan(0)
      expect(typing, `${heading} nosi granicu drugog polja`).toHaveAccessibleDescription(
        new RegExp(`^Još ${limit - written} znak`),
      )
    }
  }, SLOW)
})
