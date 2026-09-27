import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { usePaymentsDue } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { matching } from './paymentSearch'
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
 * WHOEVER IS NOT A MEMBER FOR THE SEASON YET, READ OFF THE SERVER.
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
 * not merely an older design.</b> It drew three rows out of a fixture, wrote a decision into
 * the session overlay, and handed out a member number by counting the ones it could see.
 * Nothing reached the server, nothing in the backend has ever written that queue, and the
 * number was worked out against the member list, which is missing exactly the people who have
 * left. This reads `GET /api/payments`, which works the answer out on every read.
 *
 * <p><b>WHAT IT DELIBERATELY DOES NOT DO YET, AND THAT IS A BOUNDARY RATHER THAN AN
 * UNFINISHED HALF.</b> Nothing here activates a membership. The owner is settling how that
 * works - per row, an empty box carrying a currency, the competitor's balance beside it, and
 * the booking taken out of the balance where the box is left empty - and until that is written
 * down, a button here would be a guess at a shape he is in the middle of deciding. So the
 * screen reads and finds, and the act of booking arrives with its own specification. There is
 * no half-built control standing about in the meantime, which is the point.
 *
 * <p><b>THE MASS BUTTON IS GONE AND ITS ABSENCE IS ALREADY DECIDED, independently of the
 * above.</b> On the old queue a row meant „somebody says the money arrived", so one press
 * deciding all of them was one decision taken many times. On a derived list a row means the
 * OPPOSITE - „no money has arrived" - so the same sweep would activate every debtor at once
 * and hand each a member number that cannot be taken back: the sequence only counts up, so a
 * number spent in error is spent for good.
 *
 * <p><b>AND SO IS THE BOX THAT HANDED WORK BACK WITH A REASON.</b> It existed to return
 * something somebody had sent in. Nobody sends anything in here, so there is nothing to
 * return and nobody to write to: a reason written against one of these rows would reach a
 * member as „your submission was handed back" about a submission he never made.
 */
export function Payments() {
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
        {(outstanding) => {
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
                  <table className="table">
                    <caption className="visually-hidden">{t(queue.labelKey)}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('competitors.columns.member')}</th>
                        <th scope="col">{t('competitors.columns.city')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((one) => (
                        <tr key={one.competitorId}>
                          <td>
                            {one.firstName} {one.lastName}
                            {/* Under the name because the owner named it as one of the three
                                things he searches by, so a hit has to be confirmable by eye.
                                Blank for most of this list, which since V16 is the ordinary
                                state of somebody who has registered and never paid. */}
                            <span className="table__member-number">{one.memberNumber}</span>
                          </td>
                          {/* THE TOWN, AND ITS REASON IS NEW RATHER THAN INHERITED, which is
                              written here because the old one is still readable two files
                              away: `VerificationApi` says a town is drawn „because how a
                              member pays follows the country they live in". That fell with
                              the owner's decision of 27.09.2026 - „Novac je legao, mogu da ga
                              aktiviram" - so nothing about money is read off a town any more.
                              It stays to tell two people of one name apart: nothing stops two
                              sharing a first and last name, most of this list holds no member
                              number to separate them, and a moderator booking the wrong row
                              books one man's money to another. */}
                          <td>{one.city}</td>
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
