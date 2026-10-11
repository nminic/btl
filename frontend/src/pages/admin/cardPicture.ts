import type { PendingItem } from '../../data/types'

/**
 * WHAT HAS BECOME OF THE PICTURE A CARD DRAWS, and what each of the card's two decisions may do about it.
 *
 * <p>PDL, 11.10.2026, under „I odbijanje slike traži viđenu sliku" (the owner chose between the outcomes
 * he was offered, against the recommendation for the first): „„Odobri" i „Odbij" čekaju da se slika učita,
 * već za release. Dok se slika učitava, oba dugmeta su neaktivna; kad se učita, oba rade." And of the
 * picture that never arrives: „Slika koja se nije učitala sme da se odbije, i odbijanje nosi ključ i krug,
 * pa član čiji je fajl nestao može da se odbije." Approving such a picture stays shut, as it has since
 * PDL 27.09.2026 („Slika koja ne može da se učita: ... Odobri je onemogućeno, a Odbij radi."): looking is
 * the condition of approving.
 *
 * <p>That is four states and two questions, written once here so that no place can spell them its own
 * way. The approval's question is asked by the card's Odobri (what it says and what a press does) and by
 * the sweep; the refusal's by the card's Odbij (what it says and what a press does) and by the box that
 * opens under it (`SendBack`, `held`). Six places, and a table spelt at each would be six places that
 * could disagree about the one state the owner priced, the picture that has not arrived yet.
 *
 * <ul>
 * <li>`none`: the card draws no picture (a biography, a proposed team, a comment, a result, a payment). It
 * waits for nothing, and both decisions are what they were before the owner's sentence.
 * <li>`loading`: it draws one and nothing has come of it. Neither decision.
 * <li>`loaded`: the moderator can see it. Both.
 * <li>`failed`: it could not be drawn. The refusal only, naming the key and the circle the card holds like
 * any other refusal of a picture.
 * </ul>
 */
export type CardPicture = 'none' | 'loading' | Outcome

/** What a picture's own element reported, which is all that can be known of it: it arrived, or it did not. */
export type Outcome = 'loaded' | 'failed'

/**
 * What every picture this screen has drawn has come to, by the picture (`pictureKey`).
 *
 * <p>A picture that is not in it has not reported yet, which is `loading` and not a third outcome
 * somebody has to remember to write.
 */
export type Outcomes = ReadonlyMap<string, Outcome>

/**
 * THE PICTURE AND NOT THE ROW, which is what an outcome is about.
 *
 * <p>The row's own address (`/api/verification/{id}/photo`) is the same character for character when the
 * member sends another picture, and the number the queue serves with the card is what moves
 * (`photoPath`; PDL, 10.10.2026: „Odobrava se samo slika koju je moderator video"). An outcome kept under
 * the row would be inherited by the picture that replaces the one it was reported for: a card whose
 * first picture arrived would call the next one seen before a single byte of it had, and the press after
 * the list is read again would approve what the moderator never looked at. Kept under the number, the
 * replacement starts over at `loading`, and so does it for the element that draws it (`WaitingPicture`
 * keys its `<img>` by the same number, so a replaced picture is an element of its own that reports for
 * itself).
 *
 * <p><b>The circle is deliberately not in it.</b> A circle moved over the same picture changes neither
 * the pixels nor the element, so no new report would ever come; a key that carried the circle would leave
 * the card waiting for it for ever. The price the owner was shown and accepted for a moved circle is that
 * the card, read again, looks the same to the moderator (PDL, 11.10.2026, under „Pomeren krug odbija
 * odluku i dok se isečak ne crta"), and the circle travels in the decision itself (`approvalOf`,
 * `refusalOf`).
 */
export function pictureKey(id: string, photoId: number): string {
  return `${id}/${String(photoId)}`
}

/** The state of the picture this card draws, as the outcomes know it. */
export function cardPictureOf(one: PendingItem, outcomes: Outcomes): CardPicture {
  return one.photoId === null ? 'none' : (outcomes.get(pictureKey(one.id, one.photoId)) ?? 'loading')
}

/** Whether the card's approval may be pressed: it waits for a picture it has to look at, and for none
 *  that it cannot. */
export function mayApprove(picture: CardPicture): boolean {
  return picture === 'none' || picture === 'loaded'
}

/** Whether the card's refusal may be pressed: everything but a picture still on its way, since one
 *  that will not come is exactly the one the owner let be refused. */
export function mayRefuse(picture: CardPicture): boolean {
  return picture !== 'loading'
}
