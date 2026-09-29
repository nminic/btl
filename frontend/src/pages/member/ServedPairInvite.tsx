import { useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { ServerSaid } from '../account/ServerSaid'
import type { Answer } from '../account/askTheServer'
import { WHEN_ANSWERING_A_PAIR_INVITE, theServerWasAnswered } from './pairWrites'

/**
 * „PRIHVATI" AND „ODBIJ", UNDER A MESSAGE THE SERVER IS KEEPING, AND THEY REACH THE SERVER.
 *
 * <p>Owner, PDL 27b, 27.09.2026, who defined the outcome he chose by the question he asked it
 * with: „Pod 1 ako to podrazumeva da clan moze klikom na dugme da prihvati ili odbije poziv?"
 * The answer is yes. `PUT /api/pairs/{id}` existed before this screen did and nothing called
 * it, so a served invitation drew a subject, a sender and a body and nothing else.
 *
 * <p><b>THE TWIN OF THIS FILE IS `member/PairInviteAnswer.tsx` AND THEY ARE NOT
 * INTERCHANGEABLE.</b> That one answers an invitation the BROWSER made, by writing into
 * `session/SessionProvider.tsx`; this one answers an invitation the SERVER made, by writing to
 * the route. Handing a served key to that one is the fault this whole arrangement exists to
 * refuse: it looks a pair invite up in the session's own list and treats one it cannot find as
 * one that is OVER, so the member would read „Ovaj poziv više nije otvoren." about a question
 * `pair_invite` still held open. The keys are a number here and text there
 * (`data/types.ts`, `pairInviteOnTheServer`), so the compiler is what keeps them apart.
 *
 * <p><b>WHAT THIS SCREEN DOES NOT WORK OUT, AND EACH ABSENCE IS MEASURED.</b>
 *
 * <ul>
 * <li><b>The season.</b> The twin computes it (`transfersTakeEffect`) because it writes the
 * pair itself. This one writes nothing: `PairWriteApi.settle` reads
 * `seasonBeingFormed()` on the server and answers the season back in `Made(id, season)`. A
 * season computed here would be a second answer to a question the route already answers, and
 * the two would differ across midnight on 31 December.
 * <li><b>Whether the two are mixed, and whether either has stopped paying.</b> The route asks
 * both again at the moment of the answer and says why in as many words - „either of them may
 * have stopped paying between the question and the answer" - so a copy here would be a second
 * home for a rule that is enforced in a transaction.
 * <li><b>Whether the question is the reader's.</b> `PairWriteApi.settle` asks that in the same
 * statement that fetches the row („ONLY THE PERSON IT WAS ADDRESSED TO MAY ANSWER, AND A
 * QUESTION THAT IS NOT HIS ANSWERS EXACTLY WHAT A QUESTION THAT DOES NOT EXIST ANSWERS"), so
 * there is no moment at which the row is in hand and the answer still depends on who is
 * asking. This screen could not ask it anyway: `GET /api/inbox` spends `to_id` on its own
 * `where` clause and the field never leaves the server.
 * <li><b>A transfer window, and this one is a decision rather than a division of
 * labour.</b> `member/InvitationAnswer.tsx` holds „Prihvati" back outside 15 October to 31
 * December, and there is no such branch here on either side of the wire. PDL, 07.09.2026,
 * struck that condition out for a pair in its own words: the deadline „nije uslov: svaki dan
 * godine je pre njenog kraja, pa se ništa nikad ne bi odbilo. Rok određuje KOJU sezonu par
 * dobija, i to na dan potvrde." So the 31st of December moves the season the pair is made for
 * and refuses nothing, which is why `PairWriteApi.settle` has no window either, and a „Poziv
 * čeka" sentence copied from the team screen would refuse an answer the owner decided is
 * always allowed. Measured both ways: `inYearlyWindow` has eight callers in `frontend/src` and
 * not one of them is about a pair.
 * </ul>
 */
export function ServedPairInvite({ invite }: { invite: number }) {
  const { t } = useI18n()
  /* What came back, where it was anything but „done". A successful answer draws nothing of its
     own: the question is closed on the server, the inbox is re-read, and the line comes back
     without a key so these buttons are gone rather than offered again - the same ending the
     twin reaches by reading the pairs of this visit. */
  const [said, setSaid] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const [sending, setSending] = useState(false)
  /**
   * A SECOND PRESS WHILE THE FIRST IS STILL OUT, and it is a ref rather than the state beside
   * it.
   *
   * <p>`Registration.tsx`'s own guard, the shape `ProposeTeam.tsx`, `RateEvent.tsx`,
   * `ProfilePicture.tsx` and `admin/Payments.tsx` all copied. <b>The state cannot do this
   * job</b>: `setSending(true)` is applied on the next render, so two presses dispatched
   * inside one task both read `sending === false` and both send. A ref is written in the same
   * tick it is read.
   *
   * <p><b>And this is why the case that measures it does not use `user.click` twice.</b>
   * Testing Library awaits between clicks, which lets React render, so `sending` alone would
   * pass - the guard would look sound and be absent. The case calls the handler twice within
   * one task instead, which is the only shape that tells the two apart.
   */
  const outstanding = useRef(false)

  async function answer(accepted: boolean): Promise<void> {
    if (outstanding.current) {
      return
    }

    outstanding.current = true
    setSending(true)
    setSaid(null)

    const came = await theServerWasAnswered(invite, accepted)

    outstanding.current = false
    setSending(false)

    if (came.got !== 'done') {
      setSaid(came)
    }
  }

  /**
   * THE ONE NUMBER THAT IS NOT A FAULT BUT AN ANSWER: 404 means the question is not there.
   *
   * <p>`PairWriteApi` answers an empty 404 through `away()` for three states it deliberately
   * cannot tell apart - the row is gone, the row is somebody else's, or one of the two is no
   * longer a member - and its javadoc says why they are one answer: „„refused" and „not there"
   * are one number and one empty body, so a caller walking the keys learns nothing about
   * anybody." The member's own truth in all three is the same and the portal already has the
   * sentence for it.
   *
   * <p><b>Told instead of the buttons rather than beside them</b>, because a question the
   * server says is not there cannot be answered by pressing again, and <b>the inbox is NOT
   * re-read</b>, for the reason `member/inboxRead.ts` states about its own refusal: nothing is
   * dropped where the server did not agree. Re-read, the line would come back without a key,
   * this component would go, and the member would be left with buttons gone and no word about
   * why.
   *
   * <p><b>Only 404, and never every number that is not 200.</b> A 500 or a 502 is „try again
   * in a minute" and `ServerSaid` says exactly that; read as „closed", a server that was down
   * for a moment would tell a member his invitation had expired.
   */
  const notThere = said !== null && said.got === 'wrong' && said.status === 404

  if (notThere) {
    return (
      <p className="messages__answered" role="status">
        {t('pair.inviteClosed')}
      </p>
    )
  }

  return (
    <>
      <p className="messages__answer">
        {/* **`aria-disabled` AND NEVER `disabled`, WHICH IS THE PORTAL'S OWN ANSWER GIVEN
            TWICE WITH ITS REASON.** `member/ProfilePicture.tsx` states it - „`disabled` takes
            the button out of the tab order and ... the press is refused in the handler as
            well, off a ref" - `event/RateEvent.tsx` says the same („Not switched off, told
            off"), and `pages/Home.css` carries the rule written for exactly this, in colours
            rather than `opacity`, so that the focus ring keeps its full strength (WCAG 2.2 SC
            1.4.11).

            **What `disabled` would really cost here, and it is not cosmetic.** A member
            answering by keyboard has focus ON this button when he presses it. Switched off in
            that instant, the element leaves the tab order under his feet and the browser drops
            focus to the top of the document, so the one person who cannot see where he landed
            is the one it happens to. Told off instead, he stays where he is and the press is
            refused by `answer` above. */}
        <button
          type="button"
          className="button"
          aria-disabled={sending}
          onClick={() => {
            void answer(true)
          }}
        >
          {t('pair.accept')}
        </button>{' '}
        <button
          type="button"
          className="button button--secondary"
          aria-disabled={sending}
          onClick={() => {
            void answer(false)
          }}
        >
          {t('pair.refuse')}
        </button>
      </p>
      {said !== null && <ServerSaid answer={said} refusals={WHEN_ANSWERING_A_PAIR_INVITE} />}
    </>
  )
}
