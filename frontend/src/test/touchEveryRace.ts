import { screen } from '@testing-library/react'
import type { Pressing } from './user'

/**
 * Types one character into the name of every race of the open event, so that the save sends each of them.
 *
 * <p>The save sends only the races somebody changed (owner, 20.10.2026, ADL „Čuvanje događaja šalje samo
 * trke koje su promenjene"; `admin/raceRows.ts`, `isChanged`), so a case that is about WHAT A PRESS DOES
 * TO EVERY RACE OF AN EVENT THAT STANDS - how many writes it makes, what is held while they are out, what
 * waits when one is refused - has to change them first. Each race is named by its place in the table, as
 * the table names it.
 *
 * @returns how many races were touched, so a case can say how many writes the press makes
 */
export async function touchEveryRace(user: Pressing): Promise<number> {
  const names = screen.getAllByRole('textbox', { name: /^Trka, \d+\. trka$/ })

  for (const box of names) {
    await user.type(box, '!')
  }

  return names.length
}
