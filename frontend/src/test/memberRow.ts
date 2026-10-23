import { screen, within } from '@testing-library/react'
import { must } from './at'
import type { setupUser } from './user'

/**
 * THE ROW OF THE MODERATION OF THE MEMBERS AS A CASE MEETS IT (`pages/admin/MemberRow.tsx`), in one home
 * for the files that press on it.
 *
 * Every query is by role and by name. Two things about the row are said here once:
 *
 * - **The list of seasons is drawn twice**, under the name for a telephone and as a column from 700px;
 *   the stylesheet shows one of them, and jsdom lays nothing out, so both are in the document. The two are
 *   the same component, so a case presses the first; `geometry/membersTable.geometry.ts` asks Chrome
 *   which one is shown at which width.
 * - **A sheet stands inside the row's last cell**, so the button that opened it and the sheet's own may
 *   carry the same words („Upiši uplatu"). A case reads the sheet through its dialog.
 */
type User = ReturnType<typeof setupUser>

/** The row of one member, found by the number drawn under the name. */
export async function memberRowOf(memberNumber: string): Promise<HTMLElement> {
  const table = await screen.findByRole('table', { name: 'Članovi' })

  return must(within(table).getByText(memberNumber).closest('tr'), `the row of ${memberNumber}`)
}

/** Opens the list of seasons of a row, if it is not open, and hands back the list. */
export async function seasonsOf(user: User, row: HTMLElement): Promise<HTMLElement> {
  const toggle = must(within(row).getAllByRole('button', { name: /^Sezone, / })[0], 'the list of seasons')

  if (toggle.getAttribute('aria-expanded') !== 'true') {
    await user.click(toggle)
  }

  return must(document.getElementById(must(toggle.getAttribute('aria-controls'), 'its list')), 'the list')
}

/** The box of one season in a row's list, the list opened first. */
export async function seasonBox(user: User, row: HTMLElement, season: number): Promise<HTMLElement> {
  return within(await seasonsOf(user, row)).getByRole('checkbox', { name: String(season) })
}

/** Presses „Upiši uplatu" on a row and hands back the sheet it opens. */
export async function paymentSheet(user: User, row: HTMLElement): Promise<HTMLElement> {
  await user.click(within(row).getByRole('button', { name: 'Upiši uplatu' }))

  return screen.findByRole('dialog', { name: 'Upiši uplatu' })
}

/** Types an amount into the sheet of a payment and presses its „Upiši uplatu". */
export async function recordInTheSheet(user: User, sheet: HTMLElement, amount: string): Promise<void> {
  await user.type(within(sheet).getByLabelText(/^Uplaćeno/), amount)
  await user.click(within(sheet).getByRole('button', { name: 'Upiši uplatu' }))
}
