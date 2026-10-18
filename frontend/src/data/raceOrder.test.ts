import { inEventOrder, type Ordered } from './raceOrder'

/**
 * The order the owner gave the races of one event (PDL P6, „Redosled trka jednog događaja",
 * 18.10.2026), key by key.
 *
 * **Every key is measured with the others unable to give the same answer.** A timed race and a
 * free race carry no length (`distanceKm` is nought on both, as the calendar keeps them), so a
 * list ordered by the length alone puts them in whatever order they arrived in; and every case
 * hands the races in an order that is neither the answer nor its reverse, so a sort that did
 * nothing, or did the opposite, fails as well.
 */

const length = (id: number, distanceKm: number, name = `Trka ${String(id)}`): Ordered => ({
  id,
  name,
  kind: 'length',
  distanceKm,
  limitSeconds: 0,
})

const timed = (id: number, hours: number, name = `Trka ${String(id)}`): Ordered => ({
  id,
  name,
  kind: 'time',
  distanceKm: 0,
  limitSeconds: hours * 3600,
})

const free = (id: number, name: string): Ordered => ({ id, name, kind: 'free', distanceKm: 0, limitSeconds: 0 })

const ids = (races: Ordered[]) => inEventOrder(races).map((one) => one.id)

describe('the races of one event, in the owner\'s order', () => {
  it('puts the races of a length longest first', () => {
    expect(ids([length(1, 21.1), length(2, 5), length(3, 42.2)])).toEqual([3, 1, 2])
  })

  it('puts the timed races longest first, which is the owner\'s own picture of 12 h, 24 h and 6 h', () => {
    /* Read off the limit and never off the length: the three carry a length of nought, so a
       list ordered by the length would hand them back as they came. */
    expect(ids([timed(1, 12), timed(2, 24), timed(3, 6)])).toEqual([2, 1, 3])
  })

  it('puts the races of a length first, then the timed, then the free, whatever they measure', () => {
    /* The owner's example: „Maraton, Polumaraton, 12 h, 6 h", with a free race after them. The
       free one is handed in first and the shortest race of a length last, so neither the order
       of arrival nor a list by the length alone gives this. */
    expect(
      ids([free(1, 'Round'), timed(2, 6), length(3, 21.1), timed(4, 12), length(5, 42.2)]),
    ).toEqual([5, 3, 4, 2, 1])
  })

  it('parts two races of one length, and two of one duration, by the name, in the Serbian alphabet', () => {
    /* „Č" comes after „C" in the Serbian alphabet and sorts with it in English, so „Čačak" falls
       before „Cer" in a comparison that names no language and after it in this one. The races are
       handed in the right order by id and the wrong one by name, so the id cannot be what decides. */
    expect(ids([length(1, 10, 'Čačak'), length(2, 10, 'Cer')])).toEqual([2, 1])
    expect(ids([timed(1, 6, 'Čačak'), timed(2, 6, 'Cer')])).toEqual([2, 1])
  })

  it('puts the free races last, among themselves by the name', () => {
    expect(ids([free(1, 'Zvezda'), length(2, 5), free(3, 'Avala')])).toEqual([2, 3, 1])
  })

  it('settles a race of one kind, one measure and one name by its own number, so every list agrees', () => {
    expect(ids([length(9, 10, 'Ista'), length(4, 10, 'Ista')])).toEqual([4, 9])
  })

  it('reads a word it does not know as a race of a length, which is what `raceKind` reads it as', () => {
    /* A record arrives unchecked (`data/raceKind.ts`); a word nobody wrote down sorts as the race
       of a length it is drawn as everywhere else, and not as a timed race or a free one. */
    expect(ids([timed(1, 24), { ...length(2, 5), kind: 'ludilo' }])).toEqual([2, 1])
  })

  it('leaves the list it was handed as it was', () => {
    const handed = [length(1, 5), length(2, 10)]

    inEventOrder(handed)

    expect(handed.map((one) => one.id)).toEqual([1, 2])
  })
})
