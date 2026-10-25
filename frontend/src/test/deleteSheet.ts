import { screen, within } from '@testing-library/react'
import type { Pressing } from './user'

/**
 * THE SHEET THAT ASKS „OBRIŠI X?" BEFORE A ROW OF THE ADMINISTRATION IS TAKEN AWAY (owner, 23.10.2026,
 * `pages/admin/DeleteSheet.tsx`), answered from a test.
 *
 * <p>Asked by its question and not by its role alone, so a case that opens the sheet of one screen and
 * finds the sheet of another says so by name. The question is the screen's own words (`admin.teamDeleteAsk`
 * and the three beside it), written out by the case that asks.
 */
export async function theSheet(title: string): Promise<HTMLElement> {
  return screen.findByRole('dialog', { name: title })
}

/** Says yes in the sheet: the press that sends the deletion. Returns the sheet, for what follows. */
export async function sayYes(user: Pressing, title: string): Promise<HTMLElement> {
  const sheet = await theSheet(title)

  await user.click(within(sheet).getByRole('button', { name: 'Obriši' }))

  return sheet
}

/** Says no in the sheet. */
export async function sayNo(user: Pressing, title: string): Promise<void> {
  await user.click(within(await theSheet(title)).getByRole('button', { name: 'Odustani' }))
}
