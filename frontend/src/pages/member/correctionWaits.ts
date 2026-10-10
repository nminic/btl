import type { SentRun } from '../../data/types'

/**
 * WHETHER A CORRECTION OF THIS COUNTED RESULT IS WAITING ON A MODERATOR, which is the one question
 * every way of sending a correction puts to itself before it lets one go.
 *
 * <p><b>Four ways in, one act.</b> „Izmeni" on a counted result and `?ispravka=` send a correction
 * of that result; „Ispravi i pošalji ponovo" on a correction a moderator sent back and `?ponovo=`
 * send a correction of the result the one sent back named (`SentRun.amendsResultId`). All four end
 * in the same `PUT /api/results/{id}` (`resultWrites.ts`, `theCorrectionWasSentIn`). Two of them
 * asked this each for itself and the other two did not ask it at all: the review of PR 521
 * measured on 10.10.2026 that with a correction of a result waiting, the list hid „Izmeni" and went
 * on offering „Ispravi i pošalji ponovo" on a correction of the same result that had been sent back,
 * and the address behind that link opened the form and sent. It is one function now, so that no way
 * in can answer for itself and two of them be found saying opposite things about the same result.
 *
 * <p><b>Why a second correction does not go while one waits.</b> It puts two corrections of one
 * result in front of a moderator, and each approval writes the same row of `result`
 * (`VerificationWriteApi`), so what ends up counted is whichever was approved last. Measured by a
 * review on 28.08.2026 and kept by this screen since. The server does not refuse a second one
 * (`ResultWriteApi`, „A second correction while one is already waiting"), so this is the only
 * place that does, and the PDL's line of 04.09.2026 says nothing about two at once.
 *
 * <p><b>Waiting, and nothing else.</b> A correction a moderator sent back is in nobody's queue, so it
 * stands in the way of nothing, and the moment no correction of a result waits, one that was sent
 * back goes again. That is the owner's line of 04.09.2026 held to the letter: „Broj zahteva za
 * ispravku nije ograničen. Član sme da traži ispravku koliko puta hoće, i posle odbijanja." (PDL).
 * That a sent-back one goes again is his; that it does not go beside a waiting one is the
 * screen's, derived on 10.10.2026 from the reason above and so not the owner's word.
 *
 * <p><b>`null` is a run that corrects nothing, and it is not a key.</b> A fresh run sent in, waiting
 * or sent back, carries `null` in `amendsResultId`, and two of them are not corrections of the same
 * result. Compared as though it were one, a fresh run that waits would shut every fresh run that was
 * sent back, on a screen that has nothing to say about them.
 *
 * @param sent the asker's own runs, as `GET /api/me/result-submissions` answers them: what waits and
 *             what was sent back, and nothing that was counted. `undefined` while that answer has
 *             not come, when nothing is known to wait: the screens that ask do not draw a way in
 *             until it has
 * @param result `result.id` of the counted result a correction would replace, or `null` for a run
 *               that would replace none
 */
export function aCorrectionWaitsOn(
  sent: readonly SentRun[] | undefined,
  result: number | null,
): boolean {
  return (
    result !== null &&
    sent?.some((one) => one.state === 'waiting' && one.amendsResultId === result) === true
  )
}
