import { useEffect, useState } from 'react'
import { loadResource } from './client'

/**
 * A town, as the codebook holds it: its GeoNames mark, the name in this
 * region's languages, the country it is in, and the English name where the town
 * has one of its own.
 *
 * A tuple rather than an object because there are forty seven thousand of them
 * and the field names would outweigh the data. Built by
 * `btl-produkt/istorijski-podaci/napravi-mesta.py` out of the GeoNames export
 * (CC BY 4.0), and then labelled by `oznaci-istoimena-mesta.py` beside it, which
 * gives towns that were called alike the nearest bigger town in brackets.
 *
 * The mark comes first because it is what the town **is** (owner, 08.09.2026,
 * ADL A16). Name and country tell towns apart in this codebook since 02.10.2026,
 * when towns that were called alike were given the nearest bigger town in
 * brackets (owner, PDL "Odluke iz ciscenja nalaza (02.10.2026, vlasnik)"), but
 * a label moves when GeoNames does, and a name is what the town is called today
 * and not what it is. The mark is a GeoNames identifier and the same number the
 * database keeps in `place.geonames_id`, so a town written down anywhere still
 * means that town after the codebook is rebuilt.
 */
export type Place = [geonames: number, name: string, country: string, english?: string]

/** How the town is written on a page in this language. English where the town
 *  has an English name of its own, the local name everywhere else (owner,
 *  11.08.2026): Belgrade on the English portal, Beograd on the Serbian one, and
 *  Novi Sad on both, because Novi Sad is not called anything else. */
export function placeName(place: Place, locale: string): string {
  return locale === 'en' ? (place[3] ?? place[1]) : place[1]
}

/**
 * The letters of a word as they are typed, without the marks above them.
 *
 * Somebody entering a race in Užice types "uzice", because the keyboard in
 * front of them is the one they have. Splitting a letter into a letter and its
 * mark (NFD) and dropping the marks makes both spellings the same word. Đ and Ø
 * have no such split and are written out; the same two are written out in the
 * generator, so the two sides agree.
 */
/**
 * Letters that are single letters rather than a letter and a mark above it, so
 * splitting them apart (NFD) leaves nothing to drop.
 *
 * Written out here and in the generator, and the two must say the same thing:
 * a letter this list forgets is a town nobody can type. The first pass forgot
 * ł, and seventy eight towns in Poland were in the codebook and unreachable,
 * Wrocław among them. A contract test over the shipped file now says so
 * (data.test.tsx).
 */
const ON_THEIR_OWN: [RegExp, string][] = [
  [/đ/g, 'dj'],
  [/ł/g, 'l'],
  [/ø/g, 'o'],
  [/ı/g, 'i'],
  [/ß/g, 'ss'],
  [/æ/g, 'ae'],
  [/œ/g, 'oe'],
  [/ð/g, 'd'],
  [/þ/g, 'th'],
  [/ħ/g, 'h'],
  [/ə/g, 'e'],
  /* And the two a typesetter uses that no keyboard has: the curly apostrophe,
     which 401 towns carry, and the long dash inside a name like
     Rosemont–La Petite-Patrie, which a person types as a hyphen. */
  [/[’‘`]/g, "'"],
  [/[–—]/g, '-'],
]

export function plainly(text: string): string {
  const bare = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  return ON_THEIR_OWN.reduce((so, [letter, plain]) => so.replace(letter, plain), bare)
}

/** How many suggestions a list may hold. Enough to make the right town likely
 *  and few enough to read without scrolling past the form. */
export const SUGGESTIONS = 8

/** How much has to be typed before the portal has any business guessing. Two,
 *  by the owner (10.08.2026); one letter matches thousands of towns and answers
 *  nothing. */
export const TYPED_BEFORE_GUESSING = 2

/**
 * The towns whose name starts with what has been typed.
 *
 * Starts with, not contains: "no" should offer Novi Sad and Nova Gorica, not
 * every town in the world with an N and an O in it. The codebook is already in
 * order of size, so the first eight matches are the eight largest, which is why
 * this stops at eight rather than sorting.
 *
 * Both spellings are searched whatever language the page is in, because the
 * keyboard does not change with the page: "belgrade" typed on the Serbian
 * portal finds Beograd.
 */
export function placesLike(places: Place[], typed: string): Place[] {
  const wanted = plainly(typed.trim())

  if (wanted.length < TYPED_BEFORE_GUESSING) {
    return []
  }

  const found: Place[] = []

  for (const place of places) {
    if (found.length === SUGGESTIONS) {
      return found
    }

    const english = place[3]

    if (plainly(place[1]).startsWith(wanted) || (english !== undefined && plainly(english).startsWith(wanted))) {
      found.push(place)
    }
  }

  return found
}

/**
 * The name before a bracket that closes it, or nothing for a name that does not
 * end in one: „Yantai" out of „Yantai (Dalian)", nothing out of „Rome".
 *
 * The label a namesake carries is the last bracket group of its name, with a
 * space before it and no bracket inside it. A name that ends in a bracket and is
 * not of that shape („Neustadt (Halle (Saale))" would be one) is not read, and
 * the contract test over the shipped file says so rather than leaving it to be
 * found (data.test.tsx).
 */
export function nameBeforeItsBracket(name: string): string | undefined {
  return /^(.*\S) \([^()]*\)$/.exec(name)?.[1]
}

/**
 * Which countries answer to each name, the names folded the way they are typed.
 *
 * What a field asks to know whether the codebook can mean only one place by what
 * has been typed. A name that stands in one country recognises it, and a name
 * that stands in two recognises nothing by itself: London is British and
 * American. Both names of a town count, the local one and the English one,
 * because the keyboard does not change with the language of the page.
 *
 * **A label is read back to the bare name it was added to.** Towns of one country
 * that were called alike carry the nearest bigger town in brackets since
 * 02.10.2026 (owner, PDL „Odluke iz ciscenja nalaza (02.10.2026, vlasnik)"),
 * „Yantai (Dalian)" and „Yantai (Chengxi)", and what somebody types who never
 * looks at the list is still „Yantai". The codebook no longer holds that name as
 * it is written, and a lookup that asks only whether it does gives the wrong
 * answer both ways (review of PR 464): where every town of the name is in one
 * country the name recognises nothing, and where one country kept a bare town
 * and another's were labelled it recognises the one that kept it. Rome is
 * Italian, and „Rome (Marietta)" and „Rome (Utica)" are American. So the bare
 * name is entered under the countries of the towns that carry it with a label,
 * and the answer is the one the name gave before the labels.
 *
 * **Which brackets are labels.** Two or more towns of one country carrying the
 * same bare name under a bracket. A label is what makes two namesakes two names,
 * so it comes in twos, and the one town of a pair that keeps its bare name holds
 * its country under that name already. A town with a bracket of its own
 * („Frankfurt (Oder)", „Dubova (Driloni)") has no namesake to be told from and
 * its bare name was never a name of anything: reading it back would give
 * „Frankfurt" to Germany and take „Dubova" away from Romania. Counted country by
 * country, because two towns under one bare name in two different countries are
 * not namesakes of each other.
 *
 * Folded once per codebook, so that recognising a name is a lookup and not a walk
 * over forty seven thousand towns on every key (`forms/PlaceField.tsx`). It is
 * the one place the portal says which countries a name stands in, and the
 * contract test counts the names that stand in more than one through this
 * function rather than through a copy of it (data/contract.test.ts).
 */
export function countriesByName(places: Place[]): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>()
  const underABracket = new Map<string, { folded: string; country: string; towns: number }>()

  const add = (folded: string, country: string) => {
    const already = found.get(folded)

    if (already === undefined) {
      found.set(folded, new Set([country]))
    } else {
      already.add(country)
    }
  }

  for (const [, name, country, english] of places) {
    add(plainly(name), country)

    if (english !== undefined) {
      add(plainly(english), country)
    }

    const bare = nameBeforeItsBracket(name)

    if (bare !== undefined) {
      const folded = plainly(bare)
      const key = `${country}:${folded}`
      const carried = underABracket.get(key)

      if (carried === undefined) {
        underABracket.set(key, { folded, country, towns: 1 })
      } else {
        carried.towns += 1
      }
    }
  }

  for (const { folded, country, towns } of underABracket.values()) {
    if (towns >= 2) {
      add(folded, country)
    }
  }

  return found
}

/**
 * The codebook, once somebody has started typing.
 *
 * The codebook is 1300 KB and is not sent to anybody who merely opened a form.
 * The request goes out on the second letter, and `loadResource` holds what came
 * back, so every later field on every later screen answers from memory.
 *
 * A codebook that fails to arrive leaves the field a plain text box, which is
 * what it was before this existed. Nothing is said about it: the person is
 * typing a town they already know how to spell, and an error under the cursor
 * would be noise about somebody else's problem.
 *
 * **That is a decision of the owner's now, and the exception he named to a list
 * that cannot be read saying so** (03.10.2026, chosen between the outcomes offered, in
 * the words of the PDL's record of it and not the owner's: „Za mesta: NE; kad
 * šifarnik mesta ne stigne, polje ostaje obično polje za tekst koje i dalje prima
 * ukucano mesto, pa član nije zaglavljen."). The races on the form a result is
 * entered on do say it (`pages/member/NewResult.tsx`); the towns do not, and this
 * is where. Held by what the field does, on the form a result is entered on
 * (`pages/member/racesUnreadable.test.tsx`), the proposal of a team and the field
 * alone: no sentence, no button, and the town that is typed is taken.
 */
export function usePlaces(wanted: boolean): Place[] {
  const [places, setPlaces] = useState<Place[]>([])

  useEffect(() => {
    if (!wanted) {
      return
    }

    /* A codebook that failed to arrive is asked for again on the next second
       letter, because `loadResource` deliberately does not remember a failure
       (data/client.ts). That is the retry, not a leak: it only happens on a
       path that is already broken, where the field has quietly become the plain
       text box it was before any of this existed. */

    /* No guard against the answer landing after the form is closed. There was
       one, and it could not be held by any test: React has not complained about
       a state setter on a gone component since 18, and the update is discarded
       either way, so the screen and the console say the same thing with the
       guard and without it. A line nothing can hold is a line the next reader
       has to take on trust, and this one was buying nothing. */
    loadResource<Place[]>('places').then(setPlaces, () => {})
  }, [wanted])

  return places
}
