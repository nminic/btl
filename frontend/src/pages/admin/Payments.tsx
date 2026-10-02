import { useRef, useState } from 'react'
import { Prompt } from '../../components/Prompt'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import type { MembershipDue, Outstanding } from '../../data/types'
import { usePaymentsDue } from '../../data/useResource'
import { money } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  MEMBERSHIPS,
  sending,
  typedIn,
  WHEN_ACTIVATING,
  WHEN_BOOKING_A_PAYMENT,
  type Question,
  type Sending,
} from './activation'
import { matching } from './paymentSearch'
import { QueueMeta } from './QueueMeta'
import { QUEUE } from './queues'
import '../member/Member.css'
import './Activation.css'
import './Verification.css'

/** Where the search box is, so its label points at it. */
const SEARCH_ID = 'payments-search'

/**
 * The bank statement, as the way a hundred payments are reconciled at once
 * (owner, 31.07.2026).
 *
 * Every slip carries a reference of the form 2027-37, so a statement can say
 * whose money each line is without anybody reading names. Turning the file into
 * decisions is the server's work and the server does not exist yet, so what this
 * does today is take the file and say so; the row by row confirmation below it
 * is what actually settles anything, and it is not going away when the parsing
 * arrives, because a payment that arrives without a reference will always need a
 * person.
 *
 * It refuses anything that is not a PDF by reading the first five bytes rather
 * than by believing what the operating system called the file. A statement saved
 * without a type is still a statement, and anything at all renamed to `.pdf` is
 * still not one; only the file itself knows.
 */
function Statement() {
  const { t } = useI18n()
  /* One region, always on the page, and only its text changes. A region that is
     added to the page together with its text is one that a screen reader often
     misses, because there was nothing there to be watching. */
  const [said, setSaid] = useState<{ key: string; name?: string } | null>(null)

  async function look(file: File | undefined) {
    if (file === undefined) {
      return
    }

    const opening = await file.slice(0, 5).text()

    setSaid(
      opening === '%PDF-'
        ? { key: 'review.statement.taken', name: file.name }
        : { key: 'review.statement.wrongKind' },
    )
  }

  return (
    <section className="statement" aria-labelledby="statement-heading">
      <h2 className="profile__section" id="statement-heading">
        {t('review.statement.title')}
      </h2>
      <label className="statement__pick">
        <span className="button button--secondary">{t('review.statement.choose')}</span>
        <input
          type="file"
          accept="application/pdf"
          className="visually-hidden"
          onChange={(event) => void look(event.target.files?.[0])}
        />
      </label>

      <p
        className={
          said?.key === 'review.statement.wrongKind'
            ? 'member__note statement__refused'
            : 'member__note'
        }
        role="status"
      >
        {said === null ? '' : t(said.key, { name: said.name ?? '' })}
      </p>
    </section>
  )
}

/**
 * ONE ROW OF THE OWNER'S SPECIFICATION, AND ITS OWN STATE.
 *
 * <p><b>A component per row rather than one table holding a record of what is typed where, and
 * that is the axis „one row's typing must not be another row's" answered by construction.</b>
 * A `Record` keyed by competitor would answer it too and would answer it by remembering to; a
 * component cannot share what it does not have. Six rows on the screen and a moderator working
 * down a bank statement is exactly the case where one number appearing under the wrong name
 * books one man's money to another.
 *
 * <p><b>WHAT THE ROW CARRIES IS THE OWNER'S OWN LIST</b> (PDL section 19, dictated 27.09.2026),
 * beside the competitor's data and the „Aktiviraj" button: the label „Ocekivan iznos: IZNOS",
 * an empty field with the currency marked beside it, and a tick box „ukljuci balans (iznos
 * balansa)" which is ticked to begin with and carries the amount in its own label.
 */
function Row({
  one,
  season,
  onActivated,
}: {
  one: MembershipDue
  /** For the prompt's own heading, so a question names the year it is about rather than leaving
   *  the moderator to look for it behind the sheet. Off the answer, never off a clock. */
  season: number
  onActivated: () => void
}) {
  const { locale, t } = useI18n()
  const [typed, setTyped] = useState('')
  /* TICKED TO BEGIN WITH, which is the owner's own word: „podrazumevano stiklirana". Held as its
     own state rather than derived from the balance, because a moderator clearing it over a
     member who HAS money is exactly cases 3b and 6. */
  const [including, setIncluding] = useState(true)
  const [asking, setAsking] = useState<Question | null>(null)
  /**
   * WHAT THE SERVER SAID AND WHICH DOOR SAID IT, held together as one value.
   *
   * <p><b>The map has to come with the answer rather than be chosen where it is drawn, because
   * this row now knocks on TWO doors and they name different reasons.</b> `POST /api/payments`
   * names nine and `POST /api/memberships` seven, and only four of the sixteen are spelt the
   * same. Picking the map at the point of drawing would mean asking again which door had been
   * used, from state that has since moved on; carried with the answer, the pair cannot come
   * apart. The one this would get wrong is exactly the four that overlap - they would look right
   * under either map - so the mistake would hide in the half that agrees.
   */
  const [refused, setRefused] = useState<{
    answer: Exclude<Answer, { got: 'done' }>
    refusals: Record<string, string>
  } | null>(null)
  /**
   * WHETHER A REQUEST THIS ROW STARTED IS STILL OUT WITH THE SERVER, so a second press before
   * the first has answered cannot send a second identical body.
   *
   * <p><b>A ref rather than the state beside it, `PendingQueue.tsx`'s own `outstanding` and
   * `ProposeTeam.tsx`'s guard both taken as the precedent</b> - both give the same reason: a
   * value `activate` sets is not visible to a second click fired before the render it would
   * cause, and two clicks fired without waiting are exactly what a double press is. Checked at
   * both doors that can start a request from this row - the button below and the prompt's own
   * choice - the same way `PendingQueue.tsx` checks it at its two doors.
   *
   * <p><b>Why this one outstanding matters more than either precedent's.</b> Neither guards
   * against resending a form or a decision the server can be asked about again; this guards a
   * member number, and `nextval('member_number_seq')` never gives one back. Two requests in the
   * air at once both pass „is there a membership already", both draw a number, and the loser
   * fails on `membership_pk` - so the number it drew is spent for nothing (PDL section 19,
   * „Aktivacija trosi clanski broj nepovratno").
   */
  const outstanding = useRef(false)
  /** The same fact as a render can see, so the row's own button can say out loud that it
   *  cannot act while ITS OWN request is out (`aria-disabled` below, told off rather than
   *  switched off - `PendingQueue.tsx`'s „Odobri" keeps the same shape for the same reason: a
   *  control that leaves the row takes the keyboard with it). */
  const [activating, setActivating] = useState(false)

  const read = typedIn(typed)
  /* DECIDED ONCE, HERE, and the button's disabling, its press and the question all read this one
     answer. It carries the body of every request this row could send, so nothing below assembles
     one: `activation.ts#sending` is where „which number goes into which field" is decided, and a
     test can ask it without mounting a row. */
  const press = sending(one, read, including)
  /**
   * THE TWO THINGS A PRESS CAN DO, NARROWED HERE IN THE RENDER AND NEVER IN THE HANDLER.
   *
   * <p><b>That is not a matter of taste, and the 100 per cent threshold is what decides it.</b> A
   * native `disabled` button fires no click, so any test of `'nothing'` written INSIDE the handler
   * is a branch nothing can reach - which is what the comment on the button below records as
   * having been found once already. Here it is reachable in every direction, because every state
   * of a row really is rendered: a field that cannot be read renders `'nothing'`, his case 1
   * renders `'sends'`, his case 6 renders a question.
   *
   * <p>Exactly one of the two is ever set, which is what makes the handler a pair of lines rather
   * than a second reading of the row.
   */
  const sendsAtOnce: Sending | null = press.press === 'sends' ? press.sending : null
  const question: Question | null =
    press.press === 'nothing' || press.press === 'sends' ? null : press

  const amountId = `paid-${one.competitorId}`
  const balanceId = `balance-${one.competitorId}`
  const wrongId = `wrong-${one.competitorId}`

  /** The amount and the currency together, which is how both of the numbers on this row are
   *  written: „4.800 RSD". The precedent is `pages/member/Membership.tsx`, which writes the
   *  same pair for the member's own side of this. */
  const inHisCurrency = (amount: number): string => `${money(amount, locale)} ${one.currency}`

  /**
   * @param what the whole request, address and body together, as `activation.ts#sending` built it.
   *             <b>Taken whole rather than as a ground</b>, which is what it used to take: there
   *             is more than one door now, and a function taking the pieces is a function that can
   *             send one door's body to the other.
   */
  async function activate(what: Sending) {
    /* SET BEFORE ANYTHING BELOW AWAITS ANYTHING, the same order `PendingQueue.tsx#approveAll`
       keeps and for the same reason: a second call reading this after the first has already set
       it is what makes the guard at both doors below mean anything. Reset in `finally`, so a
       route that rejects outright still lets the next press in (VISOK 1, review of PR 411). */
    outstanding.current = true
    setActivating(true)

    try {
      const answer = await askTheServer(what.to, what.body)

      /* CLOSED HERE, ONCE THE SERVER HAS ANSWERED, AND NOT BEFORE. This used to be the first
         line of the function, closing the sheet before anything was asked - which is what a
         sonde holding the answer unresolved found: the row's own button was not disabled either,
         so a second "Aktiviraj" reopened this same question while the first was still in the
         air, and a second „Da" sent a second, identical body. Moved here, the sheet stays up for
         exactly as long as `activating` keeps the button below from reopening it - and, since
         02.10.2026, as long as `activating` keeps the sheet's OWN buttons and Escape from putting
         it away: it is handed to `Prompt` as `working`, and the sheet closes here and nowhere
         else once a request is out. */
      setAsking(null)

      if (answer.got === 'done') {
        setRefused(null)
        onActivated()

        return
      }

      /* AND THE ROW STAYS EXACTLY WHERE IT WAS, which is the owner's rule over the whole of his
         specification: „Odluka NE ni ovde niti u ostatku opisa funkcionalnosti ne brise red iz
         tabele za aktivaciju, samo odlaze odluku dok se stvari ne rese van portala." A refusal is
         the same shape - nothing was written, so nothing about the row has changed - and the one
         refusal this screen cannot see coming is `nothingWouldComeOffTheBalance`, for the reason
         `activation.ts` sets out.

         AND THE MAP COMES OFF THE ADDRESS THAT WAS ACTUALLY CALLED, never off the state of the
         row. The field and the box can both be changed while a request is out, so a map worked
         out from them once the answer lands could belong to the other door - and the four reasons
         the two doors spell the same way would still read correctly, so the mistake would hide in
         the half that agrees. */
      setRefused({
        answer,
        refusals: what.to === MEMBERSHIPS ? WHEN_ACTIVATING : WHEN_BOOKING_A_PAYMENT,
      })
    } finally {
      /* Read at both doors before either starts a request (below, and `onChoose` where this is
         handed to `Asking`), so the next press is let through the moment this one has actually
         finished, whether it returned an answer or the route rejected it outright. */
      outstanding.current = false
      setActivating(false)
    }
  }

  return (
    <tr>
      <td>
        {one.firstName} {one.lastName}
        {/* Under the name because the owner named it as one of the three things he searches by,
            so a hit has to be confirmable by eye. Blank for most of this list, which since V16
            is the ordinary state of somebody who has registered and never paid. */}
        <span className="table__member-number">{one.memberNumber}</span>
      </td>
      {/* THE TOWN, AND ITS REASON IS NEW RATHER THAN INHERITED, which is written here because
          the old one is still readable two files away: `VerificationApi` says a town is drawn
          „because how a member pays follows the country they live in". That fell with the
          owner's decision of 27.09.2026 - „Novac je legao, mogu da ga aktiviram" - so nothing
          about money is read off a town any more. It stays to tell two people of one name
          apart: nothing stops two sharing a first and last name, most of this list holds no
          member number to separate them, and a moderator booking the wrong row books one man's
          money to another. */}
      <td>{one.city}</td>

      {/* „Ocekivan iznos: IZNOS", the first thing on the owner's list. The currency is his
          country's and is never chosen. */}
      <td className="activate__expected">{inHisCurrency(one.expected)}</td>

      <td>
        {/* THE LABEL IS A SIBLING OF THE FIELD AND NOT ITS PARENT, AND THE CURRENCY IS IN THE
            LABEL'S OWN WORDS. Measured, not preferred: with the currency mark standing INSIDE the
            label, the label's text became „Uplaćeno EUR" whatever `aria-hidden` said about the
            mark, so the field had no name anybody could ask for by name - and a test querying it
            by label could not find it, which is the same thing a screen reader would report.

            AND THE CURRENCY BELONGS IN THE NAME rather than only beside the box. „Uplaćeno" alone
            leaves a reader who cannot see the mark typing an amount into a field whose currency he
            has not been told, on a screen where the other five rows may be in the other one. The
            mark stays as well, `aria-hidden`, because it is the same fact drawn for the eye where
            the eye is looking (WCAG 2.2 AA, 3.3.2). */}
        <div className="rankings__field">
          <label htmlFor={amountId}>
            {t('verification.paidIn', { currency: one.currency })}
          </label>
          <span className="activate__amount">
            <input
              id={amountId}
              className="activate__field"
              type="text"
              /* A NUMERIC KEYBOARD AND NOT `type="number"`, and the reason is measured rather
                 than stylistic: a number field in a Serbian browser refuses the comma this
                 portal itself writes amounts with, and silently reports an empty value for
                 anything it dislikes - so „nije unet" and „unet pogresno" would arrive here as
                 one state, and the owner's grid sends them to opposite places. */
              inputMode="decimal"
              autoComplete="off"
              value={typed}
              aria-describedby={read.got === 'refused' ? wrongId : undefined}
              aria-invalid={read.got === 'refused' ? true : undefined}
              onChange={(event) => setTyped(event.target.value)}
            />
            {/* The currency beside the field, which is the owner's „Prazno polje sa oznakom
                valute pored njega". `aria-hidden` because the label already carries the same word,
                so read out it would be said twice about one field. */}
            <span className="activate__mark" aria-hidden="true">
              {one.currency}
            </span>
          </span>
        </div>

        {read.got === 'refused' ? (
          <p className="activate__wrong" id={wrongId}>
            {t('verification.amountNotRead')}
          </p>
        ) : null}
      </td>

      <td>
        {/* „Kucica „ukljuci balans (iznos balansa)"", with the amount in the label itself, which
            is the owner's own shape. Ticked to begin with. It is a real checkbox with a real
            label, so the space bar works and the words are the hit area. */}
        <label className="activate__balance" htmlFor={balanceId}>
          <input
            id={balanceId}
            type="checkbox"
            checked={including}
            onChange={(event) => setIncluding(event.target.checked)}
          />
          <span>{t('verification.includeBalance', { amount: inHisCurrency(one.balance) })}</span>
        </label>
      </td>

      {/* ONE CELL AND NEVER A CONDITIONAL ONE, which is why the refusal and the sheet stand in
          here beside the button. A row that grows a seventh cell when the server refuses is a
          row of a different width from the five above it, and a table whose rows disagree about
          that stops being navigable by a screen reader's own table commands. The sheet is
          `position: fixed`, so where it sits in the markup decides nothing about where it is
          drawn. */}
      <td>
        <button
          type="button"
          className="button"
          /* DISABLED FOR THE ONE CASE THAT SENDS NOTHING, which since 28.09.2026 is no longer
             four of the owner's seven but the eighth that is not his: a field that cannot be read
             (`activation.ts#Press`, `'nothing'`). It carries a sentence of its own beside the
             field, so the row says why.

             `'nothing'` is also what a currency the portal cannot name a way to pay for gives,
             and THAT one says nothing at all. It is named as a boundary on `Press` rather than
             guarded: `Currency` holds two and `paymentQr.test.ts` reads that enum, so a third
             cannot arrive without somebody deciding how it is paid.

             Asked ONCE, above, and both the disabling and the press read the one answer. Asked
             again inside the press it would be a branch nothing can reach - the button is
             disabled in exactly the case that would make it false - and the 100 per cent
             threshold is what found that, which is the one tool that sees such a branch. */
          disabled={press.press === 'nothing'}
          /* TOLD OFF WHILE ITS OWN REQUEST IS OUT, NOT SWITCHED OFF: `activating` never changes
             `press`, so the native `disabled` above stays reserved for the one case that can send
             nothing at all (`activation.ts#Press`, `'nothing'`) and this is the second,
             independent reason the row can give (`PendingQueue.tsx`'s own „Odobri" keeps the same
             two apart). */
          aria-disabled={activating ? true : undefined}
          onClick={() => {
            /* THE SAME REF `activate` SETS, CHECKED HERE SO A PRESS ON THIS BUTTON WHILE THE
               ROW'S OWN REQUEST IS OUT CANNOT REOPEN THE QUESTION IT IS STILL ANSWERING (VISOK
               1, review of PR 411). `aria-disabled` does not stop a click by itself - a stray
               press some other way must still find nothing to do. */
            if (outstanding.current) {
              return
            }

            /* THREE OF HIS SEVEN GO STRAIGHT THROUGH AND FOUR ASK FIRST, which is his table read
               literally: cases 1, 2 and 7 say „aktivacija prolazi" with no question in the cell,
               and the rest name a prompt. Which of the two this row is, and the body either way,
               was decided above rather than read off the field again here. */
            if (sendsAtOnce !== null) {
              void activate(sendsAtOnce)

              return
            }

            /* And `question` is null for the one case the button above is disabled for, so a press
               arriving some other way closes a sheet that was not open and does nothing else. */
            setAsking(question)
          }}
        >
          {t('verification.activate')}
        </button>

        {/* A LIVE REGION ALWAYS ON THE PAGE, with only its content changing. The shape is
            `Statement` above and the reason it gives: a region added to the page together with
            its text is one a screen reader often misses, because there was nothing there to be
            watching. */}
        <div className="activate__said" role="status">
          {refused === null ? null : (
            <ServerSaid answer={refused.answer} refusals={refused.refusals} />
          )}
        </div>

        {asking === null ? null : (
          <Asking
            one={one}
            season={season}
            what={asking}
            inHisCurrency={inHisCurrency}
            /* THE OTHER DOOR TO THE SAME REQUEST, guarded the same way as the button above: a
               second „Da" fired at this same open sheet before the first has answered - a real
               double press, not only a reopened sheet - must not start a second `activate` any
               more than a second „Aktiviraj" may (VISOK 1, review of PR 411).

               IT NOW HANDS BACK A WHOLE REQUEST RATHER THAN A GROUND, and the guard is untouched
               by that: the sheet picks which of the bodies its own question carries, and this
               still reads the one ref before anything is sent. */
            onChoose={(what) => {
              if (outstanding.current) {
                return
              }

              void activate(what)
            }}
            /* THE SHEET REFUSES THIS ITSELF WHILE ITS REQUEST IS OUT, and nothing here asks again:
               `working` is the one fact it needs, and a second guard on this line would be a reserve
               that hid the sheet's own from every case about it (`components/Prompt.test.tsx` asks the
               sheet alone for that reason). „Ne", „Odustani" and Escape put the sheet away only
               while nothing has been sent (owner, 02.10.2026). */
            working={activating}
            onDecline={() => setAsking(null)}
          />
        )}
      </td>
    </tr>
  )
}

/**
 * THE QUESTION ITSELF, in the owner's own words and with his own buttons.
 *
 * <p>Split out from the row because the row is about controls and this is about which of three
 * questions is being put. One of the three offers a choice of ground and two are a yes or no, and
 * `components/Prompt` takes both shapes.
 *
 * <p><b>IT CHOOSES BETWEEN BODIES AND NEVER BUILDS ONE, which is what changed on 28.09.2026.</b>
 * Every request its question could send arrives already made, on the {@link Question} it is
 * handed; this file decides which button carries which of them and what the words on it are. So
 * „which number out of the row goes into which field of the request" is not a question that can be
 * answered wrongly here, because it is not answered here at all.
 *
 * <p><b>The word „pocasno" appears nowhere, and that is a decision rather than a choice of
 * phrasing.</b> The owner used it three times while dictating, and the Statute of 17.08.2026
 * forbade it outright; the portal's name for the thing is „oslobodjenje od clanarine". All
 * three of his prompts are written with that word.
 */
function Asking({
  one,
  season,
  what,
  inHisCurrency,
  onChoose,
  onDecline,
  working,
}: {
  one: MembershipDue
  season: number
  /** One of the three presses that put a question, with the request each answer sends already on
   *  it. See `activation.ts#Question` for why that is a type and not a comment. */
  what: Question
  inHisCurrency: (amount: number) => string
  onChoose: (what: Sending) => void
  onDecline: () => void
  /** Whether the request one of the answers started is still out with the server. */
  working: boolean
}) {
  const { t } = useI18n()

  const whose = `${one.firstName} ${one.lastName}`
  /* THE PORTAL'S OWN SENTENCE FOR A REQUEST THAT IS OUT, and not a new one: `results.sending` is
     read by the two forms that send a result, and four other keys carry the same words. Handed to
     the sheet as text because the sheet draws none of its own. */
  const workingSays = working ? t('results.sending') : undefined

  if (what.press === 'asksAboutTheGround') {
    return (
      <Prompt
        title={t('verification.askGround', { whose, season })}
        choices={[
          {
            label: t('verification.grantExemption'),
            onChoose: () => onChoose(what.freeOfTheFee),
          },
          {
            /* ONE GROUND AND TWO LABELS, which is the owner's grid and the server's own word for
               it: cases 4 and 5 both send `balance` and differ in what the button says. The
               server works out how much comes off the book, so the screen never sends an
               amount. */
            label: what.covers
              ? t('verification.grantFromBalance')
              : t('verification.grantReducedFromBalance'),
            onChoose: () => onChoose(what.onTheBalance),
          },
        ]}
        decline={t('review.cancel')}
        onDecline={onDecline}
        working={workingSays}
      >
        <p>{t('verification.askGroundExpected', { amount: inHisCurrency(one.expected) })}</p>
        <p>{t('verification.askGroundBalance', { amount: inHisCurrency(one.balance) })}</p>
      </Prompt>
    )
  }

  /**
   * HIS CASES 3 AND 3b, IN HIS OWN WORDS: „Prihvatam umanjen ukupan iznos? Da / Ne".
   *
   * <p><b>Drawn since 28.09.2026, and it is the question this file was written around the absence
   * of.</b> What stood here said it „is reached only with an amount typed, and no route takes an
   * amount... so its „Da" would have nowhere to go". `POST /api/payments` takes one, so it does.
   *
   * <p><b>ONE QUESTION FOR BOTH OF HIS ROWS, which is his own table rather than an economy</b>: 3
   * and 3b share a cell („isti prompt"). 3 is the box ticked with the balance spent to the last
   * and 3b is the box cleared, and what the moderator is being asked is the same either way.
   *
   * <p><b>What is missing is NAMED, and that is the whole reason this is a question and not a
   * warning.</b> He is accepting a total short of the price, so the number he needs is how short,
   * and it is in his own money like every other number on the row.
   */
  if (what.press === 'asksAboutTheShortfall') {
    return (
      <Prompt
        title={t('verification.askShortfall')}
        choices={[{ label: t('admin.yes'), onChoose: () => onChoose(what.sending) }]}
        decline={t('admin.no')}
        onDecline={onDecline}
        working={workingSays}
      >
        <p>{t('verification.askExemptionWhose', { whose, season })}</p>
        <p>{t('verification.askGroundExpected', { amount: inHisCurrency(one.expected) })}</p>
        <p>{t('verification.askShortfallShort', { amount: inHisCurrency(what.short) })}</p>
      </Prompt>
    )
  }

  /* CASE 6, in his own words - „Odobri oslobodjenje od clanarine? Da / Ne" - and with it the
     state his grid does not name: the box ticked over an empty book. */
  return (
    <Prompt
      title={t('verification.askExemption')}
      choices={[{ label: t('admin.yes'), onChoose: () => onChoose(what.freeOfTheFee) }]}
      decline={t('admin.no')}
      onDecline={onDecline}
      working={workingSays}
    >
      <p>{t('verification.askExemptionWhose', { whose, season })}</p>
      <p>{t('verification.askGroundExpected', { amount: inHisCurrency(one.expected) })}</p>
    </Prompt>
  )
}

/**
 * WHOEVER IS NOT A MEMBER FOR THE SEASON YET, READ OFF THE SERVER, AND ACTIVATED FROM HERE.
 *
 * <p><b>IT IS A DERIVED LIST AND NOT A QUEUE.</b> Owner, 27.09.2026, choosing between three
 * outcomes: „Svidja mi se pod 1, a da li moze postojati neki search da u tom domenu brzo
 * pronadjem onog koga treba proknjiziti (po clanskom broju, imenu ili prezimenu)?" Option one
 * was: there is no queue for payments, nothing is written, nothing triggers a row, and no member
 * presses anything. Paying happens entirely outside the portal - the member pays, the bank shows
 * the owner, and the portal learns of it only when a moderator says so - so there was never an
 * event a queue could hold. The tab looked alive because tabs are named after RIGHTS rather than
 * after items.
 *
 * <p><b>THE ROW NOW ACTIVATES, WHICH IS WHAT CHANGED ON 28.09.2026, and the sentence that stood
 * here saying it deliberately did not is rewritten rather than left.</b> It said „Nothing here
 * activates a membership… the owner is settling how that works… a button here would be a guess
 * at a shape he is in the middle of deciding". He has since settled it, in full, and dictated it
 * as the definitive specification of this screen (PDL section 19): what stands in the row, seven
 * cases of what is typed, and two rules over all of them.
 *
 * <p><b>ALL SEVEN ARE CARRIED OUT SINCE 28.09.2026, AND WHAT STOOD HERE SAYING FOUR OF THEM ARE
 * NOT IS REWRITTEN RATHER THAN LEFT.</b> It said the four needing „the amount on the wire" could
 * not reach the server, on three counts: no amount on `POST /api/payments`, a balance spent by
 * what a QR code promised, and a `method` the schema did not know. All three were true when
 * written; `V42` and PR 407 overturned all three, and the sentence survived because a MERGE is
 * what brought the two halves together and neither half disagreed with itself (found by the
 * independent review of PR 413, round 2).
 *
 * <p><b>SO THE ROW KNOCKS ON TWO DOORS NOW, and which one is decided by whether money arrived.</b>
 * His 1, 2, 3, 3b and 7 - anything with an amount typed - go to `POST /api/payments`, which takes
 * `received` and `useTheBalance` and works out for itself what comes off the book and what goes
 * back onto it. His 4, 5 and 6 - nothing typed - go to `POST /api/memberships` on one of two
 * grounds, exactly as before. `activation.ts#sending` is the one place that decides which, and it
 * hands back the whole request rather than a piece of one, so no part of a body is assembled on
 * this screen.
 *
 * <p><b>AND THREE OF THE SEVEN NO LONGER ASK ANYTHING, which is his table read literally.</b>
 * Cases 1, 2 and 7 say „aktivacija prolazi" with no question in the cell, so one press books
 * them. A prompt invented for case 2 - „his balance is about to be spent, are you sure" - would be
 * a decision he did not ask for on a row he said simply goes through. The four that DO name a
 * prompt get one, „Prihvatam umanjen ukupan iznos? Da / Ne" among them.
 *
 * <p><b>The button is disabled for one case only, and it is not one of his:</b> a field that
 * cannot be read. That case carries a sentence beside the field saying so.
 *
 * <p><b>„NE" NEVER TAKES A ROW OFF THE LIST.</b> Owner, over the whole specification: „Odluka NE
 * ni ovde niti u ostatku opisa funkcionalnosti ne brise red iz tabele za aktivaciju, samo odlaze
 * odluku dok se stvari ne rese van portala." So declining sends nothing at all - no request
 * leaves the screen - and that is measured rather than merely intended. <b>It is available until a
 * request is out and not after</b> (owner, 02.10.2026): once „Da" or either ground has been
 * pressed, „Ne", „Odustani" and Escape do nothing until the answer arrives and the sheet closes
 * itself, because by then putting it away would only look like taking the answer back.
 *
 * <p><b>AND AN EXEMPTION IS FOR ONE SEASON.</b> Owner, in capitals: „BESPLATNI CLANOVI NISU
 * BESPLATNI DOZIVOTNO. Admin moze da odobri (jednu po jednu) godinu clanarine, ne postaju ljudi
 * besplatni zauvek!" The schema carries that by itself - a `membership` row stands per person
 * per SEASON and the basis belongs to the row rather than to the man - so this screen sends a
 * competitor and a ground and never a year, and the route reads the season off the day.
 *
 * <p><b>THE MASS BUTTON IS GONE AND ITS ABSENCE IS ALREADY DECIDED.</b> On the old queue a row
 * meant „somebody says the money arrived", so one press deciding all of them was one decision
 * taken many times. On a derived list a row means the OPPOSITE - „no money has arrived" - so the
 * same sweep would activate every debtor at once and hand each a member number that cannot be
 * taken back: the sequence only counts up, so a number spent in error is spent for good.
 *
 * <p><b>AND SO IS THE BOX THAT HANDED WORK BACK WITH A REASON.</b> It existed to return something
 * somebody had sent in. Nobody sends anything in here, so there is nothing to return and nobody
 * to write to: a reason written against one of these rows would reach a member as „your
 * submission was handed back" about a submission he never made.
 */
export function Payments() {
  /* WHAT MAKES THE LIST BE READ AGAIN, and it is a remount rather than a refetch because
     `useResource` reads once as it mounts and never again while it is mounted - which is the
     right shape for everything else and the one thing an activation has to get past.
     `usePaymentsDue` says what is wanted in as many words: „The screen writes to the route,
     clears this name, and reads the derived answer again." The count is the key. */
  const [readAgain, setReadAgain] = useState(0)

  return (
    <TheList
      key={readAgain}
      /* WHETHER THIS DRAWING IS THE ONE AFTER AN ACTIVATION, and it is the count that says so:
         every remount but the first is one, because nothing else moves it. Read by the search box
         below, which is where the focus goes when a row has left the list. */
      afterAnActivation={readAgain > 0}
      onActivated={() => {
        /* BOTH NAMES, and the second is not tidiness. An activation draws a member number and
           sets `competitor.active`, which is what `admin/AdminMembers.tsx` reads under
           `competitors` - so leaving that cached would show the man still outside the league on
           the next screen the moderator opens. */
        clearResourceCache('payments')
        clearResourceCache('competitors')
        setReadAgain((was) => was + 1)
      }}
    />
  )
}

/**
 * The reading half, so the key above has something to remount.
 *
 * @param afterAnActivation whether this is the drawing the list gets once an activation has gone
 *                          through, which is the one time the keyboard has nowhere left to be:
 *                          the row it was on has left the list and the remount took the button
 *                          with it. See the search box below for where it goes instead.
 */
function TheList({
  onActivated,
  afterAnActivation,
}: {
  onActivated: () => void
  afterAnActivation: boolean
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const state = usePaymentsDue()

  const queue = QUEUE.payments

  return (
    <div className="member">
      <QueueMeta queue={queue} />

      {/* The name of the screen is in the navigation and in the browser tab (owner,
          30.07.2026). It stays in the markup so the page has a name for anyone who cannot
          see which entry is marked. */}
      <h1 className="visually-hidden">{t(queue.labelKey)}</h1>

      <Resource state={state}>
        {(outstanding: Outstanding) => {
          const rows = matching(outstanding.accounts, search)

          return (
            <>
              <Statement />

              <div className="pending__bar">
                {/* The season is named because the screen is about one, and it comes off the
                    ANSWER: `data/season.ts` cannot work it out (`Outstanding` says why), so a
                    heading that computed it would name a different year from the list under
                    it. */}
                <h2 className="profile__section">
                  {t('verification.paymentsSeason', { season: outstanding.season })}{' '}
                  <span className="profile__count">{rows.length}</span>
                </h2>
              </div>

              <div className="entity-bar">
                <div className="entity-bar__filters">
                  <div className="rankings__filters">
                    <label className="rankings__field rankings__field--wide" htmlFor={SEARCH_ID}>
                      <span>{t('verification.paymentsSearch')}</span>
                      {/* WHERE THE FOCUS GOES WHEN THE ROW IT WAS ON HAS LEFT THE LIST (WCAG 2.2
                          AA, 2.4.3). A success remounts the whole list (`key` above), so the
                          „Aktiviraj" the sheet had put the focus back on goes with its row and the
                          focus would fall to the document - for a refusal nothing is remounted and
                          the sheet's own cleanup puts it back, which is why this is asked only of
                          the drawing after a success.

                          THE PRECEDENT IS `admin/AdminMembers.tsx`, where a deleted row hands the
                          focus to this same search box, and `RowActions.deleteRow`, where it goes
                          to the one control that cannot be the row just deleted. Done HERE and at
                          mount rather than where the answer arrives, because the box that is on
                          the screen when the answer arrives is the old one and the remount destroys
                          it too: this one is the box that stays. Never on the first drawing, so
                          arriving on the screen is not taken for a row leaving it. */}
                      <input
                        id={SEARCH_ID}
                        type="search"
                        value={search}
                        autoFocus={afterAnActivation}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* THREE STATES AND NOT TWO, and the middle one is the reason this is not an
                  `||`. „Everybody is a member" is the ordinary state of a working portal on
                  the first day (owner: „NIKO SE NE DOVODI U PORTAL DOK SE SAM NE PRIJAVI");
                  „nothing matches what you typed" is a moderator who mistyped a name off a
                  bank statement. Told with one sentence, he would read „everybody is a
                  member" and stop looking for the man whose money is sitting in the
                  account. */}
              {rows.length === 0 ? (
                <p className="profile__empty">
                  {outstanding.accounts.length === 0
                    ? t('verification.paymentsNobodyDue')
                    : t('verification.paymentsNoSearchHit')}
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="table activate">
                    <caption className="visually-hidden">{t(queue.labelKey)}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('competitors.columns.member')}</th>
                        <th scope="col">{t('competitors.columns.city')}</th>
                        <th scope="col">{t('verification.expected')}</th>
                        <th scope="col">{t('verification.paid')}</th>
                        <th scope="col">{t('verification.balanceColumn')}</th>
                        <th scope="col">
                          <span className="visually-hidden">{t('verification.activate')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((one) => (
                        <Row
                          key={one.competitorId}
                          one={one}
                          season={outstanding.season}
                          onActivated={onActivated}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
