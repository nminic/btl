import { nextSeason } from '../admin/nextSeason'
import type { BtlEvent } from '../../data/types'

/**
 * What a copy of an event holds, in the shape a record keeps.
 *
 * Next season's calendar is last season's calendar with the dates moved, and
 * entering an event and its five races again by hand is the work the copy exists
 * to remove.
 *
 * Written here rather than inside the press, so what a copy carries can be asked
 * without a screen. Every event in the file has an empty description and an empty
 * link, so a guard through the screen would pass on emptiness whichever way the
 * code went, and a round on 23.08.2026 measured exactly that: the two were left out
 * of the copy, the form opened them empty, and the save wrote the emptiness over
 * them.
 */
export function copyOf(event: BtlEvent): Record<string, string> & { date: string } {
  return {
    name: event.name,
    /* A year on, in the same place in the calendar rather than on the same date: a
       race held on the third Saturday of October is held on the third Saturday of
       October next year, whatever date that is (owner, 23.08.2026). A proposal and
       nothing more, and the form opens with the cursor in it. */
    date: nextSeason(event.date),
    city: event.city,
    country: event.country,
    kind: event.kind,
    /* What the organiser says this race is, and where they say the rest of it
       (owner, 23.08.2026: „ako postoje i odem na kopiranje događaja, automatski se
       učitavaju iz prethodne godine, pa ih dalje mogu menjati po želji"). */
    description: event.description,
    link: event.link,
    /* Not featured, whatever the one it was copied from was: being singled out is a
       choice about this running of the race and not a property the race carries
       (owner, 11.08.2026). */
    featured: 'no',
    /* Which edition this one came out of. The one place it is ever written, and the
       reason the chain can be walked at all: an id nobody typed and nobody can
       mistype, rather than a name that changes with a sponsor (owner,
       11.08.2026). */
    copiedFrom: event.id,
  }
}
