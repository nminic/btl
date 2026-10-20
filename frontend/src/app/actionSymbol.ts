/**
 * THE SYMBOLS A BUTTON THAT ACTS ON ONE THING CARRIES INSTEAD OF A WORD (owner,
 * 20.10.2026: „nego da budu simboli nalik krstiću, olovci, dva dokumenta i sl.").
 * Which symbol stands for which word the owner chose the same day from the ones
 * offered to him, and the list below is that choice (PDL, „Mapa simbola").
 *
 * A closed set, and every screen names a member of it through this object rather
 * than by a string of its own, so the set is one thing the compiler holds and not
 * eleven spellings scattered through the screens. They are drawn in `app/icons.tsx`
 * (`ActionSymbolIcon`); the names live here, in a module of their own, so that the
 * file of drawings exports drawings only and the editor can refresh it in place. Which word of the dictionary
 * carries which of them is held over the whole portal by
 * `components/actionSymbols.test.ts`.
 *
 * - `pencil`: Izmeni, Izmena, Otvori, Ispravi, and changing the rules and the
 *   prizes of a competition.
 * - `cross`: Obriši, Brisanje, Izbaci, clearing the photograph in a form,
 *   deleting a comment, refusing an invitation or a request to join a team.
 * - `copy`: two documents, for Kopiranje and for the button that copies a value.
 * - `check`: Odobri, Aktiviraj, Prihvati, Primi u tim.
 * - `back`: Odbij in a queue of things to check, which sends it back to the member
 *   with a reason, and Povuci poziv.
 * - `undo`: Storniraj.
 * - `plus`: Upiši uplatu.
 * - `down` and `up`: Prikaži and Sakrij a card.
 * - `again`: Ispravi i pošalji ponovo.
 * - `shieldCheck`: Odobri oslobođenje, a shield and not a bare check so it is not
 *   mistaken for the other checks in the member's row (owner, 20.10.2026, against
 *   the recommendation of a check).
 */
export const SYMBOL = {
  pencil: 'pencil',
  cross: 'cross',
  copy: 'copy',
  check: 'check',
  back: 'back',
  undo: 'undo',
  plus: 'plus',
  down: 'down',
  up: 'up',
  again: 'again',
  shieldCheck: 'shieldCheck',
} as const

export type ActionSymbol = (typeof SYMBOL)[keyof typeof SYMBOL]
