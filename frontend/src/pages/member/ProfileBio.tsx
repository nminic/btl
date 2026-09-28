import { useEffect, useRef, useState } from 'react'
import { AskedLabel } from '../../forms/AskedLabel'
import { LongBox } from '../../forms/LongBox'
import { registracija } from '../../forms/definitions'
import { limitOf } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import { clearResourceCache } from '../../data/client'
import type { Competitor } from '../../data/types'
import { useSession } from '../../session/useSession'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  THE_ACCOUNT_GOES_TO,
  WHEN_CHANGING_MY_DATA,
  standingTextIn,
  waitingIn,
} from './myAccount'

/**
 * Changing what a member wrote about themselves, after joining.
 *
 * Owner, 15.08.2026, asked what should happen to somebody whose biography was
 * refused: „Panel u Podešavanjima, kao za sliku." Until then the text was asked
 * for once, on the way in, and a refusal reached the member with a reason they
 * had nowhere to act on. The screen said so honestly and that was the whole of
 * the fix available at the time (PDL P22, PENDING R10).
 *
 * The same shape as the picture beside it, deliberately, because it is the same
 * errand: one thing about one profile goes for review on its own. Somebody
 * fixing a sentence should not have their town and their shirt size travel
 * through a queue with it, and the queue already tells the two sorts apart
 * (`kind` in data/types.ts).
 *
 * What stands on the profile is shown first. A box that opened empty would read
 * as „write one" to somebody who has written one already, and what they are
 * usually doing here is mending a sentence rather than starting again.
 *
 * <h2>IT GOES TO THE SERVER SINCE 28.09.2026, AND UNTIL TODAY IT WENT NOWHERE AT ALL</h2>
 *
 * <p>`send` called `propose`, which writes into the session overlay and stops there, so the
 * text died with the tab and the moderator's queue held a card of the browser's own making.
 * `PUT /api/me` has taken a `bio` the whole time and files the queue row itself
 * (`MeWriteApi.queued`). This is the identical correction `ProfilePicture.tsx` took on
 * 26.09.2026, and it is taken the identical way, down to the reason the owner gave for it:
 * „jedan jedini red na strani verifikacije".
 *
 * <h2>THE TWO ROADS OUT OF THIS PANEL, AND THEY ARE THE OWNER'S OWN DECISIONS</h2>
 *
 * <ul>
 * <li><b>A text waits for a moderator.</b> PDL P11, owner 19.09.2026 on three offered
 * outcomes: „Nov tekst o sebi se ODBIJA dok prethodni ceka odluku moderatora. Odgovor je 409,
 * i prvi tekst ostaje u redu netaknut." So nothing is offered to press while one is waiting,
 * and a request that goes round this panel meets {@code aTextAlreadyWaits} at the route.
 * <li><b>An EMPTY text removes what stands, at once, with nobody deciding anything.</b> The
 * same owner, the same day, also on three offered outcomes: „Prazan tekst znaci BRISANJE
 * biografije, i stupa odmah, bez moderacije. „Skloni moju biografiju" je pravo clana nad
 * sopstvenim podatkom, ne predlog, isto kao sto je 12.08.2026 odluceno za sliku." And what
 * that decision does NOT change, in his words: „nov neprazan tekst i dalje ide kroz
 * verifikaciju i ne stupa odmah."
 * </ul>
 *
 * <p>Both roads are one request to one address, and which one it was is read off the ANSWER
 * rather than off what was sent: {@code MeWriteApi.Changed} carries the text STANDING on the
 * profile, „which is never the one this request sent", and the key of whatever text of his is
 * standing in the queue undecided.
 *
 * <h2>WHAT THIS PANEL STILL CANNOT KNOW AFTER A RELOAD, AS A STATE OF MEASUREMENT</h2>
 *
 * <p><b>That a text of his is waiting.</b> The key comes back on a WRITE and nothing serves
 * it on a read. What was looked at, so the next reader starts from the measurement rather than
 * from this sentence: {@code MeApi.MyOwnRecord} declares {@code memberNumber}, {@code country},
 * {@code firstSeason}, {@code teamId}, {@code membershipBasis}, {@code referralCode} and
 * {@code referredCount}, and none of them is this; {@code /api/verification} is the moderator's
 * queue, which carries names and postal addresses of people who are not members yet and which
 * a standing guard refuses to let a member's browser fetch by name
 * (`pages/publicData.test.tsx`).
 *
 * <p><b>This is not a claim that no road exists - it is a claim that one was not asked for and
 * was not found.</b> The same boundary the picture beside it carries in its own words, and it
 * fails in the direction that can be lived with: a member who comes back while his text is
 * still with a moderator is met by the box, sends again, and the ROUTE refuses him 409 with the
 * reason named - which this panel now says out loud, where before today it would silently have
 * drawn the moderator a second card.
 */
export function ProfileBio({ me }: { me: Competitor }) {
  const { t } = useI18n()
  const { decisions } = useSession()
  /**
   * NULL READS AS NOTHING WRITTEN, the same rule PDL, 06.09.2026 keeps for a visitor's own
   * view of a hidden member: „Oba slucaja dobijaju isti ishod". In practice this screen
   * never actually meets null - a member is never hidden from himself
   * (`profile/visible.ts`'s `reachable`, and `CompetitorApi`'s condition on `bio` is always
   * true for the CALLER's own row, hidden or not, since it asks whether HE is signed in and
   * he must be to be here at all) - so this is a guard against the two conditions drifting
   * apart rather than a state a real visit produces, matched by `profileBio.test.tsx`'s own
   * case for it (rule of 14.09.2026: a guard nothing exercises is a branch nothing checks).
   *
   * **HELD IN STATE RATHER THAN READ OFF `me` ON EVERY RENDER, since 28.09.2026**, which is
   * `PersonalData.tsx`'s own arrangement and for the same reason: a removal takes effect at
   * once and nothing refetches the resource, so a panel reading the record would go on saying
   * „Ovo sada stoji na tvom profilu" over words the member has just taken down. What replaces
   * it is the ANSWER's own field, read back out of the row after the writing.
   */
  const [standing, setStanding] = useState(me.bio ?? '')
  const [written, setWritten] = useState(me.bio ?? '')
  const [justSent, setJustSent] = useState(false)
  /* While the request is out. Two states rather than one, the shape `ProfilePicture.tsx` and
     `ProposeTeam.tsx` already have: the ref is what refuses a second press within one render,
     because state set in a handler is not readable by the next press in the same turn, and the
     flag is what the reader can see. */
  const [sending, setSending] = useState(false)
  const outstanding = useRef(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const said = useRef<HTMLParagraphElement>(null)

  /**
   * THE TEXT OF HIS THE SERVER SAYS IS STANDING IN THE QUEUE UNDECIDED, and only what this
   * visit was told about.
   *
   * <p><b>WHOSE IT IS IS NOT A FIELD HERE, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT.</b>
   * `ProfilePicture.tsx` carries the member beside its own row because `pictureSent` lives in
   * the SESSION and survives anything this panel could do. Everything here is local, and there
   * are FOUR pieces of it that belong to one person - what he typed, what stands on his
   * profile, what of his is waiting, and what the server last said - so the honest answer is
   * that the whole panel belongs to one member. `Settings.tsx` says so with a `key`, and a
   * comparison in here would have mended one of the four and left the other three.
   *
   * <p>The fault is measured and it is the one that cost the picture panel a round of review:
   * „`000007` sends, `000002` signs in through `theServerSignedMeIn` during the same visit, and
   * the second man was told a picture of his was waiting and was shown THE FIRST MAN'S
   * PHOTOGRAPH." `SessionProvider` sits above the router so it never comes down, and the sign
   * in screen is walkable while somebody is signed in. A VISIT IS NOT A MEMBER.
   *
   * <p><b>`body` is what was sent, and it is empty where this panel never saw the text.</b>
   * That is the state a removal reaches while an older proposal of his is still undecided: the
   * route answers with the key of that older row, which is true and is what the member needs
   * to be told, and nothing here knows the words it carries.
   */
  const [sent, setSent] = useState<{ row: string; body: string } | null>(null)

  /* AND THE KEY IS THE SERVER'S, which is what lets this clear by itself: a moderator deciding
     in this same visit files the decision under the id of the row the SERVER made (`settle`),
     and this reads that same id. Under a key of the browser's own the two never met, so a
     member went on being told to wait over a text already decided.

     The empty string is a row the answer did not name, and no decision is ever filed under it,
     so the sentence stands for the rest of the visit - the direction that cannot mislead, since
     what the sentence is for is that a moderator is not handed the same text twice. */
  const waiting = sent !== null && decisions[sent.row] === undefined ? sent : undefined

  /* Said out loud, because the control just pressed is replaced by a sentence
     (WCAG 2.2 SC 4.1.3, and the order of focus in 2.4.3). */
  useEffect(() => {
    if (justSent) {
      said.current?.focus()
    }
  }, [justSent])

  /* Nothing to send where nothing was written, and nothing to send where the
     words are the ones already on the profile: a moderator reading a card that
     asks them to approve what they approved last week learns to skim. */
  const same = written.trim() === standing.trim()
  const refusal = answer !== null && answer.got !== 'done' ? answer : null
  /* A removal LANDED, which is the one road out of here that says „done" rather than „it is
     with somebody". Read off the two states rather than remembered as a third: nothing is
     waiting, and this visit has sent something. */
  const removed = justSent && waiting === undefined

  /**
   * Sends the text, or takes the standing one down, and says nothing until the server has.
   *
   * <p><b>THE ORDER IS THE WHOLE OF IT</b>, copied from `ProfilePicture.tsx` word for word:
   * the request goes first and what the reader is told is written only inside the arm an
   * answer authorised. Written the other way round the member is told „čeka odobrenje" over a
   * refusal, and the panel and the server disagree about a text with nothing to settle it.
   */
  async function send(): Promise<void> {
    outstanding.current = true
    setSending(true)
    setAnswer(null)

    /* Stripped here as well as on the server, and that is not a second home for the rule: what
       travels is what the member is told travelled. `MeWriteApi` strips what it stores („the
       box the member types into keeps whatever spaces he left"), and a blank body is what the
       owner's decision of 19.09.2026 turns into a removal, so a box holding three spaces has
       to reach the route as the removal the member meant. */
    const asked = written.trim()
    const answered = await askTheServer(THE_ACCOUNT_GOES_TO, { bio: asked }, 'PUT')

    outstanding.current = false
    setSending(false)

    if (answered.got !== 'done') {
      /* The words stay in the box. A refusal a member can act on - too long, one already
         waiting - is one he answers by shortening it or by waiting, and clearing the box under
         him would take away the very thing he is being told about. */
      setAnswer(answered)

      return
    }

    /* WHAT STANDS ON THE PROFILE IS WHAT THE ANSWER SAID, AND AFTER A NEW TEXT THAT IS STILL
       THE OLD ONE. `MeWriteApi.Changed`: „the text STANDING ON THE PROFILE, which is never the
       one this request sent: a new one waits for a moderator and the profile goes on carrying
       the approved words". Folded in from `asked`, this panel would tell the member his
       unapproved words were already his profile - the very thing the queue exists to stop,
       arriving through the screen instead of through the table. */
    const nowStanding = standingTextIn(answered.body)

    if (nowStanding !== null) {
      setStanding(nowStanding)
    }

    /* AND WHETHER ANYTHING OF HIS IS WITH A MODERATOR, which is read the same way whether or
       not THIS request put it there - so a member who has just removed his words while an
       older proposal is still undecided is told the truth about both. */
    const row = waitingIn(answered.body)

    setSent(row === null ? null : { row: String(row), body: asked })

    /* WHICH RESOURCE STOPPED BEING TRUE, and the two roads spoil different ones.

       A new text writes a row into the queue (`MeWriteApi.queued`), so the moderator who had
       already opened Verifikacija in this visit would never see it: `data/client.ts` fetches a
       resource once per visit. That is `ProfilePicture.tsx`'s own line, for the same table.

       A removal writes `competitor.bio`, which `/api/competitors` carries on every row, so the
       profile this visit is holding would go on drawing words the member has taken down.

       Narrowed to the one resource each road really spoils: nothing else about this visit went
       stale. */
    clearResourceCache(asked === '' ? 'competitors' : 'verification')

    setAnswer(answered)
    setJustSent(true)
  }

  return (
    <section className="member__panel" aria-labelledby="settings-bio">
      <h2 className="profile__section" id="settings-bio">
        {t('bio.title')}
      </h2>

      {waiting === undefined ? (
        <>
          <p className="member__note">{t(standing === '' ? 'bio.none' : 'bio.standing')}</p>

          <div className="rankings__field rankings__field--wide">
            <AskedLabel id="settings-bio-box" asked={false}>
              {t('profile.bio')}
            </AskedLabel>
            <LongBox
              id="settings-bio-box"
              value={written}
              maxLength={limitOf(registracija, 'bio')}
              leftId="settings-bio-left"
              /* The count, read on the way into the box rather than found by
                 hitting the end of it. `LongBox` draws it `aria-hidden` and says
                 so in its own comment: pointing at it is the caller's business,
                 and the caller that forgets it leaves a member who cannot see the
                 screen with a limit they meet only as a wall (WCAG 2.2 SC 3.3.2).
                 Written the same way as the comment box on an event, which is the
                 other hand-made `LongBox` on the portal (pages/event/RateEvent.tsx).

                 The rule that stood beside it went out on 31.08.2026 with the last
                 three of its kind, and its id went out of this list with it: a
                 description pointing at an element that is not there is read as
                 nothing at all, silently, and no test that reads text can see it. */
              aria-describedby="settings-bio-left"
              onChange={(value) => {
                /* The confirmation goes the moment anything moves: „Sačuvano." left standing
                   over a box being edited says the thing on the screen is what the server
                   holds, which it is not (`PersonalData.tsx` keeps the same rule). */
                setJustSent(false)
                setAnswer(null)
                setWritten(value)
              }}
            />
          </div>

          <p className="member__actions">
            {/* Told off rather than switched off, as everywhere else on the
                portal: `disabled` takes the button out of the tab order and
                takes the reason it stands for with it. Which is why the second
                press is refused in the handler as well, off a ref: `aria-disabled`
                is a thing said to a reader and not a thing the browser enforces,
                so without the ref a member who presses twice puts two texts in
                front of a moderator, and the route answers the second 409. */}
            <button
              type="button"
              className="button button--primary"
              aria-disabled={same || sending}
              aria-describedby={same ? 'bio-waits' : undefined}
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

          {same && (
            <p id="bio-waits" className="rate__hint" role="status">
              {t(standing === '' ? 'bio.writeFirst' : 'bio.changeFirst')}
            </p>
          )}

          {/* A REMOVAL TOOK EFFECT, which is the one thing this panel does that needs nobody's
              approval, so it is said the way the portal says every immediate save. The
              sentence is `PersonalData.tsx`'s own („Sačuvano."), reused rather than written
              again, which is the shape `WHEN_LEAVING_A_TEAM` already keeps for a fact the
              portal states in one place: a second sentence for one fact is the portal saying
              one thing on one screen and another here. */}
          {removed && (
            <p className="member__note" ref={said} tabIndex={-1} role="status">
              {t('account.saved')}
            </p>
          )}

          {/* What the server said, in its own reason's words, under the control it answers.
              `WHEN_CHANGING_MY_DATA` is the table of `PUT /api/me`'s eight refusals, held to
              the Java source by `myAccount.test.ts`. Two of them are this panel's own -
              `theTextIsTooLong` and `aTextAlreadyWaits` - and the other six are answered
              because the route names them and a request that goes round this screen meets the
              route with nothing in between. */}
          {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_CHANGING_MY_DATA} />}
        </>
      ) : (
        <>
          {/* Nothing to press while one is waiting: the member has already
              asked, and a second ask gives a moderator two texts of one person
              and no question to answer.
           *
              Focus is moved here and the reader is therefore told by landing on
              it; `role="status"` is the belt beside that brace, for the case
              where focus does not arrive because something took it first. It is
              deliberately not measured: a test that reads an attribute proves
              the attribute is written, not that anything is announced, and the
              thing worth measuring is where the focus goes, which
              `profileBio.test.tsx` does hold. */}
          <p className="member__note" ref={said} tabIndex={-1} role="status">
            {t('bio.waitingNote')}
          </p>

          {/* What was sent, so somebody who cannot remember what they wrote does
              not have to guess while it is out of their hands.

              Drawn only where this panel really saw the words. A row the route named after a
              REMOVAL is an older proposal of his that this visit never carried, and an empty
              paragraph would say the text had been lost rather than that it was never here -
              which is `ProfilePicture.tsx`'s own reason for the same guard over the picture. */}
          {waiting.body !== '' && <p className="pending__body">{waiting.body}</p>}
        </>
      )}
    </section>
  )
}
