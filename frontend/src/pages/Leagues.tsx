import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { SYMBOL } from '../app/actionSymbol'
import { useFilterParams } from '../app/useFilterParams'
import { ActionLink } from '../components/ActionButton'
import { Resource } from '../components/Resource'
import { SeasonPicker } from '../components/SeasonPicker'
import { offeredSeason, useSeason } from '../components/season'
import { LEAGUES } from './admin/entityForms'
import { useMayOpen } from './admin/mayOpen'
import type { League } from '../data/types'
import {
  dataOr,
  failed,
  useCompetitors,
  useEvents,
  useLeaguesInTheReadersLanguage,
  useRaces,
  useResults,
  useFrozenSeasons,
} from '../data/useResource'
import { useFrozenTables } from '../data/useFrozenTables'
import { useToday } from '../clock/useClock'
import { formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { LeagueEvents } from './league/LeagueEvents'
import { LeagueMark } from './league/LeagueMark'
import { LeagueText } from './league/LeagueText'
import { YearStrip } from './league/YearStrip'
import { leagueRaces, racesByEvent } from './league/leagueCounting'
import { leagueTable } from './league/leagueTable'
import '../styles/counter.css'
import './Leagues.css'

/**
 * HOW MANY DAYS COUNT TOWARDS A COMPETITION, and it is the same number the box below the card
 * lists, because it is the same call.
 *
 * `league.eventIds.length` is what stood here until 13.09.2026, and a review measured what that
 * costs the moment the folding box arrived beside it: the row said „Događaja: 11" and the box
 * listed ten. The eleventh is an event whose races have not been entered yet, and that is not a
 * quirk of the mock. The owner decided on 23.08.2026 that an event is written before its
 * distances are known, so production produces that difference by design, on every competition
 * that has one.
 *
 * Which of the two numbers is right was already answered, and not here: `V20__league_reads_races`
 * carries the league onto its RACES, and says in as many words that from then on a league's
 * events ARE the events of its races. An event with none of them counted scores nothing and
 * decides nothing. So the row follows the box rather than the other way round, and when the
 * portal stops reading `/mock` the server will already be answering the same way.
 *
 * It asks for the events and the races itself, like `Entrants` above and for the same reason: the
 * list must not wait on two files of nearly two megabytes to draw a name. Three states and not
 * two - empty while the answer is coming, because a nought where the file has not arrived is the
 * card telling a lie; the word when it will not come at all.
 *
 * **WHAT THIS COSTS, NAMED AS A DECISION RATHER THAN LEFT AS A CONSEQUENCE.** The number used to
 * come out of a file of 1,9 KB and appeared with the name of the competition; it now waits on the
 * races (553 KB) and the events (373 KB), so on a slow connection the row reads „Događaja:" with
 * nothing after it for as long as those take. That is the same bargain `Entrants` beside it
 * already makes, and the same three states, so the screen itself still draws immediately.
 *
 * **And the difference that was being paid for was real, which the switch of 21.09.2026 has now
 * settled rather than removed.** `LeagueApi` builds `eventIds` by aggregating over the races it
 * counts, so a server answer can never carry an event with no counted races; the generated file's
 * `brdska-2019` can, because its list was written by hand. Two readings followed, and the one taken
 * here was deliberate: the row could have kept reading `eventIds` and been right again on the day
 * `BASE` moved, OR it could read what the box reads and be right on both sides of that day. The
 * second was chosen because the first is right only while somebody remembers why, and a number that
 * disagrees with the list under it is the kind of thing a member notices and nobody can explain.
 * The cases in this file still run against the generated file, so the arrangement that made the two
 * readings differ is still measured.
 */
function CountedEvents({ league, say }: { league: League; say: Say }) {
  const { t } = useI18n()
  const eventsState = useEvents()
  const racesState = useRaces()
  const ready = eventsState.status === 'ready' && racesState.status === 'ready'

  if (failed(eventsState, racesState)) {
    return <>{t('leagues.unknown')}</>
  }

  if (!ready) {
    return null
  }

  return <>{say(racesByEvent(leagueRaces(league, dataOr(racesState, [])), dataOr(eventsState, [])).length)}</>
}

/**
 * How a count is written where it stands: „8 događaja" in a pill and on a card, with the word that
 * fits the number (`units.raceCount` is the precedent). Handed in so that each count is still worked
 * out in one place, and only its wording differs between the two places that show it.
 */
type Say = (count: number) => ReactNode

/**
 * How many people are placed in one competition.
 *
 * **Read for what it is worth and not waited for** (review, 07.09.2026). It is one number in one
 * line of facts, and working it out costs the three heaviest files on the portal: the results are
 * 1,4 MB, the races 553 KB, the events 373 KB, against 1,9 KB for the competitions themselves.
 * Waited for, the whole screen sat under a full-page loader until all four arrived, and a results
 * file that failed replaced the list with „Podaci se ne mogu učitati." — a screen with no name of
 * any competition on it, no season, and none of the terms or prizes the owner moved here on that
 * same day. Measured by a review, in both states.
 *
 * So the list draws itself out of the one small file, and this fills in behind it. The shape is
 * the one the page of a competition used for the same problem before this: three states and not
 * two. Empty while the answer is coming, because a nought where the file has not arrived is the
 * table telling a lie; the word when it will not come at all.
 *
 * `leagueTable` and not a count of its own, because the owner said what this number is by pointing
 * at the table („Koliko ih je u tabeli"), and two ways of counting one thing are two answers.
 */
function Entrants({ league, say }: { league: League; say: Say }) {
  const { t } = useI18n()
  const frozen = useFrozenSeasons()

  if (frozen.status === 'error') {
    return <>{t('leagues.unknown')}</>
  }

  /* WHICH SEASON IS FROZEN IS THE RECORD'S AND NEVER THE CLOCK'S (PDL, derived 10.10.2026): a frozen
     competition counts who stands in its snapshot, the table its page draws. Until the list of frozen
     seasons has come back the number waits, as it waits for the four files below. */
  if (frozen.status !== 'ready') {
    return null
  }

  return frozen.data.some((one) => one.season === league.season) ? (
    <FrozenEntrants league={league} say={say} />
  ) : (
    <LiveEntrants league={league} say={say} />
  )
}

/** How many stand in the snapshot of a frozen competition, both genders: the rows of its grid. */
function FrozenEntrants({ league, say }: { league: League; say: Say }) {
  const { t } = useI18n()
  const state = useFrozenTables(league.season)

  if (state.status === 'error') {
    return <>{t('leagues.unknown')}</>
  }

  if (state.status !== 'ready') {
    return null
  }

  return <>{say(state.data.leagues.find((one) => one.slug === league.slug)?.standings.length ?? 0)}</>
}

function LiveEntrants({ league, say }: { league: League; say: Say }) {
  const { t } = useI18n()
  const eventsState = useEvents()
  const racesState = useRaces()
  const resultsState = useResults()
  const competitorsState = useCompetitors()
  const ready =
    eventsState.status === 'ready' &&
    racesState.status === 'ready' &&
    resultsState.status === 'ready' &&
    competitorsState.status === 'ready'

  if (failed(eventsState, racesState, resultsState, competitorsState)) {
    return <>{t('leagues.unknown')}</>
  }

  if (!ready) {
    return null
  }

  const standing = leagueTable(
    league,
    dataOr(eventsState, []),
    dataOr(racesState, []),
    dataOr(resultsState, []),
    dataOr(competitorsState, []),
  )

  return <>{say(standing.rows.length)}</>
}

/**
 * Every competition that runs alongside the league: a showcase of cards, and under it the sheet of
 * the one that is chosen.
 *
 * **Proposal B of `predlozi/lige-nacrt.html`** (owner, 21.11.2026, PDL „Strana „Lige” se radi po
 * predlogu B”: „Za Ligu, B je predobro!!! Hocu!”), with what he chose between the ones offered:
 * „Kartica lige je trećina širine na računaru, polovina na tabletu, cela širina na telefonu; list
 * izabrane lige je preko cele širine (obara odluku od 07.09.2026 o boksu preko cele širine).” And:
 * „Propozicije, nagrade i događaji se ispisuju samo za izabranu ligu; kad se strana otvori, izabrana
 * je prva kartica, a izbor se pamti u adresi”. Until that day each competition was a box across the
 * whole page, one under another, with its terms, prizes and events written out in every one.
 *
 * **A card carries** the sign of the competition, its name, the season, how many events count towards
 * it, how many people are in it (owner, 07.09.2026), a small line through the year and the way to its
 * table. **The sheet carries** the same facts in the shape of the front page's blue box, the golden
 * way to the table, and then what it always carried, in the order he set on 13.09.2026: the terms, the
 * prizes, and the events and races.
 *
 * **The head of the sheet is one row on a computer** (owner, 21.11.2026, PDL „Glava lista lige: na
 * desktopu sve u jednom redu”, chosen between the ones offered, on my recommendation for the button and
 * for taking away the small „Izmeni”): „na desktopu sve u jednom redu (znak, ime, tri statistike,
 * ikonica za izmenu, dugme); dugme se zove samo „Tabela”, bez strelice, svuda; na telefonu ostaje
 * raspored kao danas, a ikonica za izmenu stoji u gornjem redu uz naziv lige.” The pencil is drawn only
 * for somebody the administration of competitions opens for (`useMayOpen`, the very question its door
 * asks, `admin/needs.ts`), and it leads to the form of this competition there, opened by the address
 * (`?izmena=`, the shape `event/EventActions.tsx` already sends to the administration of events). In his
 * words: „Klikom na taj Edit (ko ga vidi, svakako ima privilegije) treba da se ode na Izmenu te lige u
 * Administraciji.” Nothing on this screen writes since that day (`league/LeagueText.tsx`).
 *
 * **One competition in the season draws no showcase**, only its sheet: a showcase of one card says
 * nothing the sheet under it does not, which is how the draft the owner chose draws it („Sa jednom
 * ligom vitrine nema i strana je samo list”).
 *
 * **Which one is chosen lives in the address** (`?liga=<slug>`), beside the season, so a link names
 * exactly that competition and the back button walks the choice. A slug that is not among the season's
 * competitions falls to the first, the way a season the control does not offer falls to its default
 * (`components/season.ts`, `offeredSeason`), and the address is not rewritten, for the reason given
 * there.
 *
 * **And, since 13.09.2026, which events and races it counts**, in a box of its own that folds
 * (`league/LeagueEvents.tsx`). The owner: „na pregledu svih liga ispisuje ono što i sad (naziv,
 * opšti detalji, PROPOZICIJE, NAGRADE, pa onda ide i sekcijica DOGAĐAJI / TRKE koja se može
 * ekspandovati tako da se vide sve označene." It was built for the page of a single competition
 * the day before, on his word of 12.09.2026, and he corrected himself the next morning; the page
 * of one competition is the standing and nothing else again.
 *
 * **The season is chosen beside the heading**, the same control the standing of the teams wears
 * and in the same place. The options are the seasons the competitions themselves are held in, so
 * when the first real ones arrive they will all be 2027 and that is what the control will open on.
 *
 * **Waiting only on the competitions themselves**, which is what the whole screen is drawn from.
 * The one number that needs more than that asks for it separately and says so (`Entrants`).
 */
export function Leagues() {
  const { locale, t } = useI18n()
  const today = useToday()
  const mayOpen = useMayOpen()
  const running = today.slice(0, 4)
  const asked = useSeason(running)
  const [params] = useFilterParams()
  const askedLeague = params.get('liga')

  /**
   * WHERE THE READER IS PUT AFTER CHOOSING A CARD: ON THE NAME OF THE SHEET THAT OPENED.
   *
   * The draft the owner chose says it for the telephone („na telefonu dodir na karticu skače na list
   * ispod vitrine”), and the same move answers the keyboard and the screen reader, whose next step
   * after choosing is reading what was chosen (WCAG 2.2 SC 2.4.3). Moving the focus is what scrolls
   * the sheet into view, and only as far as it is out of view, so on a wide screen where the sheet
   * already shows nothing moves. Only after a press on a card: a sheet drawn because the address named
   * it, on arrival or on the back button, leaves the focus where the router put it.
   */
  const jumping = useRef(false)
  const sheetName = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (jumping.current) {
      jumping.current = false
      sheetName.current?.focus()
    }
  }, [askedLeague])

  /** The address of a card: this one chosen, the season and every other filter kept. */
  function choosing(slug: string): string {
    const merged = new URLSearchParams(params)

    merged.set('liga', slug)

    return `?${merged.toString()}`
  }

  return (
    <div className="rankings rankings--tooled">
      <h1>{t('leagues.title')}</h1>

      <Resource state={useLeaguesInTheReadersLanguage()}>
        {(leagues) => {
          /* EVERY LEAGUE SERVED IS LISTED, AND NOTHING IS FILTERED OFF THIS SCREEN.
             Until 24.09.2026 a row at `btl-2027` was taken out here, on the reading that the
             portal's own league was a row of that table like any other and had to be hidden.
             The owner settled the shape on 22.09.2026 (PDL P15a): „Balkanska trkacka liga je
             globalno takmicenje ... Ne kreira se i ne moderira", and „BTL ne treba da se cuva
             na isti nacin kao ostale lige". So `league` is the table of the competitions that
             run ALONGSIDE, there is no such row, and a filter against one was a guard over an
             assumption that had been overturned - which is worse than useless, because the
             next reader takes it as evidence that the row exists. */
          /* The seasons competitions are actually held in, newest first, and the control opens on
             the newest of them. Not the seasons anybody has raced in: a competition written for
             next season has nobody in it yet and would be unreachable by the one control that
             leads to it. */
          const seasons = [...new Set(leagues.map((one) => one.season))].sort(
            (left, right) => right - left,
          )
          const season = offeredSeason(asked, seasons, String(seasons[0] ?? running))
          const shown = leagues.filter((one) => one.season === Number(season))
          /* The one the address names, if it is one of this season's, and the first card otherwise:
             a slug of another season or of nothing at all is read as no choice (owner, 21.11.2026:
             „kad se strana otvori, izabrana je prva kartica”). */
          const chosen = shown.find((one) => one.slug === askedLeague) ?? shown[0]

          return (
            <>
              <div className="rankings__head-tool">
                <SeasonPicker
                  seasons={seasons}
                  season={season}
                  fallback={String(seasons[0] ?? running)}
                />
              </div>

              {chosen === undefined ? (
                <p className="profile__empty">{t('leagues.none')}</p>
              ) : (
                chosenOf(shown, chosen)
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )

  /**
   * The showcase and the sheet of the chosen competition.
   *
   * **Called, and not drawn as a component of its own.** What it draws reads this screen's own hold
   * on the focus (`jumping`, `sheetName`) and its addresses (`choosing`), and a component declared
   * inside a component is a new type on every render: React would take the sheet down and build it
   * again each time, and the focus put on its name would be lost with it.
   */
  function chosenOf(shown: League[], league: League) {
    const events: Say = (count) => t('leagues.eventCount', { count, number: formatNumber(count, locale) })
    const entrants: Say = (count) =>
      t('leagues.entrantCount', { count, number: formatNumber(count, locale) })
    /* Whether the pencil is drawn: asked of the door of the administration of competitions itself, so
       the pencil and the form behind it cannot disagree about who may come in (ADL A8: anybody else
       would be answered as though the address did not exist). */
    const mayChange = mayOpen(LEAGUES.path)

    return (
      <>
        {shown.length > 1 && (
          <ul className="leagues__showcase" aria-label={t('leagues.showcase', { season: league.season })}>
            {shown.map((one) => (
              <li key={one.id} className="leagues__tile">
                {/* Which card is chosen is said by its frame alone, and by `aria-current` to a reader by
                    ear (owner, 21.11.2026, PDL „ne dobija natpis „Otvorena ispod””): „Dovoljno je što je
                    uokvireno, veoma je intuitivno i bez te labele.” */}
                <LeagueMark league={one} />
                <p className="leagues__tile-name">
                  <Link
                    to={choosing(one.slug)}
                    preventScrollReset
                    aria-current={one.id === league.id ? 'true' : undefined}
                    onClick={() => {
                      if (one.id === league.id) {
                        sheetName.current?.focus()
                      } else {
                        jumping.current = true
                      }
                    }}
                  >
                    {one.name}
                  </Link>
                </p>
                <p className="leagues__facts">
                  {one.season}
                  {' · '}
                  <CountedEvents league={one} say={events} />
                  {' · '}
                  <Entrants league={one} say={entrants} />
                </p>
                <TileYear league={one} />
                <Link className="leagues__tile-table" to={`/${locale}/liga/${one.slug}`}>
                  {t('leagues.table')}
                  {' '}<span className="visually-hidden">{one.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Keyed by the competition, so a sheet opened for another one is a sheet of its own: the box
            of events arrives open for each (owner, 03.11.2026), and a box folded in
            one competition is not carried over into the next. */}
        <article
          key={league.id}
          className="leagues__sheet"
          aria-labelledby={`league-name-${league.id}`}
        >
          <div className={mayChange ? 'leagues__score leagues__score--changes' : 'leagues__score'}>
            <LeagueMark league={league} />
            <div className="leagues__score-name">
              <p className="leagues__kicker">{t('leagues.kicker')}</p>
              <h2 id={`league-name-${league.id}`} ref={sheetName} tabIndex={-1}>
                {league.name}
              </h2>
            </div>
            <ul className="leagues__pills">
              <li className="score">
                <span className="score__mark" aria-hidden="true">
                  <CalendarSign />
                </span>
                <span className="score__pill">{t('leagues.season', { season: league.season })}</span>
              </li>
              <li className="score">
                <span className="score__mark" aria-hidden="true">
                  <FlagSign />
                </span>
                <span className="score__pill">
                  <CountedEvents league={league} say={events} />
                </span>
              </li>
              <li className="score">
                <span className="score__mark" aria-hidden="true">
                  <PeopleSign />
                </span>
                <span className="score__pill">
                  <Entrants league={league} say={entrants} />
                </span>
              </li>
            </ul>
            {/* Before „Tabela”, in his words: „da pre njega bude dugme za Edit (ikonica)”. The symbol and the
                box with its word are the portal's own for a press that changes one thing
                (`components/ActionButton.tsx`); the name says which competition, as „Tabela” beside it
                does. */}
            {mayChange && (
              <ActionLink
                symbol={SYMBOL.pencil}
                word={t('admin.change')}
                name={t('leagues.change', { name: league.name })}
                className="leagues__edit"
                to={`/${locale}/${LEAGUES.path}?izmena=${String(league.id)}`}
              />
            )}
            <Link className="leagues__cta" to={`/${locale}/liga/${league.slug}`}>
              {t('leagues.table')}
              {' '}<span className="visually-hidden">{league.name}</span>
            </Link>
          </div>

          <div className="leagues__item">
            <div className="leagues__texts">
              <LeagueText
                value={league.rules}
                shown={league.rulesShown}
                headingId={`league-rules-${league.id}`}
                heading={t('leagues.rules')}
              />

              <LeagueText
                value={league.prizes}
                shown={league.prizesShown}
                headingId={`league-prizes-${league.id}`}
                heading={t('leagues.prizes')}
              />
            </div>

            {/* And after the prizes, the events and races the competition counts, in a box that
                folds (owner, 13.09.2026: „pa onda ide i sekcijica DOGAĐAJI / TRKE koja se može
                ekspandovati tako da se vide sve označene"), with the line through the year at its
                head. Read-only, like the whole sheet: which events count is set in the
                administration, where the pencil above leads. */}
            <LeagueEvents league={league} today={today} />
          </div>
        </article>
      </>
    )
  }
}

/**
 * The line through the year on a card, drawn once the events and the races are in and not before:
 * like the two counts beside it, it is a picture that fills in behind the name rather than holding the
 * card back. Hidden from a reader by ear, because the card already says how many events there are.
 */
function TileYear({ league }: { league: League }) {
  const today = useToday()
  const eventsState = useEvents()
  const racesState = useRaces()

  if (eventsState.status !== 'ready' || racesState.status !== 'ready') {
    return null
  }

  return (
    <YearStrip
      counting={racesByEvent(leagueRaces(league, racesState.data), eventsState.data)}
      season={league.season}
      today={today}
      mini
    />
  )
}

/* The three signs of the pills, drawn as the front page draws its own (`pages/home/Counters.tsx`):
   a line in the colour of the mark, hidden from a reader by ear because the pill says it in words. */
function CalendarSign() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  )
}

function FlagSign() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M6 21V4" strokeLinecap="round" />
      <path d="M6 4.5h10l-2 3.2 2 3.3H6z" strokeLinejoin="round" />
    </svg>
  )
}

function PeopleSign() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c.5-4 2.8-5.8 6-5.8s5.5 1.8 6 5.8M15.5 4.8a3 3 0 0 1 0 5.6M18 14.6c1.8.7 2.8 2.4 3 5.4" />
    </svg>
  )
}
