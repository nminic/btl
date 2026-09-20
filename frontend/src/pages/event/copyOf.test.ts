import { copyOf } from './copyOf'
import type { BtlEvent } from '../../data/types'

const EVENT: BtlEvent = {
  id: 1,
  slug: 'beogradski-maraton-2026',
  name: 'Beogradski maraton',
  date: '2026-04-19',
  city: 'Beograd',
  country: 'RS',
  kind: 'race',
  featured: true,
  description: 'Trka kroz gradsko jezgro, sa dva kruga.',
  link: 'https://organizator.example/trka',
  copiedFrom: null,
}

describe('what a copy of an event holds', () => {
  it('takes along everything the organiser wrote about it', () => {
    /* Owner, 23.08.2026: „ako postoje i odem na kopiranje događaja, automatski se
       učitavaju iz prethodne godine, pa ih dalje mogu menjati po želji". Left out
       for a day, and a round measured what that cost: the form of the copy opened
       both empty and the save wrote the emptiness over them, because the form of a
       copy carries those two fields.

       Asked here and not through the screen, because every event in the file has
       both empty: a guard through the screen would pass on emptiness whichever way
       the code went. */
    expect(copyOf(EVENT)).toMatchObject({
      description: 'Trka kroz gradsko jezgro, sa dva kruga.',
      link: 'https://organizator.example/trka',
    })
  })

  it('keeps the town, the country and the kind, which are not put in question', () => {
    /* The three the form of a copy does not even ask for (owner, 23.08.2026), so
       they have to come from here or they come from nowhere. */
    expect(copyOf(EVENT)).toMatchObject({ city: 'Beograd', country: 'RS', kind: 'race' })
  })

  it('opens on the same place in next year calendar', () => {
    /* 19 April 2026 is the third Sunday of April; the third Sunday of April 2027 is
       the 18th. */
    expect(copyOf(EVENT).date).toBe('2027-04-18')
  })

  it('is not featured, and says which edition it came out of', () => {
    /* Being singled out is a choice about this running of the race and not a
       property the race carries (owner, 11.08.2026), so a copy of a featured event
       is not featured. */
    /* Both as text, because a copy is written into the session's overlay and the
       overlay carries text (`session/context.ts`, `Created`); what the record keeps
       is a flag and a number, and `forms/records.ts` is where the two meet. */
    expect(copyOf(EVENT)).toMatchObject({ featured: 'no', copiedFrom: String(EVENT.id) })
  })
})
