import { useRef, useState } from 'react'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import { usePaymentsDue } from '../../data/useResource'
import type { MembershipDue } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { matching } from './paymentSearch'
import {
  activating,
  A_FEE_THAT_ARRIVED,
  A_FEE_THAT_IS_WAIVED,
  numberIn,
  WHEN_CONFIRMING_A_PAYMENT,
  WHEN_FREEING_OF_THE_FEE,
} from './paymentWrites'
import { QueueMeta } from './QueueMeta'
import { QUEUE } from './queues'
import '../member/Member.css'
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
 * WHOEVER IS NOT A MEMBER FOR THE SEASON YET, AND THE ONE CLICK THAT MAKES HIM ONE.
 *
 * <p><b>IT IS A DERIVED LIST AND NOT A QUEUE, AND THAT IS THE WHOLE OF WHAT CHANGED HERE
 * ON 27.09.2026.</b> Owner, choosing between three outcomes: „Svidja mi se pod 1, a da li
 * moze postojati neki search da u tom domenu brzo pronadjem onog koga treba proknjiziti (po
 * clanskom broju, imenu ili prezimenu)?" Option one was: there is no queue for payments,
 * nothing is written, nothing triggers a row, and no member presses anything. Paying happens
 * entirely outside the portal - the member pays, the bank shows the owner, and the portal
 * learns of it only when a moderator says so - so there was never an event a queue could
 * hold. The tab looked alive because tabs are named after RIGHTS rather than after items.
 *
 * <p><b>WHAT THE SCREEN BEFORE THIS ONE REALLY DID, because it is the fault being fixed and
 * not merely an older design.</b> It wrote the decision into the session overlay and handed
 * out a member number by counting the ones it could see. Nothing reached the server: a
 * refresh undid the activation, and the number was worked out against the member list, which
 * is missing exactly the people who have left. The number is a sequence on the server for
 * that reason (V16), and now only the server hands one out.
 *
 * <p><b>A ROW LEAVES THIS LIST BY THE MEMBERSHIP BEING WRITTEN, never by a decision being
 * recorded.</b> So there is nothing for this screen to remember: it asks the route, and on
 * the answer it clears the cached list so the next mount reads the derived answer again. What
 * it holds for the rest of the visit is only which rows it has already booked, which is a fact
 * about this visit and dies with it - not a decision laid over the server's answer.
 *
 * <p><b>THE MASS BUTTON IS GONE AND ITS ABSENCE IS THE DECISION, not an omission.</b> On the
 * old queue a row meant „somebody says the money arrived", so one press deciding all of them
 * was one decision taken many times. On a derived list a row means the OPPOSITE - „no money
 * has arrived" - so the same sweep would activate every debtor at once and hand each of them a
 * member number that cannot be taken back (the sequence only counts up, and a number spent in
 * error is spent for good). „Dovoljno je da klikne Aktiviraj" is about one man.
 *
 * <p><b>AND SO IS THE BOX THAT HANDED WORK BACK WITH A REASON.</b> It existed to return
 * something somebody had sent in. Nobody sends anything in here, so there is nothing to
 * return and nobody to write to: a reason written against one of these rows would reach a
 * member as „your submission was handed back" about a submission he never made.
 *
 * <p><b>Two buttons and not one, because a membership is activated in two ways</b> and the
 * owner named both in one breath (PDL:760): a fee that arrived, and a decision of the
 * association freeing somebody of it. Two routes, two sets of refusals, two words
 * (`paymentWrites.ts`). Neither asks the moderator to type anything.
 */
export function Payments() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  /**
   * Why the last press did not go through, the row it was pressed on, and the sentences of
   * the act that was pressed.
   *
   * <p><b>The dictionary is remembered rather than worked out from the reason.</b> Three
   * names are declared by both routes, so „which act was this" cannot be read back off the
   * answer; carried here, the reader of a refusal only one of the two routes can name is
   * never handed the other one's words, and never the raw code.
   */
  const [said, setSaid] = useState<{
    competitorId: number
    answer: Exclude<Answer, { got: 'done' }>
    reasons: Record<string, string>
  } | null>(null)
  /**
   * Whom this visit has already activated, and the number each of them was given.
   *
   * <p><b>Held here rather than in the session, and that is the decision of 27.09.2026
   * carried out rather than worked around.</b> There is no decision to record: the server's
   * own answer is what says who is a member, and this is only what keeps a row that has just
   * been booked from standing under the moderator's hand until he leaves the screen. It dies
   * with the screen, and what he sees when he comes back is the derived answer, read again
   * because the cache was cleared.
   *
   * <p>The number is in it because the number is the first thing the administrator passes on
   * to whoever paid (PDL P8), and because nothing else on the portal would ever show it to
   * him: the row it belongs to has left the list by then.
   */
  const [booked, setBooked] = useState<{ competitorId: number; who: string; memberNumber: string }[]>(
    [],
  )
  /**
   * Whether a press is out with the route, so a second one before the first has answered
   * cannot start another.
   *
   * A ref rather than the state beside it, exactly the way `PendingQueue.tsx` guards its own
   * walk and `ProposeTeam.tsx` its own send: state set inside the call is not yet visible to a
   * second click fired before the render it would cause, and two clicks fired without waiting
   * are what a double press and an impatient second try both are. Read by BOTH buttons of
   * BOTH rows, so a press on either while the other is still out is caught the same way - and
   * on this screen that matters more than on the queue, because the two acts write a different
   * basis for the same season and the loser of the race would meet a 409.
   */
  const outstanding = useRef(false)
  /** The same fact as a render can see, so both buttons can be marked while one is out. */
  const [working, setWorking] = useState(false)
  const state = usePaymentsDue()

  const queue = QUEUE.payments

  /**
   * ACTIVATION: ASK THE ROUTE, AND CHANGE NOTHING HERE UNLESS IT SAID YES.
   *
   * <p>The order is the order, and it is the one `PendingQueue.tsx` was rewritten into on
   * 26.09.2026 after a moderator watched a card leave a queue while nothing was written: a
   * consequence of something that did not happen is the fault being avoided.
   *
   * @param where  which of the two acts this is (`paymentWrites.ts`)
   * @param reasons the sentences that act's refusals draw
   */
  const activate = async (
    one: MembershipDue,
    where: string,
    reasons: Record<string, string>,
  ): Promise<void> => {
    /* Set before anything below awaits anything, so a second press reads it as true before
       it can send a second request for the same row. Released in `finally` rather than after
       the last line, so a route that rejects outright still lets the next press in. */
    outstanding.current = true
    setWorking(true)

    try {
      const answer = await askTheServer(where, activating(one.competitorId))

      if (answer.got !== 'done') {
        setSaid({ competitorId: one.competitorId, answer, reasons })

        return
      }

      setSaid(null)
      setBooked((sofar) => [
        ...sofar,
        {
          competitorId: one.competitorId,
          who: `${one.firstName} ${one.lastName}`,
          /* Off the ANSWER and never worked out here. Both routes either find the number he
             already had or draw the next one from the sequence, and the sequence is the only
             thing that knows which that is. */
          memberNumber: numberIn(answer.body),
        },
      ])

      /* ONLY IN THE BRANCH THE ANSWER APPROVED, which is the shape `PendingQueue.tsx` keeps
         (`if (done > 0)`) and the reason it gives: clearing the cache over a write the route
         REFUSED is a screen throwing away an answer it still has every reason to trust, and
         it would send the next mount to the server for a list that has not changed. */
      clearResourceCache('payments')
    } finally {
      outstanding.current = false
      setWorking(false)
    }
  }

  /** One press, guarded at the door the same way both of `PendingQueue`'s are. */
  const press = (one: MembershipDue, where: string, reasons: Record<string, string>) => {
    if (outstanding.current) {
      return
    }

    void activate(one, where, reasons)
  }

  return (
    <div className="member">
      <QueueMeta queue={queue} />

      {/* The name of the screen is in the navigation and in the browser tab (owner,
          30.07.2026). It stays in the markup so the page has a name for anyone who cannot
          see which entry is marked. */}
      <h1 className="visually-hidden">{t(queue.labelKey)}</h1>

      <Resource state={state}>
        {(outstandingFees) => {
          const rows = matching(outstandingFees.accounts, search).filter(
            (one) => !booked.some((each) => each.competitorId === one.competitorId),
          )
          const given = booked.filter((one) => one.memberNumber !== '')

          return (
            <>
              <Statement />

              <div className="pending__bar">
                {/* The season is named because the screen is booking one, and it comes off
                    the ANSWER: `data/season.ts` cannot work it out (`Outstanding` says why),
                    so a heading that computed it would name a different year from the list
                    under it. */}
                <h2 className="profile__section">
                  {t('verification.paymentsSeason', { season: outstandingFees.season })}{' '}
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

              {/* Drawn whether or not anything has been given, so the region is on the page
                  before it has anything to say: one added together with its text is the kind
                  a screen reader misses. */}
              <div
                className="member__panel"
                role="status"
                aria-label={t('verification.numbersGiven')}
              >
                <h2 className="profile__section">{t('verification.numbersGiven')}</h2>

                {given.length === 0 ? (
                  <p className="profile__empty">{t('verification.noNumbersYet')}</p>
                ) : (
                  <ul className="pending__given">
                    {given.map((one) => (
                      <li key={one.competitorId}>
                        {one.who}
                        {' · '}
                        <span className="table__member-number">{one.memberNumber}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* THREE STATES AND NOT TWO, and the middle one is the reason this is not an
                  `||`. „Nobody owes anything" is the ordinary state of a working portal on
                  the first day (owner: „NIKO SE NE DOVODI U PORTAL DOK SE SAM NE PRIJAVI");
                  „nothing matches what you typed" is a moderator who mistyped a name off a
                  bank statement. Told with one sentence, he would read „nobody owes" and stop
                  looking for the man whose money is sitting in the account. */}
              {rows.length === 0 ? (
                <p className="profile__empty">
                  {outstandingFees.accounts.length === 0
                    ? t('verification.paymentsNobodyDue')
                    : t('verification.paymentsNoSearchHit')}
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <caption className="visually-hidden">{t(queue.labelKey)}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('competitors.columns.member')}</th>
                        <th scope="col">{t('competitors.columns.city')}</th>
                        <th scope="col">{t('review.decision')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((one) => (
                        <tr key={one.competitorId}>
                          <td>
                            {one.firstName} {one.lastName}
                            {/* Under the name because the owner named it as one of the three
                                things he searches by, so a hit has to be confirmable by eye.
                                Blank for most of this list, which is the ordinary state of
                                somebody who has registered and never paid. */}
                            <span className="table__member-number">{one.memberNumber}</span>
                          </td>
                          <td>{one.city}</td>
                          <td>
                            <div className="review__decide">
                              <button
                                type="button"
                                className="button button--primary"
                                aria-disabled={working}
                                onClick={() => {
                                  press(one, A_FEE_THAT_ARRIVED, WHEN_CONFIRMING_A_PAYMENT)
                                }}
                              >
                                {t('verification.activatePayment')}
                              </button>
                              <button
                                type="button"
                                className="button button--secondary"
                                aria-disabled={working}
                                onClick={() => {
                                  press(one, A_FEE_THAT_IS_WAIVED, WHEN_FREEING_OF_THE_FEE)
                                }}
                              >
                                {t('verification.activateFeeExempt')}
                              </button>
                            </div>

                            {/* Beside the row it is about, because on a list of twenty there
                                is otherwise nothing on screen saying whose activation was
                                refused. Which act refused it decides which sentences are
                                looked up, so a reason one route names and the other does not
                                cannot be answered by the wrong words. */}
                            {said?.competitorId === one.competitorId && (
                              <ServerSaid answer={said.answer} refusals={said.reasons} />
                            )}
                          </td>
                        </tr>
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
