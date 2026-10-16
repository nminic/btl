import { fireEvent, type within } from '@testing-library/react'

/**
 * THE PICTURE ON A MODERATOR'S CARD, AND WHAT BECOMES OF IT, for the cases that press a button beside it.
 *
 * <p>jsdom fetches no picture and decodes none, so a card's `<img>` never says anything by itself: it is
 * on its way for the whole of a case. Since PDL, 11.10.2026 („Dok se slika učitava, oba dugmeta su
 * neaktivna; kad se učita, oba rade.") that is a card whose two buttons do not answer, so a case that
 * means to press one says first what became of the picture, exactly as a browser would tell the page:
 * `load` when it arrived and `error` when it did not.
 *
 * <p>Found the way a reader finds it, by what it is and what it is called (`verification.pictureAlt`),
 * never by a class: a card that draws no picture, or has already replaced it with the sentence for one
 * that could not be drawn, is a card with nothing to say this about, and asking for it is an error that
 * says which card.
 */
type Card = Pick<ReturnType<typeof within>, 'getByRole'>

/** The picture this card draws. */
export function pictureOn(card: Card): HTMLElement {
  return card.getByRole('img', { name: /Slika koju je poslao/ })
}

/** The browser tells the page the picture arrived: both buttons answer from here on. */
export function thePictureArrives(card: Card): void {
  fireEvent.load(pictureOn(card))
}

/** The browser tells the page the picture could not be drawn: the refusal answers, the approval does not. */
export function thePictureFails(card: Card): void {
  fireEvent.error(pictureOn(card))
}
