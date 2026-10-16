import { NO_RATING, type PendingItem } from '../../data/types'
import {
  cardPictureOf,
  mayApprove,
  mayRefuse,
  pictureKey,
  type CardPicture,
  type Outcomes,
} from './cardPicture'

/**
 * THE TABLE THE OWNER PRICED ON 11.10.2026, held cell by cell.
 *
 * <p>PDL, under „I odbijanje slike traži viđenu sliku": „„Odobri" i „Odbij" čekaju da se slika učita, već
 * za release. Dok se slika učitava, oba dugmeta su neaktivna; kad se učita, oba rade." And of the picture
 * that never arrives: „Slika koja se nije učitala sme da se odbije, i odbijanje nosi ključ i krug". The
 * approval of such a picture stays shut (PDL 27.09.2026).
 *
 * <p>Four states and two questions are eight cells, and every cell is written out here rather than derived
 * from a rule, because a rule is what a mutation rewrites: `mayApprove` returning `picture !== 'failed'`
 * is a rule, it is short, and it is wrong in exactly one cell. The screens have their own cases
 * (`buttonsWaitForThePicture.test.tsx`); this file is where each cell is asked on its own.
 */

/** A card of the racing profile, whole, so the compiler holds it to the shape a card has; the state
 *  is read from two of its fields (`id`, `photoId`) and none else. */
function aCardHolding(
  id: string,
  photoId: number | null,
  crop = { x: 0.3, y: 0.7, size: 0.45 },
): PendingItem {
  return {
    id,
    queue: 'profiles',
    kind: photoId === null ? 'bio' : 'photo',
    date: '2026-09-20',
    memberNumber: '000011',
    who: 'Neda Nedić',
    subject: 'Neda Nedić',
    subjectId: '',
    body: '',
    picture: '',
    crop,
    photoId,
    currentDate: '',
    proposedDate: '',
    rating: NO_RATING,
    email: '',
    city: '',
    country: '',
  }
}

describe('what each decision may do about the picture on its card', () => {
  const table: Array<{ picture: CardPicture; approve: boolean; refuse: boolean }> = [
    { picture: 'none', approve: true, refuse: true },
    { picture: 'loading', approve: false, refuse: false },
    { picture: 'loaded', approve: true, refuse: true },
    { picture: 'failed', approve: false, refuse: true },
  ]

  it.each(table)('$picture: approving is $approve and refusing is $refuse', ({ picture, approve, refuse }) => {
    expect(mayApprove(picture)).toBe(approve)
    expect(mayRefuse(picture)).toBe(refuse)
  })
})

describe('the state of the picture a card draws', () => {
  it('is none for a card that draws no picture, whatever the outcomes hold under its row', () => {
    /* An outcome under the key a card WITHOUT a picture would build if it had one: the card must not
       read it, because it draws nothing to have an outcome for. */
    const outcomes: Outcomes = new Map([[pictureKey('22', 0), 'failed']])

    expect(cardPictureOf(aCardHolding('22', null), outcomes)).toBe('none')
  })

  it('is loading for a picture nobody has heard from', () => {
    expect(cardPictureOf(aCardHolding('21', 9), new Map())).toBe('loading')
  })

  it('is what the picture reported, for each of the two things it can report', () => {
    const outcomes: Outcomes = new Map([
      [pictureKey('21', 9), 'loaded'],
      [pictureKey('23', 12), 'failed'],
    ])

    expect(cardPictureOf(aCardHolding('21', 9), outcomes)).toBe('loaded')
    expect(cardPictureOf(aCardHolding('23', 12), outcomes)).toBe('failed')
  })

  it('starts over when the row holds another picture, however the first one came out', () => {
    /* The row's address does not move when the member sends another picture; the number does. An outcome
       kept under the row would be inherited by the picture that replaces the one it was reported for. */
    const outcomes: Outcomes = new Map([
      [pictureKey('21', 9), 'loaded'],
      [pictureKey('23', 12), 'failed'],
    ])

    expect(cardPictureOf(aCardHolding('21', 10), outcomes)).toBe('loading')
    expect(cardPictureOf(aCardHolding('23', 13), outcomes)).toBe('loading')
  })

  it('is not read from another row that holds the same picture', () => {
    const outcomes: Outcomes = new Map([[pictureKey('21', 9), 'loaded']])

    expect(cardPictureOf(aCardHolding('23', 9), outcomes)).toBe('loading')
  })

  it('does not move with the circle, which changes neither the pixels nor the element', () => {
    /* The owner priced a moved circle as a card that, read again, looks the same to the moderator
       (PDL, 11.10.2026, under „Pomeren krug odbija odluku i dok se isečak ne crta"). A state that moved
       with it would wait for a report no element is going to make. */
    const outcomes: Outcomes = new Map([[pictureKey('21', 9), 'loaded']])

    expect(cardPictureOf(aCardHolding('21', 9, { x: 0.35, y: 0.6, size: 0.5 }), outcomes)).toBe('loaded')
  })
})

describe('the picture, and not the row', () => {
  it('is named by the row and by the number of its picture, each of them', () => {
    expect(pictureKey('21', 9)).not.toBe(pictureKey('23', 9))
    expect(pictureKey('21', 9)).not.toBe(pictureKey('21', 10))
    expect(pictureKey('21', 9)).toBe(pictureKey('21', 9))
  })

  it('cannot be mistaken for another row by running the two together', () => {
    /* Row 1 holding picture 23 and row 12 holding picture 3 are two pictures, and a key that simply
       joined the digits would make them one. */
    expect(pictureKey('1', 23)).not.toBe(pictureKey('12', 3))
  })
})
