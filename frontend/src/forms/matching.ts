import { everyOneNamedExactly } from './exactName'
import type { Suggestion } from './types'

/*
 * WHAT A BOX TYPED AGAINST A LIST OFFERS FOR WHAT HAS BEEN TYPED (`Suggesting.tsx`). Moved here out of that box
 * unchanged on 23.11.2026, when the box of a member on a row of results came to read it as well; that box stopped
 * reading it the same day, when the owner said of it „Ovde nema dropdown-a" (PDL „Tri brze izmene
 * administracije"), and offers by a rule of its own since (`pages/event/memberList.ts`). The two rules here are
 * decisions about races and events, not about members.
 */

/** How many letters before the list opens (owner, 23.08.2026: „posle dva slova
 *  treba da krene autocomplete"). */
const FROM_LETTERS = 2

/**
 * How many entries stand at once, of those the box only partly names.
 *
 * The list is a list of buttons and every one of them is a stop on the way
 * through the form with a keyboard, so an unbounded list is a form somebody has
 * to tab through a hundred times to reach the next field. Eight of them stand in
 * about twenty rem, which is what the fields under the box move down by while it
 * is open; the list is the newest eight, so typing a third letter is how the older
 * ones are reached.
 *
 * **Except the entries the box names exactly, which all stand, however many.** Owner,
 * 22.10.2026 (PDL „Predlozi događaja pri upisu rezultata: ime pa godina”, chosen between the
 * outcomes offered): „Kad otkucano ime ima više izdanja, nudi se spisak SVIH godina tog imena
 * i moderator bira godinu; nijedno izdanje nije nedostižno”. A name of many editions showed its
 * newest eight, and no third letter reached the older ones, since every one of them is that same
 * name: typed out whole, it now offers every edition, each with its day, which is how one year is
 * told from another. „Sva izdanja u jednom spisku bez granice od 8” was refused, so a name only
 * partly typed keeps the eight.
 */
const AT_MOST = 8

/**
 * What is offered for what has been typed.
 *
 * Case is folded on both sides, because somebody typing a race name types it the
 * way they say it and not the way it was entered. The order is the order it was
 * handed in, which is by date, newest first (owner).
 */
export function matching(value: string, all: readonly Suggestion[]): Suggestion[] {
  const asked = value.trim().toLocaleLowerCase()

  if (asked.length < FROM_LETTERS) {
    return []
  }

  /* The ones named exactly are each kept, and the others fill what is left of the eight, all in the order
     handed in. */
  const named = new Set(everyOneNamedExactly(all, asked))
  let room = AT_MOST - named.size

  return all.filter((one) => {
    if (named.has(one)) {
      return true
    }

    if (room > 0 && one.value.toLocaleLowerCase().includes(asked)) {
      room -= 1

      return true
    }

    return false
  })
}
