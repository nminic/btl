import { useEffect, useState } from 'react'
import { loadResource } from './client'

/**
 * A town, as the codebook holds it: the name in this region's languages, the
 * country it is in, and the English name where the town has one of its own.
 *
 * A tuple rather than an object because there are forty seven thousand of them
 * and the field names would outweigh the data. Built by
 * `btl-produkt/istorijski-podaci/napravi-mesta.py` out of the GeoNames export
 * (CC BY 4.0).
 */
export type Place = [name: string, country: string, english?: string]

/** How the town is written on a page in this language. English where the town
 *  has an English name of its own, the local name everywhere else (owner,
 *  11.08.2026): Belgrade on the English portal, Beograd on the Serbian one, and
 *  Novi Sad on both, because Novi Sad is not called anything else. */
export function placeName(place: Place, locale: string): string {
  return locale === 'en' ? (place[2] ?? place[0]) : place[0]
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
     which four hundred and twenty one towns carry, and the long dash inside a
     name like Rosemont–La Petite-Patrie, which a person types as a hyphen. */
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

    const english = place[2]

    if (plainly(place[0]).startsWith(wanted) || (english !== undefined && plainly(english).startsWith(wanted))) {
      found.push(place)
    }
  }

  return found
}

/**
 * The codebook, once somebody has started typing.
 *
 * Nine hundred kilobytes are not sent to anybody who merely opened a form. The
 * request goes out on the second letter, and `loadResource` holds what came
 * back, so every later field on every later screen answers from memory.
 *
 * A codebook that fails to arrive leaves the field a plain text box, which is
 * what it was before this existed. Nothing is said about it: the person is
 * typing a town they already know how to spell, and an error under the cursor
 * would be noise about somebody else's problem.
 */
export function usePlaces(wanted: boolean): Place[] {
  const [places, setPlaces] = useState<Place[]>([])

  useEffect(() => {
    if (!wanted) {
      return
    }

    let active = true

    loadResource<Place[]>('places').then(
      (arrived) => {
        if (active) {
          setPlaces(arrived)
        }
      },
      () => {},
    )

    return () => {
      active = false
    }
  }, [wanted])

  return places
}
