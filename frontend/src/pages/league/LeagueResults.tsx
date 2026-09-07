import { useMemo } from 'react'
import { NamePlate, OverTwoLines } from '../../components/NamePlate'
import { ProfileLink } from '../profile/ProfileLink'
import { Pager } from '../../components/Pager'
import { PER_PAGE, pageFrom } from '../../components/pageOf'
import { Resource } from '../../components/Resource'
import { useToday } from '../../clock/useClock'
import { genderMark } from '../../data/categories'
import { fieldFor } from '../../data/derive'
import type { BtlEvent, Competitor, Gender, League, Race, Result } from '../../data/types'
import { combineResources, useCompetitors, useRaces, useResults } from '../../data/useResource'
import { formatDayMonth, formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { leagueGroups, leagueTable } from './leagueTable'
import './League.css'
import { useFilterParams } from '../../app/useFilterParams'

/**
 * The standing of a competition as a grid (owner, 31.07.2026).
 *
 * Everybody who ran at least one of its races down the side, every race across
 * the top, points where they meet, and the total in the second column, which is
 * what the table is ordered by.
 *
 * **A column is an event, and its head is the day, written across** (owner, 07.09.2026). It was
 * the name of the race turned on its side until then, for a reason that was arithmetic: the widest
 * competition in the data has forty six races, and forty six names laid flat is a table nobody can
 * put on a screen. A day in `dd.mm.` is narrow lying down, so the reason is spent and the turning
 * goes with it; and once the head is only a day, two races of one event have nothing left to tell
 * them apart, so they are one column holding what both brought (`leagueTable.ts`).
 *
 * An event somebody did not race is left empty rather than shown as nought. Nought is a claim: it
 * says they were there and scored nothing.
 *
 * Its own component below the resource, not inside it, so the grid can be
 * memoised: it walks every result there is, and a render that rebuilt it would
 * do that on every keystroke anywhere on the page.
 */
function Grid({
  league,
  events,
  races,
  results,
  competitors,
  gender,
}: {
  league: League
  events: BtlEvent[]
  races: Race[]
  results: Result[]
  competitors: Competitor[]
  gender: Gender
}) {
  const { locale, t } = useI18n()
  const today = useToday()
  const [params] = useFilterParams()
  /* Who the grid is drawn from (PDL P11). A member whose fee has run out is not
     in the standing of the season now, and a competition's grid is that standing
     over a subset of its events. It does not show today, because the one such
     member raced in 2017 and the three competitions of 2027 have no results at
     all, which is exactly why it had to be asked for rather than noticed. */
  const table = useMemo(
    () => leagueTable(league, events, races, results, fieldFor(competitors, league.season, today)),
    [league, events, races, results, competitors, today],
  )

  if (table.rows.length === 0) {
    return <p className="profile__empty">{t('leagues.noResults')}</p>
  }

  /* **One half of the field at a time, chosen beside the heading** (owner,
     07.09.2026): „Žene ne treba da budu ispod muškaraca, nego da postoji filter
     gore desno da se biraju Muškarci ili Žene." Until then both blocks stood one
     under the other, which put a woman behind men she was never competing against
     unless the reader had scrolled far enough to meet the heading that said
     otherwise.

     The split itself is unchanged and still belongs to the data (`leagueGroups`):
     every competition ranks by gender and by nothing else (owner, 31.08.2026,
     „nego globalno!"). What changed is that the screen draws one block instead of
     both, so the block no longer needs a heading of its own inside the table: the
     control above it says which one is being read.

     **Which half is not read here**, since 07.09.2026: it is handed down by the
     screen that draws the control (`pages/LeagueDetail.tsx`), so the button and the
     table cannot say different things. Two readers of one address were measured
     disagreeing: the control frozen to the men over a standing of women.

     A competition of five men has no block for the women, and then this is empty
     and says so. */
  const rows =
    leagueGroups(table.rows).find((group) => group.code === genderMark(gender))?.rows ?? []

  if (rows.length === 0) {
    return <p className="profile__empty">{t('leagues.noneOfThese')}</p>
  }

  /* Fifty placed to a page (owner, 03.08.2026, PDL P24). A competition has as
     many rows as the league has members and there is no number of members the
     portal would refuse, so this is the side that had to be bounded. The width is
     not bounded and cannot be by paging: forty six races are forty six columns
     whatever this does, so they go on scrolling inside their own box.

     Of the half being read, since 07.09.2026. Paged over both halves together, a
     page could hold forty men and ten women, and the reader who asked for the
     women got ten of them on a page that says fifty. */
  const page = pageFrom(params.get('strana'), rows.length)
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <>
      <div className="table-scroll">
        <table className="table league__grid">
          <caption className="visually-hidden">{t('leagues.standing')}</caption>
          <thead>
            <tr>
              {/* The heading of the first column is sticky too, or the names
                  stand still while the word above them sails away. */}
              <th scope="col" className="league__who">
                {t('rankings.columns.member')}
              </th>
              <th scope="col" className="league__total">
                {t('rankings.columns.points')}
              </th>
              {table.columns.map((column) => (
                <th scope="col" key={column.eventId} className="league__race">
                  {/* **The day, lying down, and the event behind it** (owner,
                      07.09.2026): „treba da stoje datumi trka samo u redu u kojem
                      su sad uspravni nazivi (normalno ispisani horizontalno,
                      format dd.mm.) i da ti datumi na mouseover daju samo naziv
                      događaja, a da klik vodi na stranu događaja u novom
                      prozoru."

                      `formatDayMonth` and not a slice taken here: `dd.mm.` is a
                      fixed numeric shape the owner has asked for by name three
                      times now, and it has one home (`i18n/format.ts`).

                      **The name is on the title because that is what was asked,
                      and in the accessible name because a title is not one.**
                      A `title` is shown to a pointer and to almost nothing else:
                      it never reaches a keyboard, and screen readers differ on
                      whether they read it at all. So the same words are given as
                      the link's own name, where they are also what a reader of
                      the column hears: the head of the column is what a screen
                      reader says over every number under it, and „12.09." on its
                      own says nothing about which race that is. The day is kept
                      inside that name as well, which is what SC 2.5.3 asks of a
                      control whose visible words are part of it.

                      **A new window, which is what was asked, and never the
                      current one.** A reader is inside a standing, has scrolled
                      it sideways to the column they were curious about, and
                      following the link in place would cost them that place.
                      `rel="noreferrer"` beside it, the way the portal already
                      opens one of its own pages in a new tab
                      (`forms/worded.tsx`).

                      **Two events on one day are two columns reading one date**,
                      and that is the answer as it was given (owner, 07.09.2026):
                      „ako dva dogadjaja imaju isti datum i neko stigne da ih
                      istrci obe, svakako neka bude opcija 2", which was the day
                      alone. What tells them apart is the name the pointer is told
                      and the page the press opens. Two **races** of one event no
                      longer arise here at all: a column is the event
                      (`leagueTable.ts`). */}
                  <a
                    className="league__race-day"
                    href={`/${locale}/kalendar/${column.slug}`}
                    title={column.name}
                    aria-label={`${column.name} ${formatDayMonth(column.date)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {formatDayMonth(column.date)}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.competitor.memberNumber}>
                <th scope="row" className="league__who">
                  {/* **Krug pa ime u dva reda** (vlasnik, 07.09.2026), jer je prva kolona
                      zamrznuta i ima mesta ispod. Isto rade i „Najviše kilometara" i „Najduže na
                      stazi", koje je vlasnik istog dana svrstao uz ligu; jedan red ostaje na
                      glavnoj tabeli i na Najboljim pojedinačnim rezultatima. */}
                  <ProfileLink competitor={row.competitor}>
                    <NamePlate competitors={[row.competitor]}>
                      <OverTwoLines competitor={row.competitor} />
                    </NamePlate>
                  </ProfileLink>
                </th>
                <td className="table__points league__total">{formatPoints(row.total, locale)}</td>
                {table.columns.map((column) => {
                  const points = row.points.get(column.eventId)

                  return (
                    <td key={column.eventId} className="table__points">
                      {points === undefined ? '' : formatPoints(points, locale)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager page={page} rows={rows.length} label={t('pager.leagueStanding')} />
    </>
  )
}

export function LeagueResults({
  league,
  events,
  gender,
}: {
  league: League
  events: BtlEvent[]
  /** Which half of the field, decided by the screen that draws the control for it. */
  gender: Gender
}) {
  const { t } = useI18n()
  const state = combineResources(useRaces(), useResults(), useCompetitors())

  return (
    <Resource state={state} inline label={t('leagues.standing')}>
      {([races, results, competitors]) => (
        <Grid
          league={league}
          events={events}
          races={races}
          results={results}
          competitors={competitors}
          gender={gender}
        />
      )}
    </Resource>
  )
}
