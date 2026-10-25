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
 * - `banknote`: Upiši uplatu, since 22.10.2026 in place of the plus (owner: „Može li
 *   simbol za to umesto znaka plus da bude kao novčanice").
 * - `envelope`: Pošalji novu pozivnicu, on the member's row (owner, 25.10.2026, PDL „Nova
 *   pozivnica od administracije i rečenica o trkama: odgovori od 25.10.2026": „simbol koverte").
 * - The shield with a check that „Odobri oslobođenje" carried from 20.10.2026 is gone
 *   with the button: since 22.10.2026 the exemption is granted by ticking the season
 *   in the member's row (PDL, „Red na ekranu članova ima pet kolona").
 */
export const SYMBOL = {
  pencil: 'pencil',
  cross: 'cross',
  copy: 'copy',
  check: 'check',
  back: 'back',
  undo: 'undo',
  banknote: 'banknote',
  down: 'down',
  up: 'up',
  again: 'again',
  envelope: 'envelope',
} as const

export type ActionSymbol = (typeof SYMBOL)[keyof typeof SYMBOL]
