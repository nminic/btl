import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { resultsOf } from '../../data/derive'
import { RESULTS, useResults } from '../../data/useResource'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { DeleteRecord } from '../admin/EntityEditor'
import { useSession } from '../../session/useSession'
import { useMemberScreen } from './memberScreen'
import type { Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { theResultWasTakenBack, WHEN_A_RESULT_IS_WRITTEN } from './resultWrites'
import './Member.css'

/* Everything a member has sent in, in one place: what is still waiting, what
 * was sent back and why, and what has been counted. A result does not appear
 * in any table until it is approved (PDL P9), so this screen is the only place
 * where a pending one is visible at all. */
export function MyResults() {
  const { locale, t } = useI18n()
  const { submissions, withdraw, remove } = useSession()
  const who = useMemberScreen()
  const state = useResults()
  /* What the server said about taking a counted result back, where it said anything but
     „done". One at a time, because the reader presses one button and waits for it: a second
     press while the first is out is refused below. */
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const [going, setGoing] = useState(false)
  /* Read and written in the same tick, so a redraw cannot land between two presses that
     arrive before one answer does. Deleting twice would answer 404 the second time, which
     would tell the member his result is gone in the words of „that is not yours". */
  const outstanding = useRef(false)

  /**
   * TAKES ONE COUNTED RESULT BACK, AND THE BROWSER FOLLOWS THE SERVER RATHER THAN LEADING
   * IT.
   *
   * <p>Owner, 27.08.2026: „član ga ili briše (ima pravo na to, iako je verifikovan)", and
   * 25.09.2026: „Čovek ima pravo da obriše svoj rezultat bez javljanja i time se i tabele i
   * obračuni automatski ažuriraju." Until 28.09.2026 this screen only wrote the removal into
   * the browser's own overlay, so the row came back the next time anybody signed in.
   *
   * <p><b>The overlay is written after the route answered, never before.</b> Refused, the
   * row stays exactly where it is and a sentence appears above the table - which is the
   * honest thing, because the points really are still counted.
   */
  function takeBack(result: number): Promise<void> | undefined {
    if (outstanding.current) {
      return undefined
    }

    outstanding.current = true
    setGoing(true)
    setRefusal(null)

    /* RETURNED, which `DeleteRecord` waits on: its „Odustani" is told off, and „Šalje se" said
       beside it, for as long as this promise is pending (owner, 02.10.2026). The page-level line
       above the table stays: it is the one that explains a press on ANOTHER row being refused. */
    return theResultWasTakenBack(result).then((answer) => {
      outstanding.current = false
      setGoing(false)

      if (answer.got !== 'done') {
        setRefusal(answer)

        return
      }

      /* And the overlay follows, so the row goes at once rather than on the next read. The
         served list really has lost it - `resultWrites.ts` drops that cache - and this is
         what covers the moment between the answer and the re-read. */
      remove(RESULTS, String(result))
    })
  }

  if (who.memberNumber === null) {
    return who.instead
  }

  const { memberNumber } = who

  const mine = submissions.filter((one) => one.memberNumber === memberNumber)

  return (
    <div className="member">
      <div className="member__head">
        <h1>{t('myResults.title')}</h1>
        <Link className="button button--primary" to={`/${locale}/rezultat/novi`}>
          {t('myResults.add')}
        </Link>
      </div>

      <section aria-labelledby="my-pending">
        <h2 className="profile__section" id="my-pending">
          {t('myResults.sentIn')} <span className="profile__count">{mine.length}</span>
        </h2>

        {mine.length === 0 ? (
          <p className="profile__empty">{t('myResults.noneSent')}</p>
        ) : (
          <ul className="submissions">
            {mine.map((one) => (
              <li key={one.id} className={`submissions__item submissions__item--${one.status}`}>
                <div className="submissions__head">
                  <strong>{one.raceName}</strong>
                  <span className={`tag tag--${one.status}`}>{t(`status.${one.status}`)}</span>
                </div>
                <p className="submissions__meta">
                  {formatShortDate(one.date, locale)}
                  {' · '}
                  {formatNumber(one.distanceKm, locale, 2)} km
                  {' · '}
                  {formatDuration(one.seconds)}
                  {' · '}
                  {t('units.btlPoints', { value: formatPoints(one.points, locale) })}
                </p>
                {/* And the caveat beside it: the count is settled at verification, and
                    until then it is what their own entry worked out (PDL, 30.08.2026,
                    point 8). Only while it waits: once it is decided, the number is the
                    decided one and there is nothing left to warn about.

                    **This is the last screen that says it, since 28.09.2026.** The two
                    forms that send a result said it too, each beside a number of its
                    own; the owner took the number off those („Ne vidim razlog da se
                    ispisuju bilo kome prilikom unosa parametara prijave rezultata"), and
                    the caveat went with it there because nothing was left for it to
                    qualify. Here a number still stands, so it stays. */}
                {one.status === 'pending' && (
                  <p className="submissions__note">{t('newResult.pointsNotFinal')}</p>
                )}
                {one.note !== '' && <p className="submissions__note">{one.note}</p>}

                {/* What a member may do with a result that is still theirs to
                    act on, which is one that has not been decided or has been
                    sent back.

                    The way back in was here first, on the refused one alone: a
                    refusal is not the end of a result, the member is told why,
                    corrects it and sends the same race again (owner,
                    06.08.2026). Owner, 27.08.2026, on the rest of it: „član ga
                    ili briše (ima pravo na to) ili menja i dostavlja dokaz za tu
                    izmenu", and asked what may be changed: „sve osim trke", so
                    somebody who picked the wrong race deletes this and enters
                    another.

                    The words differ because the two moments do: one that was
                    sent back is sent again, one that is still waiting is simply
                    changed. The road is the same and so is the form.

                    The name of the race is in the accessible name of every
                    control here, because a list of six waiting results is six
                    buttons a screen reader cannot otherwise tell apart. */}
                {one.status !== 'approved' && (
                  <p className="submissions__again">
                    <Link
                      className="button button--secondary"
                      aria-label={t(
                        one.status === 'rejected' ? 'myResults.sendAgainNamed' : 'myResults.changeNamed',
                        { name: one.raceName },
                      )}
                      to={`/${locale}/rezultat/novi?ponovo=${one.id}`}
                    >
                      {t(one.status === 'rejected' ? 'myResults.sendAgain' : 'myResults.change')}
                    </Link>
                    {/* Asked twice before it happens, which is the portal's one
                        way of asking about something nothing brings back
                        (`DeleteRecord`). Dressed as the button beside it rather
                        than as a row of a table, which is the only difference. */}
                    <DeleteRecord
                      name={one.raceName}
                      look="button button--secondary"
                      onDelete={() => {
                        withdraw(one.id)
                      }}
                    />
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="profile__section">{t('myResults.counted')}</h2>

      {/* Above the table rather than inside the cell the button sits in, so nothing about
          the row's own geometry moves: a `td` that grows a paragraph is a row whose rule
          breaks off short of the rest, which is what this screen already paid for once at
          360px (see the note on `my-results__own` below). Both sentences name no race,
          because only one deletion can be out at a time - the press is refused while one
          is. */}
      {going && <p role="status">{t('results.withdrawing')}</p>}

      {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_A_RESULT_IS_WRITTEN} />}

      <Resource state={state}>
        {(results) => {
          const counted = resultsOf(results, memberNumber)

          if (counted.length === 0) {
            return <p className="profile__empty">{t('profile.noResults')}</p>
          }

          return (
            <div className="table-scroll">
              <table className="table">
                <caption className="visually-hidden">{t('myResults.counted')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('profile.columns.date')}</th>
                    {/* „Trka" and not „Događaj": what stands in this column is the name of
                      the race (owner, 23.08.2026), and a heading that says otherwise
                      is read out with every cell under it. */}
                  <th scope="col">{t('profile.columns.race')}</th>
                    {/* Away on a phone, so that what a member came here to do
                        fits on the screen they are holding. Chosen rather than
                        dropped at random: the category is worked out from the
                        distance and nothing else (`categoryOf`), it is named in
                        full on the profile and in every ranking, and the race in
                        the cell beside it already says which race this was. The
                        two controls are the only thing on this screen that
                        exists nowhere else, so they are the last thing to go.
                        The moderator's queue makes the same trade with four of
                        its columns (`admin/ReviewQueue.tsx`). */}
                    <th scope="col" className="table__hide-phone">
                      {t('rankings.columns.category')}
                    </th>
                    <th scope="col" className="table__hide-phone">
                      {t('profile.columns.time')}
                    </th>
                    <th scope="col">{t('profile.columns.points')}</th>
                    {/* Named, because two controls in a cell with no heading are
                        two buttons a screen reader meets with nothing saying what
                        column they are in. */}
                    <th scope="col">{t('myResults.own')}</th>
                  </tr>
                </thead>
                <tbody>
                  {counted.map((result) => (
                    <tr key={result.id}>
                      <td>{formatShortDate(result.date, locale)}</td>
                      <td>
                        {/* The race and not the event it belonged to (owner,
                            23.08.2026): „u listi rezultata treba da se prikazuju
                            nazivi trka na kojima je čovek učestvovao, a ne
                            događaja." */}
                        {result.raceName}
                      </td>
                      <td className="table__hide-phone">{t(`category.${result.category}`)}</td>
                      <td className="table__hide-phone">{formatDuration(result.seconds)}</td>
                      <td className="table__points">{formatPoints(result.points, locale)}</td>
                      {/* What a member may still do with a result that has been
                          counted. Owner, 27.08.2026: „član ga ili briše (ima
                          pravo na to, iako je verifikovan) ili menja i dostavlja
                          dokaz za tu izmenu (ponovo)."

                          That overturned an older decision, which said a member
                          may delete their own result only while it is waiting.
                          Verification is a check of what is true, not a transfer
                          of ownership: the result is the member's own record and
                          the right to withdraw it does not end because a
                          moderator agreed with it.

                          Changing it is not an edit in place. It leaves the
                          standings, goes back to the queue carrying new proof,
                          and returns only when somebody has agreed with it again;
                          anything else would let a member move their own points
                          after they were counted. */}
                      <td>
                        {/* The controls in a box inside the cell, never on the
                            cell itself: a `td` laid out as a flex container
                            leaves the table and stops lining up with the row.
                            That is what the moderator's queue says where it does
                            the same thing (`admin/ReviewQueue.tsx`), and this was
                            written with the class on the `td` while claiming to
                            follow it. Measured by a review on 28.08.2026 at
                            360px: 36 of 180 rows, every one whose race name wraps
                            to more lines than the controls do, drew this cell
                            5,05 pixels shorter than its row, so the rule under
                            the row broke off short of the rest of it. */}
                        <div className="my-results__own">
                          {/* And only where no correction of this result is
                              already waiting on somebody.
                           *
                              Since 28.08.2026 the result stays in the standing
                              while a correction waits (owner), so the row goes on
                              looking exactly as it did and this link stayed live.
                              Measured by a review the same day: one counted result
                              then took as many corrections as somebody cared to
                              send, the queue grew a row for each, and one press of
                              „Odobri sve" walked them newest first, so what ended
                              up counted was the **oldest** of them. That is the
                              same fault the portal already refuses for a waiting
                              result: „two rows for one race, and the moderator
                              reading the same morning twice" (owner, 06.08.2026).
                           *
                              The way on is not lost: the correction is in the list
                              above, and it carries its own „Izmeni". */}
                          {mine.every((one) => one.corrects?.id !== result.id) && (
                            <Link
                              className="button button--secondary"
                              aria-label={t('myResults.changeNamed', { name: result.raceName })}
                              to={`/${locale}/rezultat/novi?ispravka=${result.id}`}
                            >
                              {t('myResults.change')}
                            </Link>
                          )}
                          <DeleteRecord
                            name={result.raceName}
                            look="button button--secondary"
                            /* HANDED BACK, so the question can wait for the answer: the
                               promise of the deletion, or nothing where another one is
                               already out and this press is refused (`takeBack`). */
                            onDelete={() => takeBack(result.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }}
      </Resource>
    </div>
  )
}
