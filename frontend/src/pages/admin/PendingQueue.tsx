import { useRef, useState } from 'react'
import { tim } from '../../forms/definitions'
import { limitOf } from '../../forms/records'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { combinePair, dataOr, failed, useCompetitors, useTeams } from '../../data/useResource'
import { Stars } from '../../components/Stars'
import { commentFrom } from '../../data/comment'
import { afterJoining } from '../../data/afterJoining'
import { transfersTakeEffect } from '../../data/season'
import { RATING_MARKS } from '../../data/types'
import type { EventRating } from '../../data/types'
import { formatNumber, formatShortDate } from '../../i18n/format'
import { overall, rated } from '../event/overall'
import countries from '../../data/countries.json'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { askTheServer, type Answer } from '../account/askTheServer'
import { WhatTheServerSaid } from './WhatTheServerSaid'
import { clearResourceCache } from '../../data/client'
import { aRefusal, anApproval, decisionPath, photoPath } from './verificationWrites'
import { usePending, WAITING, waitingIn } from './pending'
import { recordKey } from '../../session/context'
import type { PendingItem, Team } from '../../data/types'
import { idFor, MEMBERS, recordsOf, TEAMS } from './entityForms'
import {
  addressesAgainst,
  addressesIn,
  addressOf,
  isChange,
  organisers,
  proposed,
  refusal,
  teamFrom,
} from './teamProposal'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useOverlay } from './overlay'
import { QueueMeta } from './QueueMeta'
import { canSendBack, outcomeFor, returned, type Queue } from './queues'
import { SendBack } from './SendBack'
import { Swept } from './Swept'
import '../member/Member.css'
import './Verification.css'

/* One screen for three queues: new teams, racing profiles and comments. Four
 * until PDL P10a, 22.09.2026 took the reported changes of date away, „Redova je
 * pet, ne šest"; five before that, until 24.08.2026, when the proposed leagues
 * left, because a league is made by the Administrator and nobody proposes one
 * (owner).
 *
 * One screen rather than three because the work is the same work every time. The
 * moderator reads a piece of text somebody wrote, and then decides what becomes
 * of it. What differs is the word for the text and what the decision other than
 * "yes" is, and neither of those is a screen.
 *
 * That last one is the only difference the moderator can feel, and there are three
 * of them (queues.ts, PDL P22). Two queues go their own way: a comment is
 * deleted on the spot, and a picture goes back with an instruction precise enough
 * to work from. Everything else, the biography among them since 06.08.2026, is
 * refused with a reason and handed back.
 * Which of the three a queue is comes off the queue itself, so it is one fact in
 * one place rather than the name of a queue tested here.
 *
 * Cards rather than a table, unlike the queue of results. There the work is
 * comparison down a column of thirty; here it is reading one thing at a time, and
 * a biography of three and a half thousand characters has no column it fits in.
 */

/**
 * Whether this item lives only in this visit's session and has no row on the
 * server at all, unlike everything else this screen decides on.
 *
 * Its id says so on its own construction: `session/SessionProvider.tsx`'s
 * `propose` mints `prop-${n}` for a row nothing has served, which is how
 * `EditTeam.tsx`, `ProfileBio.tsx` and `ProfilePicture.tsx` all put a card here
 * before a route exists to carry what they collect (crop, free text, a changed
 * town) to the server. `pending.ts` merges those straight into the same list
 * `usePending` serves everything else through, so a card drawn from `prop-1`
 * and a card drawn from `ver-tim-1` are, by the time this screen sees them,
 * the same shape asking the same buttons for a decision.
 *
 * **Why a decision on one of these cannot be sent to the route that decides
 * everything else.** `POST /api/verification/{id}/decision` reads the address
 * as `@PathVariable long id` (`VerificationWriteApi.decide`), so `prop-1` is
 * not a request the route refuses, it is one the address cannot even carry -
 * the framework never reaches the method body. Until a route exists to receive
 * what one of these three screens collects, a proposal is decided the way this
 * whole screen decided everything before server-recorded decisions existed:
 * locally, and at once (`approveAll`, `handBack` below both read this before
 * asking the server anything).
 */
function isProposal(id: string): boolean {
  return id.startsWith('prop-')
}

/** Whether a queue has a second decision that hands the work back to its
 *  author. Four of the five, and both sorts on the racing profile: a text is
 *  refused with a reason and a picture with an instruction precise enough to
 *  work from. The comments are the one exception, deleted rather than returned
 *  (queues.ts). Said as "five plus the pictures" until 15.08.2026, which was
 *  true while a biography was published rather than refused. */
function handsBack(queue: Queue, item: PendingItem): boolean {
  const outcome = outcomeFor(queue, item)

  return outcome === 'sendBack' || outcome === 'instruct'
}

/**
 * The reason approving would do nothing, where there is one.
 *
 * Its own component because it is a line with a rule of its own: it stands in
 * the document whether or not there is a reason, since a live region that
 * arrives with its words is one nobody is told about (Verification.css keeps it
 * out of the row while it is empty).
 *
 * Announced rather than merely drawn, and named by the button it explains. A
 * moderator correcting a name watches the reason appear and disappear as they
 * type; one reading the screen through a reader got neither that nor an answer
 * when they pressed. `role="status"` says it as it changes, and the button
 * points at it, so the reason is read out on the way to pressing rather than
 * after nothing happens (WCAG 2.2 SC 3.3.1 and 4.1.3).
 */
function Refused({ why, id }: { why: string | null; id: string }) {
  const { t } = useI18n()

  return (
    <p className="pending__blocked" id={id} role="status">
      {why === null ? '' : t(why)}
    </p>
  )
}


/**
 * A card the route would not settle, and what it said about it.
 *
 * <p>Carried with the item's identity rather than on its own, because the sentence
 * belongs on the card it is about: the sweep asks about forty and the one that was
 * refused is still among them, so a sentence drawn anywhere else would be a reason
 * beside the wrong picture.
 */
type ServerRefusal = { id: string; answer: Exclude<Answer, { got: 'done' }> }

/** The three marks a comment carries, as they are read everywhere else: not a
 *  control, and each one says its number in words for anybody who cannot see the
 *  stars (components/Stars.tsx). */
function RatingGiven({ rating }: { rating: EventRating }) {
  const { locale, t } = useI18n()

  return (
    <dl className="pending__marks">
      {RATING_MARKS.map((mark) => (
        <div key={mark}>
          <dt>{t(`event.rating.${mark}`)}</dt>
          <dd>
            <Stars label={t(`event.rating.${mark}`)} value={rating[mark]} />
          </dd>
        </div>
      ))}
      <div>
        <dt>{t('event.rating.overall')}</dt>
        {/* The same words the event page uses for a rating nobody gave
            (EventComments.tsx). Two screens showing one record must not answer
            "Bez ocene" and "0,0" to the same question. */}
        <dd className="pending__overall">
          {rated(rating) ? formatNumber(overall(rating), locale, 1) : t('event.rating.unrated')}
        </dd>
      </div>
    </dl>
  )
}

/**
 * THE PICTURE A MODERATOR IS DECIDING ABOUT, on whichever queue row still holds one.
 *
 * <p><b>Gated on `photoId`, never on `kind`.</b> `kind === 'photo'` is worked out on
 * the server for the racing profile tab alone (`VerificationApi.Waiting.kind`'s own
 * doc: "a profiles row is a picture exactly when it still holds one and a biography
 * otherwise") and says nothing about a proposed team's logo, which the same schema
 * carries through the identical `photo_id`. `photoId` is answered for every queue
 * alike, so this is the one fact that is true of a picture whichever tab it stands in.
 *
 * <p><b>Recorded rather than built: no case here walks a team row with a logo,
 * because nothing produces one yet.</b> `pages/member/EditTeam.tsx` proposes a team
 * with `picture: ''` always and no upload of its own, so a `teams` row carrying a
 * real `photoId` is a state the schema allows and today's screens never reach. This
 * component does not special-case the queue away regardless, because the day a team
 * logo upload lands this is exactly the behaviour it should already have; a test
 * manufacturing that state now would be measuring itself and not the portal
 * (`CLAUDE.md`, "mutacija koja mora da... nije mutacija", the class of finding it
 * warns against).
 *
 * <p><b>A plain `<img>`, and never `CropWindow`, and that is a decision the owner
 * has since taken the other way for a branch of its own.</b> PDL.md, "28. Moderator
 * vidi ISECAK sa zatamnjenim ostatkom" (owner, 27.09.2026), confirms and sharpens
 * the 12.08.2026 decision this paragraph used to read as unmet: the moderator sees
 * the crop with its remainder dimmed but still perceptible, not the whole
 * photograph this card draws today. Drawing that needs `/api/verification` to
 * carry the crop's three fractions beside the picture, which this branch's route
 * does not - so drawing the crop is its own increment, and the whole photograph
 * drawn here in the meantime is a temporary stand-in rather than a decision of
 * this component's own. It stands in because it is strictly better than the
 * "Datoteka" label with nothing under it this branch replaces (owner, 27.09.2026:
 * "Svakako uradi sta god je potrebno da moderator vidi sliku koju verifikuje"),
 * not because the question of what he should see was ever open - it no longer is.
 * `PhotoApi.waitingOn`'s own comment still answers the WHOLE original and nothing
 * about the crop - "the circle is the MEMBER's choice over his own picture... not
 * part of the one being taken here" - and `VerificationApi.Waiting` carries no
 * `crop` field at all today, which is exactly what the branch that draws the crop
 * has to add. Drawing `CropWindow` here regardless would mean feeding it
 * `one.crop`, which is always `WHOLE` for a server row (`ABSENT.crop` in
 * `./pending.ts`) and would show a generic centred circle as though it were the
 * member's own choice, which it is not.
 *
 * <p><b>A failed load says so rather than hiding the picture or drawing a broken
 * image icon, since PDL.md "29. Slika koja ne moze da se ucita" (owner,
 * 27.09.2026).</b> `GET /api/verification/{id}/photo` answers 404 to a moderator
 * with no right over this row and to a row whose file went missing under it,
 * indistinguishably and on purpose (`PhotoApi.waitingOn`'s doc, ADL A8) - so there
 * is nothing here to tell those two apart, and nothing here tries: both draw the
 * identical sentence. A row with no `photoId` at all is a different state and
 * stays silent exactly as before - it never had a picture to fail, so there is
 * nothing to report missing.
 *
 * <p><b>`broken` is a prop and never state of its own, unlike before this
 * decision.</b> The Approve button beside this card has to read the identical
 * fact this paragraph draws a sentence about - it is disabled while a picture
 * cannot be seen, per the same owner decision - and a second copy of "did this
 * load" kept here could disagree with the parent's copy (`CLAUDE.md`, "Dva izvora,
 * jedna vrednost"). `PendingQueue`'s own `brokenPictures` is the one place this
 * fact is decided; this component only reports a load failure up through
 * `onBroken` and draws whatever `broken` says.
 *
 * <p><b>The alt text is the dictionary's own call and never a string built here.</b>
 * `data/theRealAnswer.test.tsx`'s guard against this exact frame returning unfed is
 * tied to that literal call - measured to survive a frame whose `alt` is read off
 * the row instead (`one.subject`, `one.who`) rather than through `t('verification.
 * pictureAlt', ...)` - so this reads the key by name rather than composing an
 * equivalent sentence that would satisfy the guard without answering it. Shortened
 * to "Slika koju je poslao {who}" on 27.09.2026, the day this component stopped
 * drawing a crop and the framed part it used to promise stopped being true; PDL.md
 * "28." above means it goes back to naming that framed part the day the branch
 * that draws the crop replaces this component's picture, and not one day before.
 */
function WaitingPicture({
  item,
  broken,
  onBroken,
}: {
  item: PendingItem
  /** Whether this row's picture has already failed to load once, read off
   *  `PendingQueue`'s own `brokenPictures` rather than kept here. */
  broken: boolean
  /** Reported once, the moment `<img onerror>` fires: a 404, a redirect
   *  nowhere, a file the browser cannot decode. Not asked to say which,
   *  the same way the sentence this draws does not either. */
  onBroken: () => void
}) {
  const { t } = useI18n()

  if (item.photoId === null) {
    return null
  }

  if (broken) {
    return (
      <p className="pending__unavailable" id={`${item.id}-picture-unavailable`}>
        {t('verification.pictureUnavailable')}
      </p>
    )
  }

  return (
    <img
      className="pending__picture"
      src={photoPath(item.id)}
      alt={t('verification.pictureAlt', { who: item.who })}
      onError={onBroken}
    />
  )
}

/**
 * The three things a team is made of, changeable before it is made.
 *
 * The owner asked for it in the same breath as the approval itself: whoever
 * decides "may or may not change the team's data, and if they accept it" the
 * member is told (PDL P13, 03.08.2026). A name, a town and a country arrive as
 * the member typed them and the team carries them from then on, so the moment to
 * put a lower-case name right is before the record exists rather than after.
 *
 * Written into the same overlay of edits, keyed by the item,
 * so approving reads whatever is on screen rather than what arrived.
 */
function TeamFields({ item }: { item: PendingItem }) {
  const { t } = useI18n()
  const { edits, edit } = useSession()

  const value = (field: 'name' | 'city' | 'country') =>
    String(edits[recordKey(WAITING, item.id)]?.[field] ?? proposed(item)[field])

  return (
    /* All three are obligatory in the definition a proposed team is saved
       against (`admin-tim.form.json`), so all three say so the way every field on
       the portal says it (forms/AskedLabel.tsx). The ids carry the row, because
       a queue draws these three once per proposal and an id written twice names
       the wrong box. */
    <div className="pending__fields">
      <div className="rankings__field">
        <AskedLabel id={`team-name-${item.id}`}>{t('admin.field.teamName')}</AskedLabel>
        <input
          id={`team-name-${item.id}`}
          type="text"
          value={value('name')}
          aria-required="true"
          maxLength={limitOf(tim, 'name')}
          onChange={(event) => edit(recordKey(WAITING, item.id), 'name', event.target.value)}
        />
      </div>

      <div className="rankings__field">
        <AskedLabel id={`team-city-${item.id}`}>{t('admin.field.city')}</AskedLabel>
        <input
          id={`team-city-${item.id}`}
          type="text"
          value={value('city')}
          aria-required="true"
          maxLength={limitOf(tim, 'city')}
          onChange={(event) => edit(recordKey(WAITING, item.id), 'city', event.target.value)}
        />
      </div>

      <div className="rankings__field">
        <AskedLabel id={`team-country-${item.id}`}>{t('admin.field.country')}</AskedLabel>
        <select
          id={`team-country-${item.id}`}
          value={value('country')}
          aria-required="true"
          onChange={(event) => edit(recordKey(WAITING, item.id), 'country', event.target.value)}
        >
          <option value="">{t('form.choose')}</option>
          {/* The region first and named, like every other choice of country on
              the portal (FormRenderer): nine members in ten pick one of these,
              and a flat list of two hundred and fifty is a list nobody reads. */}
          <optgroup label={t('form.region')}>
            {countries.region.map((one) => (
              <option key={one.code} value={one.code}>
                {one.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('form.restOfWorld')}>
            {countries.rest.map((one) => (
              <option key={one.code} value={one.code}>
                {one.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  )
}

export function PendingQueue({ queue }: { queue: Queue }) {
  const { locale, t } = useI18n()
  const { close, create, creations, decisions, editRecord, edits, invitations, notify, publish, settle } =
    useSession()
  const overlay = useOverlay()
  /* The message carries the day the portal is being read as, so a walk through
     a simulated October is dated in October and not in the day it was walked. */
  const today = useToday()
  const waitingId = `waiting-${queue.id}`
  /** Which card has its reason field open. One at a time, as in the results. */
  const [open, setOpen] = useState<string | null>(null)
  /**
   * The card whose reason box has just been closed, so its buttons take the
   * focus back as they return.
   *
   * The box replaces the buttons of its own card, so both directions lose the
   * focus to the document: opening it takes the button that had it off the page,
   * and closing it takes the box. The focus then sits nowhere and the next Tab
   * starts the page from the top, past everything. Opening is answered inside the
   * box itself, which takes the focus as it appears (SendBack); this is the way
   * back. A panel in the header has the same problem and the same answer
   * (src/app/Dropdown.tsx).
   *
   * <p>Closed by the moderator („Odustani") or by the answer to what the box sent, a refusal
   * as much as a success (`putTheBoxAway`): the answer takes the box away as surely as he does,
   * and the focus goes to the same place.
   */
  const [closed, setClosed] = useState<string | null>(null)
  /** How many the last sweep settled, and null until there has been one. */
  const [swept, setSwept] = useState<number | null>(null)
  /**
   * The one card the route last refused, and what it said.
   *
   * One rather than a list, and that is a boundary written down rather than an
   * oversight. A sweep of forty can meet forty refusals; what it reports is the
   * number it settled, which is the contract that line already had for a proposal
   * whose name was taken. The sentence is shown for the first of them, on the card
   * it is about, and the other refused cards are still in the queue to be pressed
   * one at a time - which is how the moderator reads the rest of the reasons.
   */
  const [said, setSaid] = useState<ServerRefusal | null>(null)
  /** Which card is open, on the width where they are folded. One at a time: two
   *  open cards on a telephone are the scrolling this was meant to end. */
  const [shown, setShown] = useState<string | null>(null)
  /**
   * Whether a walk is out with the route, so a second press before the first
   * has answered cannot start another one over the same items.
   *
   * A ref rather than the state beside it, exactly the way `ProposeTeam.tsx`
   * guards its own send against a second press before the first has answered:
   * state set inside the walk is not yet visible to a second click fired
   * before the render it would cause, and two clicks fired without waiting
   * are exactly what a double press or an impatient second try both are.
   * Checked by both doors that can start a walk - the sweep and a single
   * card's own button - so a press on either while the other is still out is
   * caught the same way; neither knows or needs to know which one is running.
   */
  const outstanding = useRef(false)
  /**
   * The same fact as a render can see, so the two buttons that start a walk
   * can say they are inert while one is out - the way this screen already
   * says a button cannot act (`aria-disabled`, beside `decisionUnknown` and
   * `why` below). No sentence of its own the way `ProposeTeam.tsx`'s
   * `sending` has one: the dictionaries this screen reads are held by other
   * branches this round, and this file already has a way to say a control
   * cannot act without asking either for a new line.
   */
  const [deciding, setDeciding] = useState(false)
  /**
   * THE CARDS WHOSE REFUSAL IS OUT WITH THE ROUTE, as a render reads it, and `handingBackNow` as a press
   * reads it: ONE FACT IN THE TWO LIFETIMES A FACT HAS HERE, written at exactly one place
   * (`markHandingBack`) to the identical value, the way `brokenPictures` and `brokenPicturesRef` are.
   * The state is for the box that sent the refusal, to say so and to tell its buttons off
   * (`SendBack`, `working`); the ref is for the press, because a second press can arrive before the
   * render the state would cause.
   *
   * <p><b>The cards, and not a flag and not `outstanding`.</b> `deciding` above is true for a whole
   * sweep, and a box open on another card has nothing of its own out: told off for the sweep's work it
   * is a box that says it cannot act. The first version of this guard asked `outstanding` while the
   * display asked the card, and that disagreement is the fault the review of 02.10.2026 measured: a
   * box opened while „Odobri sve" was out read live and sent NOTHING when pressed, and the sweep then
   * reached that card and approved what the moderator had just refused. The press and the display ask
   * this one set; neither asks the walk.
   */
  const [handingBack, setHandingBack] = useState<ReadonlySet<string>>(new Set())
  const handingBackNow = useRef<ReadonlySet<string>>(new Set())
  const markHandingBack = (now: ReadonlySet<string>): void => {
    handingBackNow.current = now
    setHandingBack(now)
  }
  /**
   * Which rows' pictures have failed to load, so the Approve button beside a
   * broken photograph can read the identical fact `WaitingPicture` already
   * draws a sentence about (PDL.md, "29. Slika koja ne moze da se ucita",
   * owner 27.09.2026).
   *
   * Lifted up rather than left as `WaitingPicture`'s own state, on purpose: a
   * fact two places would otherwise carry separately is a fact that can
   * disagree, and the button needs the same answer the picture already gave,
   * not a second guess at it worked out from different props.
   *
   * Read by the render below to decide what to draw - the sentence, the
   * `aria-disabled` on this card's own button - and by nothing that runs
   * outside this render's own lifetime. `brokenPicturesRef` beside it is that
   * second thing.
   */
  const [brokenPictures, setBrokenPictures] = useState<ReadonlySet<string>>(new Set())
  /**
   * THE SAME SET, ANSWERED LIVE rather than as of the render that started
   * whoever is asking.
   *
   * <p><b>Why a render-time read of `brokenPictures` is not enough for
   * `approveAll`.</b> Its walk is one server round trip per item and can be
   * several seconds into a sweep by the time a LATER row's picture fails - a
   * closure over `brokenPictures` from the render that started the walk
   * answers with what had failed WHEN THE WALK BEGAN, not now. Measured
   * rather than assumed: a picture that broke while the walk was parked on an
   * earlier row's `await` was still approved, because that walk's own copy of
   * `brokenPictures` never moved. `outstanding` above is the identical fix
   * for the identical shape of problem, a fact an async walk has to read live
   * rather than close over.
   *
   * <p><b>And why the single card's own `onClick` reads this too, not
   * `pictureUnavailable`.</b> `approveAll` reports what it settled through
   * `sayIt` UNCONDITIONALLY, including "nothing" when every item it was
   * handed was skipped - so a press that starts a walk over one row this
   * portal already knows cannot be decided would clear whatever OTHER card's
   * refusal `sayIt` last set, a row that did nothing overwriting a sentence
   * about a row that did. Refusing to start that walk at all, off the same
   * live answer the walk itself would use, is what keeps `approveAll` and
   * the button that calls it from ever disagreeing about this row - one live
   * fact asked in two places, not two facts that happen to usually agree.
   *
   * <p>Kept in step with `brokenPictures` at the single place either of them
   * changes (`onBroken` below) rather than derived from it on each read,
   * which would be the closure problem this exists to avoid, moved one line
   * over.
   *
   * <p><b>WHAT THIS DOES NOT CLOSE, MEASURED RATHER THAN ASSUMED.</b> A row's
   * OWN picture failing WHILE that row's OWN single-card `approveAll([one],
   * teams)` is awaiting the SAME row's `askTheServer` cannot be caught here,
   * by any reading of any variable: the `onClick` guard and the loop's own
   * skip both run - and must both have already passed, or the walk would
   * never have reached the `await` at all - before `askTheServer` is called,
   * so by the time a picture could fail "during" that one call, this row's
   * decision has already left for the server. Measured directly: a request
   * held on a controlled `Promise` already appears in a `serverThat` harness's
   * `asked` the instant a click resolves, before any later line in the same
   * test can fire the picture's own `error` event. Nothing after the `await`
   * re-asks this ref either, and it should not: PDL P28f has the server
   * showing an approved picture "tog trenutka", so a `done` answer already
   * means the server acted on it, and skipping `settle` here would leave the
   * screen behind what the server has already recorded rather than ahead of
   * a race it could still have won. Closing this - if it needs closing at
   * all, given how narrow the window is even in a real browser - is a
   * question for the server that answers `askTheServer`, not for a client
   * that has already asked it and cannot unask.
   */
  const brokenPicturesRef = useRef<ReadonlySet<string>>(new Set())
  /* The teams as well, for one rule: a name already in the league cannot be
     taken by a proposal (PDL P13). Read through what this visit has entered, so
     two proposals of the same name in one sitting cannot both go through. */
  const state = combinePair(usePending(), useTeams())
  /* The members, for the one rule a team proposal cannot be decided without:
     a member is in one team at a time (PDL P13), so a proposal from somebody who
     already has one cannot be approved. Read through the overlay like everything
     else, because the team a member got a minute ago in this same visit is in
     there and nowhere else. */
  const membersState = useCompetitors()
  const allMembers = recordsOf(MEMBERS, dataOr(membersState, []), overlay)

  /**
   * Why no decision can be taken on this queue just now, or nothing.
   *
   * Only the queue of teams, and only for the members: approving a proposal
   * without them would make a second team for somebody who already has one, and
   * nothing brings that back.
   *
   * Two states and not one, because `dataOr` answers the same for a file on its
   * way and one that failed. Told to wait for something that will never come, a
   * moderator who holds the right is refused it for good and reads a sentence
   * that is not true (AdminEvents does the same thing for the same reason).
   *
   * The schedule queue asked the identical question of the races and the events
   * until PDL P10a, 22.09.2026 took the queue itself away: „Redova je pet, ne
   * šest." What answered it, `verification.racesFailed` and
   * `verification.waitingForRaces`, left the dictionary the same day nothing here
   * asked for them any more.
   */
  const whyNoDecision =
    queue.id === 'teams' && membersState.status !== 'ready'
      ? failed(membersState)
        ? t('verification.membersFailed')
        : t('verification.waitingForMembers')
      : null
  const decisionUnknown = whyNoDecision !== null

  /**
   * Approving, one item or forty, with everything the next one has to know.
   *
   * Written as a walk rather than as a call per item, and that is the whole
   * point of it. What a team may be called and what identity it gets are both
   * read out of the session, and the session does not change while a loop runs:
   * called forty times in one click, every team was handed the same identity,
   * and two proposals renamed to the same thing both went through. Both are
   * faults this portal has met before, on the member numbers, and the answer is
   * the same one (memberNumbers.ts): carry what has been given out along with
   * the walk.
   *
   * What it returns is what was actually settled, which is not always what it
   * was asked to settle: a proposal whose name is taken is left standing, so the
   * line under the button has to say the smaller number or it says one the queue
   * disagrees with.
   *
   * <p><b>It also leaves the sentence the route refused with on screen, and clears
   * it when a press succeeds.</b> Written here rather than returned for the two
   * callers to set, because both would set it identically and the one that forgot
   * would leave a moderator reading a refusal about a card he has since settled.
   *
   * <p><b>The walk is sequential and the `await` inside it is deliberate.</b> Every
   * reason this is a walk rather than a call per item is a reason the calls cannot
   * overlap: the identities, the addresses and who is in a team are carried forward
   * from one turn to the next, so a turn that started before the one before it
   * finished would be handed a list that is out of date. Fired off together they
   * would also reach the route together, and two approvals of one member's two
   * proposals are exactly what the carrying exists to stop.
   */
  const approveAll = async (items: PendingItem[], teams: Team[]): Promise<number> => {
    /* NEITHER DOOR THAT CALLS THIS MAY OPEN A SECOND ONE WHILE THIS WALK IS OUT.
       Set before anything below awaits anything, so a second press - the sweep
       again, or a single card, whichever door it comes through - reads this as
       true before it can carry a second copy of `identities`, `addresses` and
       `inATeam` past the point where the first walk's own copies stop being the
       whole truth. Reset in `finally` rather than after `return`, so a route
       that rejects outright still lets the next press in. */
    outstanding.current = true
    setDeciding(true)

    try {
      /* Everything already spoken for, growing as the walk hands more out. */
      const identities = (creations[TEAMS.id] ?? []).map((row) => row.id)
      const addresses = addressesIn(teams)
      /* Who is in a team already, growing as the walk puts people into the ones it
         makes. Read once and carried, for the same reason the identities and the
         addresses are: the session does not change while a loop runs, so two proposals
         from one member approved in one press would both go through. */
      const inATeam = organisers(allMembers, teams)
      const refusals: ServerRefusal[] = []
      let done = 0

      for (const one of items) {
        /* PDL.md "29. Slika koja ne moze da se ucita" (owner, 27.09.2026): the
           same rule the single card's own Odobri already carries - „gledanje
           je uslov odobravanja" names a condition on the ACT of approving, not
           on one button, so a sweep over many rows is not a second door around
           it. Skipped exactly like a team's own `refusal` two lines down: no
           `done`, no `refusals` entry, nothing removed - the row stays in the
           queue and waits for the picture or a fresh sweep, which is the
           rejected alternative PDL.md names by its cost („krije posao iz reda").
           Read off `photoId === null` never: a row with no picture at all is
           not this decision's business, the same distinction `WaitingPicture`'s
           own doc draws for the single card.

           Read off `brokenPicturesRef`, NEVER off `brokenPictures` the state:
           this walk asks the question again on every turn, sometimes several
           seconds and one `await` apart, and a render-time `brokenPictures`
           closed over when the walk began answers with what had failed THEN,
           not now (`brokenPicturesRef`'s own doc, above). */
        if (brokenPicturesRef.current.has(one.id)) {
          continue
        }

        const made = queue.id === 'teams' ? teamFrom(one, edits) : null

        if (
          made !== null &&
          refusal(made, addressesAgainst(one, teams, addresses), one, inATeam, teams, allMembers) !==
            null
        ) {
          continue
        }

        /* THE SERVER DECIDES, AND NOTHING LOCAL HAPPENS BEFORE IT ANSWERS -
         * EXCEPT FOR A ROW THIS VISIT MADE UP ITSELF, WHICH HAS NO SERVER TO ASK
         * (`isProposal` above).
         *
         * This is the whole of why this increment exists. Until 26.09.2026 the
         * walk began at the `settle` below, so a moderator who approved a
         * photograph watched the card leave the queue while `competitor.photo_id`
         * was never written: the decision lived in the browser and F5 undid it.
         * The owner met it himself on QA (PDL P28f) - „po odobravanju slike ona tog
         * trenutka pocinje da se vidi na svim avatar mestima" - and the route that
         * does the work, `VerificationWriteApi.decide`, had been there all along
         * with nothing calling it.
         *
         * So the order is the order: ask, and write locally only in the branch that
         * ran because the answer said it did. `settle` and everything under it -
         * the team, the membership, the message, the published comment - are
         * consequences of a decision that has been RECORDED, and a consequence of
         * something that did not happen is the fault this replaces.
         *
         * A proposal is the one exception, and it is a boundary rather than an
         * oversight: `decisionPath` addresses `POST /api/verification/{id}/decision`,
         * which reads the id as `@PathVariable long id`
         * (`VerificationWriteApi.decide`), so `prop-1` cannot reach that method body
         * at all. Until a route exists to carry what `EditTeam.tsx`, `ProfileBio.tsx`
         * and `ProfilePicture.tsx` collect, one of their cards is decided the way
         * this whole screen decided everything before this increment: locally, and
         * at once. */
        if (!isProposal(one.id)) {
          const answer = await askTheServer(decisionPath(one.id), anApproval())

          if (answer.got !== 'done') {
            refusals.push({ id: one.id, answer })

            continue
          }
        }

        settle(one.id, {
          status: 'approved',
          /* Nothing to write down. This was what a published biography went out
             as, back when a moderator adjusted the text and published what they
             left; since 06.08.2026 a biography is approved as the member wrote it
             or refused with a reason (PDL P22), so an approval publishes exactly
             what the card showed and there is nothing an approval could record
             that the item does not already say. */
          note: '',
          basis: '',
          memberNumber: '',
        })

        done += 1

        /* What an approval on this queue actually does: the comment goes onto the
           event. Written down at the moment it is let out, because the event page
           is public and must never read this queue to find out (session/context,
           `published`). */
        if (queue.id === 'comments') {
          publish(one.id, commentFrom(one))
        }

        /* The queue of dates used to move the event here on approval, in the same
           overlay the administration writes an edited event into (owner,
           06.08.2026). PDL P10a, 22.09.2026 removed the queue rather than leaving
           a second road to the one thing `EventWriteApi` already does from the
           event's own screen: „Redova je pet, ne šest." */

        if (made === null) {
          continue
        }

        /* A change writes into the team it is about; only a proposal makes one
           (owner, 04.09.2026). The address goes with the name, because that is what
           the team entity itself derives it from (`entityForms.ts`, TEAMS), so a
           team renamed here answers where the administration's own form would leave
           it rather than at the address of its old name.

           What is not written is who administers it: that is worked out from the
           roster (`data/teamAdmin.ts`), and a change is the administrator's own act
           so there is nothing to move. */
        if (isChange(one)) {
          addresses.push(addressOf(made.name))
          editRecord(recordKey(TEAMS.id, one.subjectId), { ...made, slug: addressOf(made.name) })

          notify({
            from: t('app.name'),
            to: one.memberNumber,
            subject: t('verification.teamChangeAccepted', { name: made.name }),
            body: t('verification.teamChangeAcceptedBody', { name: made.name }),
            date: today,
          })

          continue
        }

        const id = idFor(TEAMS, {}, identities, [])

        identities.push(id)
        addresses.push(addressOf(made.name))

        create(TEAMS.id, id, {
          ...made,
          organizerMemberNumber: one.memberNumber,
          /* **The picture does not survive the approval, and that is a limit
             rather than a decision.** What stands in for a database until F5 is an
             overlay of text (session/context.ts): a crop is three numbers and
             cannot go into it without being written a second way, and nothing
             anywhere reads a created team's logo back. No public screen reads the
             overlay at all (entityForms.ts) and the administration draws no mark,
             so a line carrying the picture here is a line no test can reach and
             no reader can see. A review measured exactly that: with the line in
             place, deleting it left all 1888 tests passing.
           *
             So nothing about the picture crosses this point until F5, said once
             rather than half done. The moderator still judges the square the
             member chose, on the card above, which is what the owner asked for
             (12.08.2026). Written down in PENDING. */
        })

        /* **And the member who asked for it is in it.** Owner, 05.09.2026: „Odmah
           ulazi u tim... on ce biti prvi i jedini clan u tom trenutku." Until then an
           approval wrote the organiser onto the team and nothing onto the member, so
           the founder was in no team at all and could found a second one the same
           minute; that was a high finding of the review of PR 186.

           **From the next season**, because a team founded during the transfer window
           scores nothing until 1 January (owner, same day). `teamSince` is what every
           reader of „was this member in the team that season" asks (`data/derive.ts`,
           `inTeamIn`), so writing next season is what keeps the new team out of this
           season's standing without a second rule to remember.

           Written as text, like everything else in the overlay that stands in for a
           database (session/context.ts). A record read back through the overlay
           carries the season as the digits rather than as a number, which every
           comparison in the portal reads the same way and the database will type
           properly; written down rather than papered over. */
        inATeam.push(one.memberNumber)
        editRecord(recordKey(MEMBERS.id, one.memberNumber), {
          teamId: id,
          teamSince: String(transfersTakeEffect(today)),
        })

        notify({
          from: t('app.name'),
          to: one.memberNumber,
          subject: t('verification.teamAccepted', { name: made.name }),
          body: t('verification.teamAcceptedBody', { name: made.name }),
          date: today,
        })

        /* And the third door into a club owes what the other two owe: every team that
           had invited this member stops waiting on a question that can no longer be
           answered, and is told so. The owner's sentence names the road as „ko god da
           je poslao poziv" (PDL, 06.09.2026), and a founder who was invited elsewhere
           last week is exactly the case it describes. Nothing is kept, because nobody
           accepted an invitation here. */
        const after = afterJoining({
          member: one.memberNumber,
          joined: Number(id),
          keep: undefined,
          invitations,
          teams,
          competitors: allMembers,
        })

        for (const gone of after.close) {
          close(gone)
        }

        for (const to of after.tell) {
          notify({
            from: t('app.name'),
            to,
            subject: t('teams.inviteMissedSubject'),
            body: t('teams.inviteMissedBody', {
              /* Off the member's own record and not off the queue item, which carries the
                 proposal and not the person. Joined rather than taken out of the list, so a
                 member the portal no longer has needs no question of its own. */
              name: allMembers
                .filter((each) => each.memberNumber === one.memberNumber)
                .map((each) => `${each.firstName} ${each.lastName}`)
                .join(''),
              team: made.name,
            }),
            date: today,
          })
        }
      }

      /* THE NEXT MOUNT READS THE SERVER AND NOT THIS VISIT'S FIRST ANSWER, which is the
         shape `admin/AdminLeagues.tsx` already has and the fault its own review found on
         25.09.2026: a decision recorded on the server and fixed only in the local overlay
         is a decision a remounted screen has never heard of, so the card comes back and a
         moderator decides it a second time. `usePending` reads the `verification` resource
         (`admin/pending.ts`), so that is the one cleared.

         Asked of what was SETTLED rather than of what was asked: a sweep the route refused
         outright wrote nothing, and clearing the cache over nothing is a screen throwing
         away an answer it still has every reason to trust. */
      if (done > 0) {
        clearResourceCache('verification')
      }

      /* The first of them, on the card it is about, or nothing where every press went
         through - which is also what takes a sentence about the last press off the
         screen. */
      sayIt(refusals[0] ?? null)

      return done
    } finally {
      /* Read by both doors before they start a walk (above and at the two
         presses below), so the next press - on the sweep or on a single card -
         is let through the moment this one has actually finished, whether it
         returned a number or the route rejected it outright. */
      outstanding.current = false
      setDeciding(false)
    }
  }

  /**
   * THE SENTENCE, AND THE CARD IT IS ABOUT OPENED SO THAT IT CAN BE READ.
   *
   * <p><b>The opening is not a nicety and it was measured against the stylesheet.</b>
   * Below 51.25em a card is a fold - `Verification.css` gives `.pending__card`
   * `display: none` and only `--open` brings it back - and the sentence is drawn
   * inside that card. From one card that is harmless, because the buttons are inside
   * the fold too, so a moderator on a telephone has already opened the card to press
   * anything. <b>The sweep is the one that breaks it:</b> „Odobri sve" sits in the bar
   * outside every card, so a refusal met during a sweep would land inside a card still
   * folded, and the moderator would see the count drop with nothing anywhere saying
   * why.
   *
   * <p>That is the same shape as the fault `admin/verificationStyle.test.ts` was
   * written for - „the line saying what a star means was drawn by the renderer over a
   * screen whose every star the stylesheet had folded away" - so it is answered the
   * same way round: the card the route refused is the one thing the moderator now has
   * to look at, so it opens.
   *
   * <p>Above that width nothing is folded and this changes nothing anybody can see.
   */
  const sayIt = (refusal: ServerRefusal | null): void => {
    setSaid(refusal)

    if (refusal !== null) {
      setShown(refusal.id)
    }
  }

  /**
   * The sweep, which is the same press over everything waiting.
   *
   * <p>Its own function only because the count has to be set from a value that has
   * not come back yet. `onClick` takes `void sweep(...)`, the shape
   * `admin/AdminLeagues.tsx` and `admin/LeagueRaceModeration.tsx` already use for a
   * press that speaks to the server.
   */
  const sweep = async (items: PendingItem[], teams: Team[]): Promise<void> => {
    setSwept(await approveAll(items, teams))
  }

  /**
   * THE BOX GOES WHEN ITS ANSWER COMES, WHICHEVER ANSWER IT IS (owner, 02.10.2026; PDL, „Odbijanje
   * zatvara pitanje kao i uspeh": „na svaki odgovor servera pitanje se zatvara, a razlog odbijanja
   * stoji uz dugme"), and it is THAT CARD'S box and no other's.
   *
   * <p><b>Why „that card's".</b> One box is open at a time, but a refusal can still be out when the
   * moderator opens the box on another card - the first box is replaced and its request goes on - and
   * the answer that comes back for the first must not take the second away with the words he has
   * begun to write in it. A decision the route took used to end in `setOpen(null)`, which closes
   * whichever box is open: the settled card's own box goes with the card, so what that line added was
   * the closing of somebody else's.
   *
   * <p><b>And a success still has to close its own card's box</b>, though the card goes: `open` is
   * read by the line that says what a star means (`starsHere`, off `items` and not off `waiting`), so
   * a box left naming a settled card would keep that line on a queue that has emptied
   * (`adminFlows.test.tsx`, „says nothing about a star on a queue that has emptied").
   *
   * <p>The card is named in `closed` as well, so its buttons take the focus back as they return: on a
   * refusal that is the whole of where the focus goes, because the box that had it has left. The
   * sentence the route gave stands on the card above those buttons (`WhatTheServerSaid`).
   */
  const putTheBoxAway = (one: PendingItem): void => {
    setOpen((now) => (now === one.id ? null : now))
    setClosed(one.id)
  }

  /**
   * HANDING ONE BACK, or deleting it where that is what the queue does to an item
   * it will not take (`queues.ts`, `outcomeFor`).
   *
   * <p>The same order as the approval above and for the same reason: the route
   * records the decision, and only then does anything local happen. A refusal
   * written in the browser alone is the same fault one way round as the other -
   * the card leaves the queue, the member is told his picture was sent back, and
   * `verification.state` still says `waiting`, so the next moderator to open the
   * queue is asked the same question and the member hears twice.
   *
   * <p><b>What the route can refuse this with that an approval cannot:</b> „Uz
   * odbijanje je razlog obavezan." (`A_REFUSAL_NEEDS_A_REASON`). The box already
   * asks for one on every queue but the comments (`SendBack`, `optional`), so a
   * moderator normally never reaches the server to hear it; it is answered all the
   * same, because the box is the floor and the route decides - the same division
   * `leagueWrites.ts` names for the address of a competition.
   */
  const handBack = async (one: PendingItem, reason: string): Promise<void> => {
    /* THE SAME EXCEPTION `approveAll` MAKES, FOR THE SAME REASON: a row this visit
       made up itself (`isProposal`, above `handsBack`) has no server row to ask
       `POST /api/verification/{id}/decision` about, and the address cannot even
       carry an id of this shape (`@PathVariable long id`). Handed back locally,
       exactly as every queue was decided before server-recorded decisions existed. */
    if (!isProposal(one.id)) {
      const answer = await askTheServer(decisionPath(one.id), aRefusal(reason))

      if (answer.got !== 'done') {
        sayIt({ id: one.id, answer })
        putTheBoxAway(one)

        return
      }

      /* For the reason the approval clears it: a decision the server has recorded and
         the overlay has patched is one a remounted screen must read from the server
         (`admin/AdminLeagues.tsx`, review 25.09.2026). Skipped for a proposal along
         with the request above: nothing server-side changed for the cache to be
         wrong about. */
      clearResourceCache('verification')
    }

    sayIt(null)

    settle(one.id, {
      status: 'rejected',
      note: reason,
      basis: '',
      memberNumber: '',
    })

    /* A reason the member never reads is a reason to nobody, and on this queue the
       member is expected to act on it. The portal already has an inbox, so it goes
       there in the words the moderator wrote (PDL P22, P28a).
     *
       Both sorts, since 15.08.2026. It used to be the picture alone, because a
       biography was published rather than refused and had nothing to send; when the
       owner withdrew that (PDL P22, 06.08.2026) the refusal arrived without the
       message, so the empty box went on promising „Član dobija tvoj razlog" and the
       member's inbox stayed exactly as it was. A review measured it: two messages
       before, two after.
     *
       Each under its own heading. Handed the picture's, a refused biography would
       reach the member as „Profilna slika je vraćena", which is a message about a
       thing they did not send. */
    /* Bound once and narrowed, rather than asked twice and coerced. Written as
       `t(String(returned(...)))`, the guard below it could be deleted without the
       compiler saying a word: a review replaced it with `if (true)` and all 1902
       tests passed, while a refusal on any of the other four queues then wrote
       „null" to whoever `memberNumber` named, which where that is empty is the whole
       league. `String()` is not on the list ADL A14 bans, and it lies in exactly the
       way that list exists to stop. */
    const heading = returned(queue, one)

    if (heading !== null) {
      notify({
        from: t('app.name'),
        to: one.memberNumber,
        subject: t(heading),
        body: reason,
        date: today,
      })
    }

    putTheBoxAway(one)
  }

  /**
   * `handBack`, WITH THE GUARD THE BOX NEEDS: one refusal per card at a time, and nothing else is
   * its business.
   *
   * <p><b>What it cost without one, measured.</b> `handBack` kept no record of itself, so a second
   * press on „Odbij uz ovaj razlog" sent a second decision for the same card - the route answered it
   * 409 and the moderator was told his first one had failed - and „Odustani" closed the box over a
   * request that went on (owner, 02.10.2026: „Ne", „Odustani" and Escape do nothing while a request
   * is out). Written round `handBack` rather than into it, so the act and the guard stay two things a
   * reader can tell apart.
   *
   * <p><b>And what the first version of this guard cost, which is why it asks what it asks.</b> It
   * asked `outstanding`, the whole queue's walk, a fact that is about ONE CARD: a refusal out for THIS
   * card. A box opened on another card while „Odobri sve" was out read live (its display asked the
   * card) and sent nothing when pressed (its guard asked the walk), and the sweep then reached that
   * card and approved what the moderator had just refused. Measured by the review of 02.10.2026; on
   * `main` the same press sends the refusal. The press and the display now ask the SAME fact, and the
   * walk's own flags (`outstanding`, `deciding`) are not touched here at all, so a sweep, a card's
   * „Odobri" and a refusal on another card behave exactly as they did before this branch. Nothing
   * new is forbidden, so there is nothing new to explain in words the dictionaries do not have.
   *
   * <p><b>What this does not guard, written down rather than left to be found.</b> A sweep's own
   * request for THIS card: the box opened on the card the walk is asking about can send its refusal
   * beside the approval already out. The route records the first decision it receives for a card and
   * answers the second 409 (`VerificationWriteApi.decide`) and the sentence says so, which is the
   * contract this queue had on `main`.
   */
  const handBackGuarded = async (one: PendingItem, reason: string): Promise<void> => {
    if (handingBackNow.current.has(one.id)) {
      return
    }

    markHandingBack(new Set(handingBackNow.current).add(one.id))

    try {
      await handBack(one, reason)
    } finally {
      markHandingBack(new Set([...handingBackNow.current].filter((each) => each !== one.id)))
    }
  }

  /** What the text on the card is called: the comment, the reason given, the
   *  biography, or the file name of a picture. Off the sort of thing rather than
   *  off the queue where one queue holds two sorts (queues.ts, `outcomeFor`). */
  const bodyLabelFor = (one: PendingItem) =>
    t(queue.id === 'profiles' ? `verification.body.${one.kind}` : `verification.body.${queue.id}`)

  return (
    <div className="member">
      <QueueMeta queue={queue} />

      {/* The name of the queue is in the navigation beside this, marked as the
          screen in view, and in the browser tab. On the screen it was a heading
          and a sentence above the work, pushing the first card down, and the
          moderator arrived here having just read both (owner, 30.07.2026). It
          stays in the markup because a page has to have a name for anyone who
          cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t(queue.labelKey)}</h1>

      <Resource state={state}>
        {([items, listed]) => {
          const teams = recordsOf(TEAMS, listed, overlay)
          /* The addresses once for the screen rather than once per card, and the
             reason for one card off them. */
          const addresses = addressesIn(teams)
          /** The team an item is about, as the list has it now. Nothing for a
           *  proposal, which is about no team yet and carries no id, and nothing for a
           *  change whose team has been deleted since it was sent. Asked of the id
           *  alone: a proposal carries none, so there is no sort to test for and no
           *  branch here that nothing can reach. */
          const teamOf = (one: PendingItem) => teams.find((each) => String(each.id) === one.subjectId)

          const refusedFor = (one: PendingItem) =>
            queue.id === 'teams'
              ? refusal(
                  teamFrom(one, edits),
                  addressesAgainst(one, teams, addresses),
                  one,
                  organisers(allMembers, teams),
                  teams,
                  allMembers,
                )
              : null
          const waiting = waitingIn(items, decisions, queue.id)

          /* Whether a star is on this screen at all, which is what decides the
             one line that says what a star means (forms/AskedLabel.tsx). Asked
             of the two things that draw one and of nothing else:

             - the three fields a proposed team is corrected in, which are drawn
               once per proposal, so an emptied queue has none;
             - the reason a proposal is sent back, which carries a star unless
               the outcome is a deletion, where a note may be left blank. That is
               the whole of the comments queue, and a legend over it said the
               opposite of the truth about the only field on the screen.

             Guessed at instead, from the name of the queue and from whether a
             box was open, it was drawn over a queue with nothing left in it and
             over a field that may be left empty, and taken away while three
             stars stayed. */
          const openItem = items.find((one) => one.id === open)
          const starsHere =
            (queue.id === 'teams' && waiting.length > 0) ||
            (openItem !== undefined && outcomeFor(queue, openItem) !== 'delete')

          return (
            <>
              {starsHere && (
                <div className="pending__legend">
                  <RequiredNote />
                </div>
              )}

              <div className="pending__bar">
                <h2 className="profile__section" id={waitingId}>
                  {t('review.waiting')} <span className="profile__count">{waiting.length}</span>
                </h2>

                {/* One decision for the whole queue (owner, 01.08.2026). It asks
                    first, because there is nothing to undo: approving is what
                    puts a thing on the portal, and a queue of forty approved by
                    a misplaced click is forty things to find again by hand.

                    On the queue of teams it asks how many are waiting and
                    promises no number, because a proposal the sweep cannot take
                    is left standing: promising two and settling one is the same
                    lie in the question that the line under the button was
                    written to avoid. On the other four nothing is ever left
                    standing, so there the question says the number, and a
                    hedge on all four would be a hedge that means nothing. */}
                {waiting.length > 0 && (
                  <button
                    type="button"
                    className="button button--secondary"
                    /* Held back for the same reason one card is: the sweep is
                       the same decision taken forty times, and taken without the
                       members it is forty guesses at whether each one already
                       has a team. And held back while a walk is already out
                       (`outstanding`, `deciding` above), the same as a single
                       card's own button just below: two presses on this one
                       button before the first has answered is the shape that
                       was measured, and a press on this one while a single
                       card's walk is still out is the same race the other way
                       round. */
                    aria-disabled={decisionUnknown || deciding}
                    aria-describedby={decisionUnknown ? `${waitingId}-blocked` : undefined}
                    onClick={() => {
                      if (decisionUnknown || outstanding.current) {
                        return
                      }

                      const ask =
                        queue.id === 'teams'
                          ? 'verification.approveAllAskTeams'
                          : 'verification.approveAllAsk'

                      if (!window.confirm(t(ask, { count: waiting.length }))) {
                        return
                      }

                      /* What it settled, not what it was asked to settle. A
                         proposal whose name is already in the league is left
                         standing, and so is one the route refused, so the count
                         has to be the ones that went through or the line under
                         the button would say a number the queue disagrees with. */
                      void sweep(waiting, teams)

                      /* And whatever card had its reason open goes with them:
                         the sweep may settle the very card that box belongs to,
                         and a box open over a card that is no longer there is a
                         reason waiting to be written about nothing. */
                      setOpen(null)


                    }}
                  >
                    {t('verification.approveAll')}
                  </button>
                )}

                {/* Said once for the whole queue rather than on every card: the
                    same sentence under forty cards is the noise a screen reader
                    reads forty times. */}
                {whyNoDecision !== null && (
                  <p className="pending__blocked" id={`${waitingId}-blocked`}>
                    {whyNoDecision}
                  </p>
                )}

                <Swept count={swept} />
              </div>

              {waiting.length === 0 ? (
                <p className="profile__empty">{t('verification.empty')}</p>
              ) : (
                /* Named after the heading above it. The screen now carries the
                   navigation of the whole section as well (SectionNav), so a
                   list with no name is one of two lists on the screen and
                   neither says which. */
                <ul className="submissions" aria-labelledby={waitingId}>
                  {waiting.map((one) => {
                    /* Worked out once for the card, rather than by the button,
                       by what the button points at, and by the line itself. */
                    const why = refusedFor(one)
                    /* The team this card is about, where it is about one, so the two
                       places that ask do not ask twice. */
                    const about = teamOf(one)
                    /* Read off the state `WaitingPicture` reports into rather than
                       kept a second time here - see `brokenPictures` above and
                       `WaitingPicture`'s own doc for why there is exactly one copy
                       of this fact. */
                    const pictureUnavailable = brokenPictures.has(one.id)

                    return (
                      <li key={one.id} className="submissions__item">
                        <div className="submissions__head">
                          {/* What it will be called if it is taken, not what it
                              arrived as. A moderator who has just corrected a name
                              in the field below should not read the old one at the
                              top of the same card. */}
                          <h3 className="pending__subject">
                            {queue.id === 'teams' ? teamFrom(one, edits).name : one.subject}
                          </h3>
                          {/* And which of the two decisions this is, said on the
                              card rather than left to be worked out from the name
                              (owner, 04.09.2026: „uz oznaku šta je šta"). A new
                              team carries no mark, because a queue called „Novi
                              timovi" is what it is by default. */}
                          {isChange(one) && (
                            <span className="submissions__meta">
                              {/* **Which team**, by the name it carries now. „Izmena
                                  postojećeg tima" said that this is a change and left
                                  the moderator to guess which one: a change of name
                                  put the new name in the heading and the old one
                                  nowhere on the card, so the decision was taken blind
                                  (review, 05.09.2026). Where the team is gone the
                                  card says so instead, and the decision is refused
                                  above for the same reason. */}
                              {about === undefined
                                ? t('verification.teamChange')
                                : t('verification.teamChangeOf', { name: about.name })}
                            </span>
                          )}
                          <span className="submissions__meta">
                            {formatShortDate(one.date, locale)}
                          </span>

                          {/* On a telephone a card is a screenful, so five of
                              them mean scrolling through four to reach the
                              third: the card opens on a press and the rest are
                              a list of names (owner, 06.08.2026). From 51.25em up
                              this control is not drawn and every card is open,
                              exactly as the sectors of the navigation work
                              (SectionNav). */}
                          <button
                            type="button"
                            className="pending__toggle"
                            aria-expanded={shown === one.id}
                            aria-controls={`${one.id}-card`}
                            /* Named after the card it opens: five buttons called
                               "Prikaži" are five controls a screen reader cannot
                               tell apart, which is the rule the rest of the
                               portal keeps. */
                            aria-label={t(
                              shown === one.id
                                ? 'verification.foldCardNamed'
                                : 'verification.openCardNamed',
                              { name: one.subject },
                            )}
                            onClick={() => setShown(shown === one.id ? null : one.id)}
                          >
                            {t(shown === one.id ? 'verification.foldCard' : 'verification.openCard')}
                          </button>
                        </div>

                        <div
                          id={`${one.id}-card`}
                          className={
                            shown === one.id
                              ? 'pending__card pending__card--open'
                              : 'pending__card'
                          }
                        >
                        <p className="submissions__meta">
                          {/* A row may be about nobody in the record at all (V9:
                              „A payment waiting to be recognised may be about a
                              person who is not one yet"), so the sender is a name
                              and a number, or nobody. */}
                          {one.who === ''
                            ? t('verification.sentByAnonymous')
                            : t('verification.sentBy', {
                                who: one.who,
                                memberNumber: one.memberNumber,
                              })}
                        </p>

                        {/* The three things the team will be made of, before it
                            is made (owner, 03.08.2026). Only here: the other four
                            queues decide about something that already exists. */}
                        {queue.id === 'teams' && <TeamFields item={one} />}

                        {/* What the member thought of it, which is the half of a
                            comment the moderator was deciding about without
                            seeing (owner, 06.08.2026). Only here: a rating is
                            about an event and the other four queues are not. */}
                        {queue.id === 'comments' && <RatingGiven rating={one.rating} />}

                        <dl className="pending__facts">
                          <div className="pending__text">
                            <dt>{bodyLabelFor(one)}</dt>
                            {/* Read, not edited. A biography used to be
                                changeable in place here and published as the
                                moderator left it; the owner withdrew that on
                                06.08.2026 (PDL P22), and what a member wrote
                                about themselves now goes out as they wrote it
                                or comes back with a reason. */}
                            <dd className="pending__body">{one.body}</dd>
                          </div>
                        </dl>

                        {/* THE PICTURE, where this row still holds one.

                            Owner, 12.08.2026: „Administrator kad odobrava i
                            timsku sliku (unutar odobravanja tima) i profilnu
                            sliku učesnika... treba da vidi isto fokus na vidljiv
                            deo slike i zatamnjen ali dovoljno vidljiv ostatak."
                            That requirement stood UNMET on this card between
                            27.09.2026 and this branch: the block that used to
                            draw here was the very component the member arranges
                            his circle in, and it was removed the same day because
                            it was fed by a session row no route could decide
                            (`member/pictureIsOneRow.test.tsx`), never by this one.

                            WHY THE COMPONENT BELOW STILL DRAWS THE WHOLE PICTURE
                            AND NOT THAT ONE BROUGHT BACK, AND IT IS TEMPORARY.
                            PDL.md, „28. Moderator vidi ISECAK sa zatamnjenim
                            ostatkom" (owner, 27.09.2026), confirms 12.08.2026's
                            „isto" the way it was always meant: the moderator sees
                            the crop with its remainder dimmed but still visible,
                            not the whole photograph this card draws today. That
                            needs `/api/verification` to carry the crop's three
                            fractions beside the picture, which is its own branch
                            and not a line changed here (`WaitingPicture`'s own doc
                            above, in full). Until that branch lands, this whole
                            picture stands in because it is better than the
                            „Datoteka" label with nothing under it this branch
                            replaces, and not because the question was ever open:
                            it no longer is.

                            Unaffected either way is everything else this row
                            draws, whatever it holds: this paragraph used to say a
                            moderator reads a file name here when a picture 404s,
                            and that was never true of a photo row -
                            `MePhotoApi.java` inserts `body: ''` for every one it
                            gives a `photo_id`, so what a photo row shows under
                            „Datoteka" is an empty `<dd>` whether the picture loads
                            or not. Corrected rather than left standing for the
                            next reader to repeat. */}
                        <WaitingPicture
                          item={one}
                          broken={pictureUnavailable}
                          /* No `was.has(one.id)` guard: `onBroken` only ever
                             reaches here once for a given row. The `<img>` it is
                             wired to is what `broken` replaces with the sentence
                             below the moment it fires, so the element that could
                             call it again is gone before a second call could
                             happen - a guard against that would be a branch
                             nothing can take, which the gate's hundred per cent
                             refuses (measured, not assumed: PR 405's own coverage
                             run named this exact line the one branch never
                             reached).

                             Both homes of the fact are written here and only
                             here, to the identical value, so neither can be the
                             one a reader missed: `brokenPicturesRef` first,
                             because it is what a walk already under way and this
                             card's own `onClick` both read live, and the state
                             second, to ask for the render that draws the
                             sentence and this card's `aria-disabled`. */
                          onBroken={() => {
                            const next = new Set(brokenPicturesRef.current).add(one.id)

                            brokenPicturesRef.current = next
                            setBrokenPictures(next)
                          }}
                        />

                        {/* WHAT THE ROUTE SAID WHEN IT WOULD NOT TAKE THE DECISION,
                            on the card it is about and above both the box and the
                            buttons rather than inside either.

                            Above them because it has to be readable in both states,
                            and a refusal met while handing work back now arrives in the
                            second of them: the box closes with the answer (owner,
                            02.10.2026), so the sentence is what stands over the buttons
                            it leaves behind, beside the one that asked. Put inside the
                            box it would have gone when the box went, which is the very
                            moment a refusal about a reason („Uz odbijanje je razlog
                            obavezan.") arrives. */}
                        {said !== null && said.id === one.id && (
                          <WhatTheServerSaid answer={said.answer} />
                        )}

                        {open === one.id ? (
                          <SendBack
                            /* Same box, same words, on every queue that hands work
                               back. What the pictures ask for is a reason precise
                               enough to work from, because that reason is what the
                               member reads and changes the picture by.

                               And the comments, which are not handed back at all:
                               there the box asks for a note nobody has to write,
                               a trace for whoever reads the queue next rather
                               than a reason given to anybody (owner,
                               06.08.2026). */
                            placeholderKey={
                              outcomeFor(queue, one) === 'delete'
                                ? 'verification.deleteNotePlaceholder'
                                : outcomeFor(queue, one) === 'instruct'
                                  ? 'review.instructionPlaceholder'
                                  : /* And everything else on this screen promises
                                       the message, because everything else sends
                                       one. There is no third case here, and that
                                       is a fact about the screen rather than about
                                       the rule: the box opens from a „Odbij" that
                                       is only drawn where `canSendBack` says there
                                       is somebody to write to, so an item with no
                                       member never reaches this box at all. It is
                                       told why instead, in words of its own
                                       (`verification.noRecipient` below). The
                                       queues whose screens are elsewhere ask
                                       `refusalTo` for this, because there the box
                                       does open either way (Payments.tsx). */
                                    'review.reasonPlaceholder'
                            }
                            optional={outcomeFor(queue, one) === 'delete'}
                            aboutKey={
                              outcomeFor(queue, one) === 'delete'
                                ? 'verification.deleteBox'
                                : 'review.sendBackNamed'
                            }
                            /* Named after what it decides, which is what the box
                               is for: without it the group around the words for
                               deleting a comment was called "Odbij", the one
                               word this queue must not use (queues.ts). */
                            subject={one.subject}
                            labelKey={
                              outcomeFor(queue, one) === 'delete'
                                ? 'verification.deleteNote'
                                : 'review.reason'
                            }
                            confirmKey={
                              outcomeFor(queue, one) === 'delete'
                                ? 'verification.confirmDelete'
                                : 'review.confirmSendBack'
                            }
                            /* The whole of it is `handBack`, above, because it now
                               waits for the route before it changes anything, and
                               what it does after that answer is eleven lines of
                               consequence. `void` is the shape the portal already
                               uses for a press that speaks to the server
                               (`admin/AdminLeagues.tsx`,
                               `admin/LeagueRaceModeration.tsx`). */
                            onConfirm={(reason) => void handBackGuarded(one, reason)}
                            working={handingBack.has(one.id)}
                            onCancel={() => {
                              setOpen(null)
                              setClosed(one.id)
                            }}
                          />
                        ) : (
                          <div className="member__links">
                            <button
                              type="button"
                              className="button button--primary"
                              /* Not switched off: a control that leaves the row
                                 takes the keyboard with it, and this one is meant
                                 to be reachable so its reason can be read. It says
                                 it cannot act and points at why. */
                              aria-disabled={
                                why !== null || decisionUnknown || deciding || pictureUnavailable
                              }
                              aria-describedby={
                                why !== null
                                  ? `${one.id}-blocked`
                                  : decisionUnknown
                                    ? `${waitingId}-blocked`
                                    : pictureUnavailable
                                      ? `${one.id}-picture-unavailable`
                                      : undefined
                              }
                              onClick={() => {
                                /* Approving a proposed team without the members
                                   would risk a second team for somebody who
                                   already has one, so until they are here there
                                   is nothing safe to decide (whyNoDecision). And
                                   held back while a walk is already out
                                   (`outstanding` above) - the sweep's own or
                                   another card's - which is the same guard the
                                   sweep button carries, checked here so a press on
                                   one door while the other is out cannot start a
                                   second walk over an identity or address the
                                   first has already carried past this point.

                                   NOT checked here: `why !== null` (a team it
                                   cannot decide). `approveAll`'s loop already
                                   skips it through `refusal(...)` without
                                   stopping the walk or counting the skip, and a
                                   second copy of that check here would be a
                                   second home for a fact the loop already owns.

                                   CHECKED here, unlike `why`, since PDL.md "29."
                                   (owner 27.09.2026): `brokenPicturesRef` (a
                                   picture this row cannot show). Not for
                                   symmetry with the loop - `approveAll` reports
                                   what it settled through `sayIt`
                                   UNCONDITIONALLY, including "nothing" when the
                                   one row it was handed was skipped, so a press
                                   that started a walk here would clear whatever
                                   OTHER card's refusal `sayIt` last set (measured:
                                   it did, exactly that). Refusing to start the
                                   walk at all is the fix that leaves `sayIt`
                                   untouched, and it reads the ref rather than
                                   `pictureUnavailable` so this check and the
                                   loop's can never disagree about what is broken
                                   right now (`brokenPicturesRef`'s own doc,
                                   above). */
                                if (
                                  !decisionUnknown &&
                                  !outstanding.current &&
                                  !brokenPicturesRef.current.has(one.id)
                                ) {
                                  void approveAll([one], teams)
                                }
                              }}
                            >
                              {t('review.approve')}
                            </button>

                            {/* Deleting opens the same box the refusals open,
                                and asks for a note that may be left empty
                                (owner, 06.08.2026). Nothing is sent to the
                                member either way. The note is not read on any
                                screen since the tables of settled items were
                                taken away (owner, 06.08.2026); it is written
                                down because it is what the database will be
                                given when there is one, and because a deletion
                                that records nothing about itself cannot be
                                answered for. */}
                            {outcomeFor(queue, one) === 'delete' && (
                              <button
                                type="button"
                                className="button button--secondary"
                                /* The visible word is inside the name it is
                                   read by, which is what speech input works
                                   from (WCAG 2.2 SC 2.5.3): "Obriši: X" and not
                                   "Brisanje komentara: X", which does not
                                   contain the word on the button. Every other
                                   named control on the portal is written this
                                   way. */
                                aria-label={t('verification.deleteNamed', { name: one.subject })}
                                autoFocus={one.id === closed}
                                onClick={() => setOpen(one.id)}
                              >
                                {t('verification.delete')}
                              </button>
                            )}

                            {/* The focus comes back to this button with it, on the
                                render that brings it back and on no other: nothing
                                is autofocused when the page first draws. A
                                biography has one of these now, since 15.08.2026:
                                the sentence that used to stand here said it never
                                goes back, directly above the code drawing the
                                button that hands it back. */}
                            {handsBack(queue, one) && canSendBack(queue, one) && (
                              <button
                                type="button"
                                className="button button--secondary"
                                autoFocus={one.id === closed}
                                onClick={() => setOpen(one.id)}
                              >
                                {t('review.sendBack')}
                              </button>
                            )}

                            {/* Why approving would do nothing, said on the card
                                rather than left to a press that changes nothing.
                                The moderator has the fields above to put it right,
                                or the way back to hand it to whoever sent it. */}
                            {queue.id === 'teams' && (
                              <Refused why={why} id={`${one.id}-blocked`} />
                            )}

                            {/* And where it cannot go back, the button is gone and
                                the reason is on screen in its place. A control
                                that quietly does nothing teaches a moderator that
                                the screen is broken; this one says which fact is
                                missing and that it is not his to fix. */}
                            {handsBack(queue, one) && !canSendBack(queue, one) && (
                              <p className="pending__blocked">{t('verification.noRecipient')}</p>
                            )}
                          </div>
                        )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

            </>
          )
        }}
      </Resource>
    </div>
  )
}
