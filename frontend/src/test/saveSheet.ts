import { screen, within } from '@testing-library/react'
import type { Pressing } from './user'

/**
 * THE SHEET THAT ASKS „SAČUVATI DOGAĐAJ?" BEFORE A SAVE THAT TAKES THE RACES OF AN EVENT AWAY, answered from a test
 * (owner, 07.11.2026, PDL „I čuvanje događaja koje briše njegove trke radi isto"; `pages/admin/EntityEditor.tsx`,
 * `asksBeforeSaving`). It is the sheet of a deletion (`test/deleteSheet.ts`) with the words of a save, and it is found
 * the same way: by its question and not by its role alone.
 *
 * <p>The words are the Serbian ones, and the title is written out here and not read out of the dictionary, so a title
 * that moved would fail the cases that ask for it by name.
 */
export const THE_SAVE_ASKS = 'Sačuvati događaj?'

/** The sheet, found by its question. */
export async function theSaveSheet(): Promise<HTMLElement> {
  return screen.findByRole('dialog', { name: THE_SAVE_ASKS })
}

/** Says yes in the sheet: the press that sends the save. Returns the sheet, for what follows. */
export async function sayYesToTheSave(user: Pressing): Promise<HTMLElement> {
  const sheet = await theSaveSheet()

  await user.click(within(sheet).getByRole('button', { name: 'Sačuvaj' }))

  return sheet
}

/** Says no in the sheet: nothing is sent. */
export async function sayNoToTheSave(user: Pressing): Promise<void> {
  await user.click(within(await theSaveSheet()).getByRole('button', { name: 'Odustani' }))
}
