import { useEffect, useRef, useState } from 'react'
import { Resource } from '../../components/Resource'
import { AskedLabel } from '../../forms/AskedLabel'
import { LongBox } from '../../forms/LongBox'
import { profil } from '../../forms/definitions'
import { limitOf } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import { clearResourceCache } from '../../data/client'
import type { Competitor } from '../../data/types'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  THE_ACCOUNT_GOES_TO,
  WHEN_CHANGING_MY_DATA,
  standingTextIn,
  waitingIn,
} from './myAccount'
import { useMyWaitingText } from './useMyWaitingText'

/**
 * Changing what a member wrote about themselves, after joining.
 *
 * Owner, 15.08.2026, asked what should happen to somebody whose biography was
 * refused: „Panel u Podešavanjima, kao za sliku." Until then the text was asked
 * for once, on the way in, and a refusal reached the member with a reason they
 * had nowhere to act on.
 *
 * The same shape as the picture beside it, deliberately, because it is the same
 * errand: one thing about one profile goes for review on its own. Somebody
 * fixing a sentence should not have their town and their shirt size travel
 * through a queue with it.
 *
 * <h2>THE TEXT THAT WAITS IS ON THIS SCREEN, AND IT IS THE BOX</h2>
 *
 * <p>PDL P11, owner, 18.10.2026: „Dok tekst o sebi čeka odobrenje, član ga vidi u Podešavanjima sa
 * oznakom da čeka i može da ga ispravi pre odluke; na profilu se do odobrenja vidi stari, odobren
 * tekst." Confirmed when he was shown what it costs: a new text overwrites the one that waits, on
 * the same row and at the same place in the queue, as a picture does (27.09.2026), and the moderator's
 * text changes under his hand while he reads.
 *
 * <p>So the box opens holding the words that WAIT where some wait, and the words that STAND where none
 * do, and the sentence over it says which. Both come from the server on every visit
 * (`GET /api/me`, `bioWaiting` for the first and the list for the second), never from what this visit
 * remembers: until 18.10.2026 this panel knew a text was waiting only in the visit that sent it, held in
 * the session, and a member who refreshed was met by the old words and no sign that anything was with a
 * moderator. The 409 that used to answer a second text (`aTextAlreadyWaits`, the owner's 19.09.2026) is
 * gone with the decision it carried out; the panel never drew a button while a text waited, which was the
 * same decision on this side, and that is gone too.
 *
 * <h2>THE ROAD THAT NEEDS NOBODY</h2>
 *
 * <p>An EMPTY text removes what stands, at once, with nobody deciding anything. The owner, 19.09.2026,
 * on three offered outcomes: „Prazan tekst znaci BRISANJE biografije, i stupa odmah, bez moderacije.
 * „Skloni moju biografiju" je pravo clana nad sopstvenim podatkom, ne predlog, isto kao sto je 12.08.2026
 * odluceno za sliku." And what that decision does NOT change, in his words: „nov neprazan tekst i dalje
 * ide kroz verifikaciju i ne stupa odmah." <b>It does not withdraw a text that waits</b>: nothing decided
 * that it should, and a deletion that came back with the waiting words still in the box is the honest
 * picture of it.
 *
 * <p>Both roads are one request to one address, and which one it was is read off the ANSWER rather than
 * off what was sent: {@code MeWriteApi.Changed} carries the text STANDING on the profile, „which is never
 * the one this request sent", and the key of whatever text of his waits.
 */
export function ProfileBio({ me }: { me: Competitor }) {
  const { t } = useI18n()
  const waiting = useMyWaitingText(me.memberNumber)

  return (
    <section className="member__panel" aria-labelledby="settings-bio">
      <h2 className="profile__section" id="settings-bio">
        {t('bio.title')}
      </h2>

      <Resource state={waiting} inline>
        {(words) => <TheBio me={me} waitingOpening={words} />}
      </Resource>
    </section>
  )
}

function TheBio({ me, waitingOpening }: { me: Competitor; waitingOpening: string }) {
  const { t } = useI18n()
  /**
   * WHAT STANDS ON THE PROFILE AND WHAT WAITS, held here and not read off `me` on every render, because
   * a removal takes effect at once and nothing refetches the resource. What replaces them is the
   * ANSWER's own field, read back out of the row after the writing.
   *
   * <p>`waitingOpening` is empty for a member with nothing waiting (`bioWaiting` is absent on the
   * server and read as the empty box, `session/theServer.ts`), so nothing waiting is `null` here and
   * the box and the sentence over it follow it.
   */
  const [standing, setStanding] = useState(me.bio ?? '')
  const [waiting, setWaiting] = useState<string | null>(waitingOpening === '' ? null : waitingOpening)
  const [written, setWritten] = useState(waitingOpening === '' ? (me.bio ?? '') : waitingOpening)
  /** What the last press did, so the sentence that follows it is the one for that road. */
  const [justDid, setJustDid] = useState<'sent' | 'removed' | null>(null)
  /* While the request is out. Two states rather than one, the shape `ProfilePicture.tsx` and
     `ProposeTeam.tsx` already have: the ref is what refuses a second press within one render,
     because state set in a handler is not readable by the next press in the same turn, and the
     flag is what the reader can see. */
  const [sending, setSending] = useState(false)
  const outstanding = useRef(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const said = useRef<HTMLParagraphElement>(null)

  /* Said out loud, because the control just pressed is answered by a sentence that appears
     somewhere else (WCAG 2.2 SC 4.1.3, and the order of focus in 2.4.3). */
  useEffect(() => {
    if (justDid !== null) {
      said.current?.focus()
    }
  }, [justDid])

  /* Nothing to send where the words are the ones already there: the ones that wait where some wait,
     the ones that stand where none do. A moderator reading a card that asks them to approve what
     they approved last week learns to skim. */
  const same = written.trim() === (waiting ?? standing).trim()
  const refusal = answer !== null && answer.got !== 'done' ? answer : null

  /**
   * Sends the text, or takes the standing one down, and says nothing until the server has.
   *
   * <p><b>THE ORDER IS THE WHOLE OF IT</b>, copied from `ProfilePicture.tsx`: the request goes first
   * and what the reader is told is written only inside the arm an answer authorised. Written the other
   * way round the member is told „čeka odobrenje" over a refusal, and the panel and the server disagree
   * about a text with nothing to settle it.
   */
  async function send(): Promise<void> {
    outstanding.current = true
    setSending(true)
    setAnswer(null)

    /* Stripped here as well as on the server, and that is not a second home for the rule: what
       travels is what the member is told travelled. `MeWriteApi` strips what it stores, and a blank
       body is what the owner's decision of 19.09.2026 turns into a removal, so a box holding three
       spaces has to reach the route as the removal the member meant. */
    const asked = written.trim()
    const answered = await askTheServer(THE_ACCOUNT_GOES_TO, { bio: asked }, 'PUT')

    outstanding.current = false
    setSending(false)

    if (answered.got !== 'done') {
      /* The words stay in the box. A refusal a member can act on - too long - is one he answers by
         shortening it, and clearing the box under him would take away the very thing he is being
         told about. */
      setAnswer(answered)

      return
    }

    /* WHAT STANDS ON THE PROFILE IS WHAT THE ANSWER SAID, AND AFTER A NEW TEXT THAT IS STILL THE OLD
       ONE. `MeWriteApi.Changed`: „the text STANDING ON THE PROFILE, which is never the one this request
       sent: a new one waits for a moderator and the profile goes on carrying the approved words".
       Folded in from `asked`, this panel would tell the member his unapproved words were already his
       profile. */
    const nowStanding = standingTextIn(answered.body)

    if (nowStanding !== null) {
      setStanding(nowStanding)
    }

    /* AND WHAT WAITS: after a text it is the words just sent (they overwrote the ones that waited),
       and after a removal it is whatever waited before, which the answer says by the key of the row. A
       removal that finds the key gone has nothing waiting; one that finds a key leaves the words
       as they were, because the deletion of what stands withdraws nothing. */
    const row = waitingIn(answered.body)

    if (asked !== '') {
      setWaiting(asked)
    } else if (row === null) {
      setWaiting(null)
    }

    /* WHICH RESOURCE STOPPED BEING TRUE, and the two roads spoil different ones. A new text writes a
       row into the queue (`MeWriteApi.queued`), so the moderator who had already opened Verifikacija in
       this visit would never see it: `data/client.ts` fetches a resource once per visit. A removal writes
       `competitor.bio`, which `/api/competitors` carries on every row. Narrowed to the one resource each
       road really spoils: nothing else about this visit went stale. */
    clearResourceCache(asked === '' ? 'competitors' : 'verification')

    setAnswer(answered)
    setJustDid(asked === '' ? 'removed' : 'sent')
  }

  return (
    <>
      <p
        className="member__note"
        ref={waiting !== null ? said : undefined}
        tabIndex={waiting !== null ? -1 : undefined}
        role={waiting !== null && justDid === 'sent' ? 'status' : undefined}
      >
        {waiting !== null ? t('bio.waitingNote') : t(standing === '' ? 'bio.none' : 'bio.standing')}
      </p>
      {waiting !== null && <p className="member__note">{t('bio.waitingCorrect')}</p>}

      <div className="rankings__field rankings__field--wide">
        <AskedLabel id="settings-bio-box" asked={false}>
          {t('profile.bio')}
        </AskedLabel>
        <LongBox
          id="settings-bio-box"
          value={written}
          maxLength={limitOf(profil, 'bio')}
          leftId="settings-bio-left"
          /* The count, read on the way into the box rather than found by hitting the end of it.
             `LongBox` draws it `aria-hidden` and says so in its own comment: pointing at it is the
             caller's business (WCAG 2.2 SC 3.3.2). */
          aria-describedby="settings-bio-left"
          onChange={(value) => {
            /* The confirmation goes the moment anything moves: „Sačuvano." left standing over a box
               being edited says the thing on the screen is what the server holds, which it is not
               (`PersonalData.tsx` keeps the same rule). */
            setJustDid(null)
            setAnswer(null)
            setWritten(value)
          }}
        />
      </div>

      <p className="member__actions">
        {/* Told off rather than switched off, as everywhere else on the portal: `disabled` takes the
            button out of the tab order. Which is why the second press is refused in the handler as
            well, off a ref: `aria-disabled` is a thing said to a reader and not a thing the browser
            enforces. Nothing points at a sentence for why (PDL P11, 18.10.2026: the sentences under the
            buttons are gone). */}
        <button
          type="button"
          className="button button--primary"
          aria-disabled={same || sending}
          onClick={() => {
            if (same || outstanding.current) {
              return
            }

            void send()
          }}
        >
          {t('bio.send')}
        </button>
      </p>

      {/* A REMOVAL TOOK EFFECT, which is the one thing this panel does that needs nobody's approval,
          so it is said the way the portal says every immediate save: `PersonalData.tsx`'s own
          („Sačuvano."), reused rather than written again. A text that was sent is answered by the
          sentence over the box instead, which is the mark that it waits. */}
      {justDid === 'removed' && (
        <p className="member__note" ref={said} tabIndex={-1} role="status">
          {t('account.saved')}
        </p>
      )}

      {/* What the server said, in its own reason's words, under the control it answers. */}
      {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_CHANGING_MY_DATA} />}
    </>
  )
}
