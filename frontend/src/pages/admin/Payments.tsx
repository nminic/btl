import { useState } from 'react'
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
  FREE_OF_THE_FEE,
  ON_THE_BALANCE,
  theServerCanDoIt,
  typedIn,
  whatToDo,
  WHEN_ACTIVATING,
  type Actionable,
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
  const [asking, setAsking] = useState<Actionable | null>(null)
  const [refused, setRefused] = useState<Exclude<Answer, { got: 'done' }> | null>(null)

  const read = typedIn(typed)
  const what = whatToDo(read, one.expected, one.balance, including)
  /* NARROWED ONCE, HERE, and both the button's disabling and its press read this one answer.
     `theServerCanDoIt` is a type guard, so this is also what makes `what` something `Asking`
     will accept: four of the owner's seven cases have no route, and `activation.ts` names what
     is missing for them. */
  const canAct = theServerCanDoIt(what) ? what : null

  const amountId = `paid-${one.competitorId}`
  const balanceId = `balance-${one.competitorId}`
  const wrongId = `wrong-${one.competitorId}`

  /** The amount and the currency together, which is how both of the numbers on this row are
   *  written: „4.800 RSD". The precedent is `pages/member/Membership.tsx`, which writes the
   *  same pair for the member's own side of this. */
  const inHisCurrency = (amount: number): string => `${money(amount, locale)} ${one.currency}`

  async function activate(ground: string) {
    setAsking(null)

    const answer = await askTheServer('/api/memberships', {
      competitorId: one.competitorId,
      ground,
    })

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
       `activation.ts` sets out. */
    setRefused(answer)
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
          /* DISABLED FOR FOUR OF THE OWNER'S SEVEN CASES, and `activation.ts#theServerCanDoIt`
             is the one place that says which four and what exactly is missing for them. Not a
             sentence on the screen: what is missing is a route's shape rather than anything the
             moderator did or could put right, and the wording for such a sentence is the
             owner's to give.

             The guard is asked ONCE, above, and both the disabling and the press read its
             answer. Asked again inside the press it would be a branch nothing can reach - the
             button is disabled in exactly the case that would make it false - and the 100 per
             cent threshold is what found that, which is the one tool that sees such a branch. */
          disabled={canAct === null}
          onClick={() => setAsking(canAct)}
        >
          {t('verification.activate')}
        </button>

        {/* A LIVE REGION ALWAYS ON THE PAGE, with only its content changing. The shape is
            `Statement` above and the reason it gives: a region added to the page together with
            its text is one a screen reader often misses, because there was nothing there to be
            watching. */}
        <div className="activate__said" role="status">
          {refused === null ? null : <ServerSaid answer={refused} refusals={WHEN_ACTIVATING} />}
        </div>

        {asking === null ? null : (
          <Asking
            one={one}
            season={season}
            what={asking}
            inHisCurrency={inHisCurrency}
            onChoose={(ground) => void activate(ground)}
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
 * questions is being put. Two of the three offer a choice of ground and one is a yes or no, and
 * `components/Prompt` takes both shapes.
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
}: {
  one: MembershipDue
  season: number
  /** Narrowed to the cases that reach a route, so the question about a shortfall cannot be
   *  built here at all: it needs an amount on the wire and there is none. See `Actionable`. */
  what: Actionable
  inHisCurrency: (amount: number) => string
  onChoose: (ground: string) => void
  onDecline: () => void
}) {
  const { t } = useI18n()

  const whose = `${one.firstName} ${one.lastName}`

  if (what.does === 'offersTheBalanceOrTheExemption') {
    return (
      <Prompt
        title={t('verification.askGround', { whose, season })}
        choices={[
          { label: t('verification.grantExemption'), onChoose: () => onChoose(FREE_OF_THE_FEE) },
          {
            /* ONE GROUND AND TWO LABELS, which is the owner's grid and the server's own word for
               it: cases 4 and 5 both send `balance` and differ in what the button says. The
               server works out how much comes off the book, so the screen never sends an
               amount. */
            label: what.covers
              ? t('verification.grantFromBalance')
              : t('verification.grantReducedFromBalance'),
            onChoose: () => onChoose(ON_THE_BALANCE),
          },
        ]}
        decline={t('review.cancel')}
        onDecline={onDecline}
      >
        <p>{t('verification.askGroundExpected', { amount: inHisCurrency(one.expected) })}</p>
        <p>{t('verification.askGroundBalance', { amount: inHisCurrency(one.balance) })}</p>
      </Prompt>
    )
  }

  /* CASE 6, in his own words - „Odobri oslobodjenje od clanarine? Da / Ne" - and with it the
     state his grid does not name: the box ticked over an empty book.

     THE QUESTION ABOUT A SHORTFALL IS NOT HERE, AND ITS ABSENCE IS THE BOUNDARY RATHER THAN AN
     OMISSION. „Prihvatam umanjen ukupan iznos? Da / Ne" is reached only with an amount typed,
     and no route takes an amount (`activation.ts#theServerCanDoIt`), so its „Da" would have
     nowhere to go. `Actionable` is what keeps it out: the type narrows to the cases that reach a
     route, so drawing it here would not compile. The day an amount can be sent, widening that
     type breaks this file until the question is written, which is the opposite of a boundary
     somebody has to remember. */
  return (
    <Prompt
      title={t('verification.askExemption')}
      choices={[{ label: t('admin.yes'), onChoose: () => onChoose(FREE_OF_THE_FEE) }]}
      decline={t('admin.no')}
      onDecline={onDecline}
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
 * <p><b>WHAT IS CARRIED OUT AND WHAT IS NOT, counted rather than described.</b> Three of his
 * seven cases reach the server today - the three where nothing is typed, which are his 4, 5 and
 * 6 - and they go to `POST /api/memberships` on one of two grounds. The four that need the
 * amount on the wire cannot, and `activation.ts#theServerCanDoIt` names exactly what is missing
 * and where it stands today: no amount on `POST /api/payments` at all, a balance spent by what a
 * QR code promised instead of by the tick box, and a `method` whose only correct value for
 * Serbia the schema does not know. The button is disabled for those four, which is the one
 * honest state: a prompt whose „Da" had nowhere to go would tell the moderator a row had been
 * dealt with.
 *
 * <p><b>„NE" NEVER TAKES A ROW OFF THE LIST.</b> Owner, over the whole specification: „Odluka NE
 * ni ovde niti u ostatku opisa funkcionalnosti ne brise red iz tabele za aktivaciju, samo odlaze
 * odluku dok se stvari ne rese van portala." So declining sends nothing at all - no request
 * leaves the screen - and that is measured rather than merely intended.
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

/** The reading half, so the key above has something to remount. */
function TheList({ onActivated }: { onActivated: () => void }) {
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
                      <input
                        id={SEARCH_ID}
                        type="search"
                        value={search}
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
