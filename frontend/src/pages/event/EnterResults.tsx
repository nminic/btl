import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useFilterParams } from '../../app/useFilterParams'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { raceKind } from '../../data/raceKind'
import { raceLabel } from '../../data/raceLabel'
import { inEventOrder } from '../../data/raceOrder'
import { combineFour, useEvents, useRaces, useResults, useRunners } from '../../data/useResource'
import type { RaceKind, Result, Runner } from '../../data/types'
import { AskedLabel } from '../../forms/AskedLabel'
import { DatePicker } from '../../forms/DatePicker'
import { dogadjaj, unosRezultata } from '../../forms/definitions'
import { heldControl } from '../../forms/held'
import { PlaceField } from '../../forms/PlaceField'
import { withThePlace } from '../../forms/withThePlace'
import { limitOf, optionsFor } from '../../forms/records'
import { Suggesting } from '../../forms/Suggesting'
import { useI18n } from '../../i18n/useI18n'
import type { Answer, RowRefused } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { wordsFor as wordsOfTheServer } from '../account/serverWords'
import { Guard } from '../admin/Guard'
import { QUEUE } from '../admin/queues'
import { queueRight } from '../admin/rights'
import { everyEventToOffer } from '../member/eventsToOffer'
import { racesToOffer } from '../member/racesToOffer'
import { useSeasonsOpenForAReport } from '../member/useSeasonsOpenForAReport'
import {
  aNewEditionOf,
  changingTheDay,
  choosingTheEvent,
  choosingTheRace,
  emptyBlock,
  eventAndRaceOf,
  figuresOfANewRace,
  hintOf,
  kindOfTheRows,
  theEventPageAfter,
  typingTheEvent,
  typingTheRace,
  whatIsWrongWithTheBlock,
  yearsOfTheDay,
  type TheBlock,
} from './eventAndRace'
import {
  bodyOf,
  figuresAskedOn,
  figuresOf,
  newLeagueRow,
  rowOf,
  runnerLabel,
  runnersToOffer,
  theOnlyRow,
  whatIsWrongWith,
  type Figure,
  type LeagueRow,
} from './leagueResultRows'
import {
  theEventSavedOn,
  theLeagueChanged,
  theLeagueEntered,
  theLeagueEnteredOnAnEvent,
  THE_LEAGUE_ENTERING,
} from './leagueResultWrites'
import '../admin/Entity.css'
import '../member/Member.css'
import { SYMBOL } from '../../app/actionSymbol'
import { ActionButton } from '../../components/ActionButton'

/**
 * THE LEAGUE ENTERS THE RESULTS OF SEVERAL MEMBERS ON ONE RACE, OR CHANGES ONE, FROM THE EVENT PAGE.
 *
 * <p>PDL P9, „Unos rezultata sa strane događaja, za moderatora i administratora (18.10.2026)": „Moderator
 * i administrator unose, menjaju i brišu rezultate članova sa strane događaja, i ti rezultati su odmah
 * odobreni." The owner: „Klikom na unesi rezultat, očekivano je da unosim rezultate za takmičare koje
 * potvrđujem automatski, pa nema potrebe za slikom, komentarom i sl. Želim dropdown za odabir takmičara,
 * a nakon toga polja zavisno od vrste trke ... I na kraju dugme za dodaj novog, (+) ili mogu da obrišem i
 * taj red (x)”.
 *
 * <p><b>Who may open it</b> is the right that checks results („[izabrao uz moju preporuku, 18.10.2026]
 * Unos rezultata sa strane događaja otvara pravo provere rezultata"), asked by the portal's own guard,
 * and the server asks it again on every write (`ResultsByTheLeagueApi`).
 *
 * <p><b>Which race</b> rides in the address (`?trka=`), as on the member's own form: the row of the
 * event page the moderator pressed already knows it, and an address naming no race the event has run is
 * answered with a sentence rather than a guess. <b>The pencil</b> is the same screen with one row and
 * `?rezultat=`: the member is fixed and only the figures change („Olovka menja samo polja rezultata;
 * trka ostaje ista").
 *
 * <p><b>Several rows, one press, nothing written if one is wrong</b> („ako ijedan red nije ispravan,
 * ništa se ne čuva i portal kaže koji red i zašto"): the server names each row it refused, by its place
 * in what was sent, and each sentence stands in its own row.
 */
export function EnterResults() {
  return (
    <Guard need={{ of: 'right', right: queueRight(QUEUE.results) }}>
      <TheRows />
    </Guard>
  )
}

/** The id of the sentence under one row, which every control of that row is described by. */
const problemId = (at: number) => `league-row-${String(at)}-problem`

function TheRows() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const [params] = useFilterParams()
  const today = useToday()
  const state = combineFour(useEvents(), useRaces(), useRunners(), useResults())

  return (
    <div className="member">
      <Resource state={state}>
        {([events, races, runners, results]) => {
          const event = events.find((one) => one.slug === slug)

          if (event === undefined) {
            return <h1>{t('event.notFound')}</h1>
          }

          /* Only a race that has been run, which is what the server refuses otherwise
             (`theRaceHasNotBeenRun`) and what the button on the event page is drawn for. */
          const run = inEventOrder(races.filter((one) => one.eventId === event.id)).filter(
            (one) => one.date <= today,
          )
          const race = run.find((one) => String(one.id) === params.get('trka'))

          if (race === undefined) {
            return (
              <>
                <h1>{event.name}</h1>
                <p className="profile__empty">{t(run.length === 0 ? 'report.noRaces' : 'report.noRace')}</p>
              </>
            )
          }

          const asked = params.get('rezultat')

          const back = `/${locale}/kalendar/${event.slug}`

          if (asked === null) {
            return (
              <Rows
                heading={t('leagueResults.title', { race: raceLabel(race, run, locale) })}
                kind={raceKind(race.kind)}
                runners={runners}
                editing={null}
                save={(rows, kind) =>
                  theLeagueEntered(
                    race.id,
                    rows.map((one) => bodyOf(one, kind)),
                  )
                }
                after={() => back}
              />
            )
          }

          const result = results.find((one) => String(one.id) === asked && one.raceId === race.id)

          if (result === undefined) {
            return (
              <>
                <h1>{event.name}</h1>
                <p className="profile__empty">{t('leagueResults.notThere')}</p>
              </>
            )
          }

          /* Whose run the pencil was pressed on, off the list of everybody ever given a number, which
             is every member a result can name; his number where the list does not know it, and where a
             run has no number at all the portal's own word for a member it cannot name
             (`event.someMember`, as the pencil on the event page is named), never the word `null`. */
          const runner = runners.find((one) => one.memberNumber === result.memberNumber)
          const name = runner === undefined ? (result.memberNumber ?? t('event.someMember')) : runnerLabel(runner)

          return (
            <Rows
              heading={t('leagueResults.editTitle', { name })}
              kind={raceKind(race.kind)}
              runners={runners}
              editing={{ result, name }}
              save={(rows, kind) => theLeagueChanged(race.id, result.id, figuresOf(theOnlyRow(rows), kind))}
              after={() => back}
            />
          )
        }}
      </Resource>
    </div>
  )
}

/**
 * THE ROWS OF MEMBERS AND THEIR FIGURES, AND THE ONE PRESS THAT SAVES THEM, which the event page's
 * entry and the moderator's own screen share („Jedan ekran za sve”, PDL P9, 19.10.2026): the caller
 * names the heading, the kind the rows are asked under, what the press sends and where it goes after.
 * What stands `above` the rows is the caller's too, and the press asks it first (`blockIsWrong`).
 */
function Rows({
  heading,
  kind,
  runners,
  editing,
  save,
  after,
  above,
  blockIsWrong,
}: {
  heading: string
  /** Read through the one function that knows the three words (`data/raceKind.ts`) by the caller. */
  kind: RaceKind
  runners: Runner[]
  editing: { result: Result; name: string } | null
  save: (rows: LeagueRow[], kind: RaceKind) => Promise<Answer>
  /** Where the screen goes once the save is written. */
  after: (answer: Answer) => string
  above?: ReactNode
  /** Asked before the rows on every press, and the save waits while it says something is wrong. */
  blockIsWrong?: () => boolean
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [rows, setRows] = useState<LeagueRow[]>(() =>
    editing === null
      ? [newLeagueRow()]
      : /* A row names somebody or the press is refused (`whatIsWrongWith`), and the pencil's row is
           the member the result already has: his number, and for a run with no number the name the
           screen shows for him, never the word `null`. The pencil sends the figures alone. */
        [rowOf(editing.result, editing.result.memberNumber ?? editing.name, editing.name)],
  )
  /* What the screen found wrong with each row before sending, by row, after the last press. */
  const [checked, setChecked] = useState<(string | undefined)[]>([])
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const [sending, setSending] = useState(false)
  /* A ref and not the state beside it, because two presses can arrive before one redraw (the shape
     `ReportResult.tsx` keeps): a second save of the same rows would be refused as a result the
     member already has. */
  const outstanding = useRef(false)
  const offered = runnersToOffer(runners)
  /** The form itself, so the cursor can be put on a control inside it without asking the whole
   *  document for an address (`forms/FormRenderer.tsx` keeps the same ref). */
  const sheet = useRef<HTMLFormElement>(null)
  /** Whether the last press was refused by this screen's own check, and the cursor is therefore owed
   *  to the first control that is wrong. Set on the press and spent by the effect below, so a redraw
   *  for any other reason (typing, a row taken away, the server's refusal) never moves the cursor. */
  const owed = useRef(false)

  /**
   * THE CURSOR GOES TO THE FIRST CONTROL THAT IS WRONG, AFTER A PRESS THIS SCREEN REFUSED ITSELF.
   *
   * <p>The precedent is `forms/FormRenderer.tsx` (`owed`, and the effect that spends it). The list of
   * errors above its forms was taken away on 28.09.2026 and the cursor took over its job: the sentences
   * of the fields are announced by the cursor being put on the first of them, and `role="alert"` is
   * kept only for a sentence with no field to stand beside. A sentence drawn into a row says nothing
   * to a keyboard or a screen reader by itself: the press that was refused otherwise leaves the
   * cursor on the button, as if it had done something.
   *
   * <p>Every control of a wrong row, and every box of a wrong block, already carries
   * `aria-invalid="true"` and is described by its sentence, and the document holds them in the order
   * the screen draws them (the block first, then the rows). So the first one found is the first
   * thing that is wrong, and the document is asked rather than a row index worked out again here. No
   * dependency list, on purpose: it must run after the draw that carries the new sentences, whichever
   * draw that is, and `owed` decides whether it does anything. The server's refusal never sets it,
   * because that one is announced as an alert under the form (`ServerSaid`).
   */
  useEffect(() => {
    if (!owed.current) {
      return
    }

    owed.current = false
    sheet.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })

  /* The server's word for each row it refused, by the row's place in what was sent. */
  const refusedRows: RowRefused[] = refusal !== null && refusal.got === 'refused' ? (refusal.rows ?? []) : []

  const wordsFor = (at: number): string | undefined => {
    const own = checked[at]

    if (own !== undefined) {
      return t(`leagueResults.${own}`)
    }

    const refused = refusedRows.find((one) => one.row === at)

    /* The words of a row are worked out where every refusal's are (`account/serverWords.ts`), so a
       reason this screen does not know is said the way the portal says one everywhere else. */
    return refused === undefined
      ? undefined
      : wordsOfTheServer({ got: 'refused', reason: refused.reason }, THE_LEAGUE_ENTERING, t)
  }

  const change = (at: number, next: Partial<LeagueRow>) => {
    setRows((were) => were.map((one, which) => (which === at ? { ...one, ...next } : one)))
  }

  async function send() {
    const wrong = rows.map((one) => whatIsWrongWith(one, kind))
    /* Both asked on every press, so the block and the rows say what is wrong with them together. */
    const blockWrong = blockIsWrong?.() === true

    setChecked(wrong)
    setRefusal(null)

    const refused = blockWrong || wrong.some((one) => one !== undefined)

    owed.current = refused

    if (refused) {
      return
    }

    outstanding.current = true
    setSending(true)

    const answer = await save(rows, kind)

    outstanding.current = false
    setSending(false)

    if (answer.got !== 'done') {
      setRefusal(answer)

      return
    }

    void navigate(after(answer))
  }

  function onSubmit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault()

    if (outstanding.current) {
      return
    }

    void send()
  }

  return (
    <>
      <h1>{heading}</h1>
      <form noValidate onSubmit={onSubmit} ref={sheet}>
        {above}
        <div className="races">
          {rows.map((row, at) => {
            const words = wordsFor(at)
            const said = words === undefined ? undefined : problemId(at)
            const which = String(at + 1)

            return (
              /* Keyed by place: a row has no identity of its own until it is written, and the
                 rows are taken away from wherever the reader presses, which re-draws the ones
                 after it with what they hold. */
              <fieldset className="race" key={`league-row-${which}`}>
                <legend className="race__legend">{t('leagueResults.rowNumber', { which })}</legend>
                <div className="race__row">
                  <div className="field">
                    <AskedLabel id={`league-row-${which}-member`} className="field__label">
                      {t('leagueResults.member')}
                    </AskedLabel>
                    {editing === null ? (
                      <Suggesting
                        shared={{
                          /* The dress of every box of a form (`forms/held.ts`), as the renderer
                             puts it on the box it hands this same component. */
                          className: heldControl(false),
                          id: `league-row-${which}-member`,
                          name: `member-${which}`,
                          'aria-required': true,
                          'aria-invalid': words !== undefined,
                          'aria-describedby': said,
                        }}
                        value={row.typed}
                        suggestions={offered}
                        /* Typing over a chosen member lets go of him, as typing over a chosen race
                           does on the member's own form: a name typed is nobody until chosen. */
                        onType={(next) => change(at, { typed: next, memberNumber: '' })}
                        onChoose={(one) => change(at, { typed: one.value, memberNumber: one.id })}
                      />
                    ) : (
                      <input
                        id={`league-row-${which}-member`}
                        className={heldControl(true)}
                        type="text"
                        readOnly
                        aria-disabled
                        value={row.typed}
                      />
                    )}
                  </div>
                </div>
                <div className="race__row">
                  {figuresAskedOn(kind).map((figure: Figure) => (
                    <div className="field" key={figure}>
                      <AskedLabel id={`league-row-${which}-${figure}`} className="field__label">
                        {t(`newResult.${figure}`)}
                      </AskedLabel>
                      <input
                        id={`league-row-${which}-${figure}`}
                        className={heldControl(false)}
                        type="text"
                        inputMode={figure === 'distanceKm' ? 'decimal' : 'numeric'}
                        value={row[figure]}
                        aria-required="true"
                        aria-invalid={words !== undefined}
                        aria-describedby={said}
                        onChange={(typed) => change(at, { [figure]: typed.target.value })}
                      />
                    </div>
                  ))}
                </div>
                {words !== undefined && (
                  <p className="field__error" id={said}>
                    {words}
                  </p>
                )}
                {editing === null && rows.length > 1 && (
                  <div className="race__actions">
                    <ActionButton
                      symbol={SYMBOL.cross}
                      word={t('leagueResults.remove')}
                      className="entity-open entity-delete"
                      name={t('leagueResults.removeRow', { which })}
                      onClick={() => {
                        setRows((were) => were.filter((_, one) => one !== at))
                        setChecked([])
                        setRefusal(null)
                      }}
                    />
                  </div>
                )}
              </fieldset>
            )
          })}
        </div>
        {/* Side by side and always the same distance apart, wrapping on a narrow page: the row of
            controls the administration already draws (`admin/Entity.css`). */}
        <p className="entity-row-actions">
          {editing === null && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                setRows((were) => [...were, newLeagueRow()])
              }}
            >
              + {t('leagueResults.addRow')}
            </button>
          )}
          <button type="submit" className="button button--primary">
            {t('leagueResults.save')}
          </button>
        </p>
        {sending && <p role="status">{t('leagueResults.saving')}</p>}
        {refusal !== null && <ServerSaid answer={refusal} refusals={THE_LEAGUE_ENTERING} />}
      </form>
    </>
  )
}

/**
 * „UNOS REZULTATA ZA DOGAĐAJ”: THE MODERATOR'S OWN SCREEN, the event, the race and the members' results
 * in one save (PDL P9, owner, 19.10.2026: „Događaj, trka i rezultat u jednoj formi, i za člana na
 * „Mojim rezultatima” i za moderatora”, „Jedan ekran za sve”; the title and the words are the owner's
 * choice of the same day).
 *
 * <p><b>Who may open it</b> is who may open the event page's entry: the right that checks results, asked
 * by the portal's guard and again by the server on the save (`ResultsByTheLeagueApi`). The rows below
 * the block are that screen's own rows (`Rows`), so a member, his figures and the refusal of a row read
 * the same on both.
 *
 * <p><b>Where the save goes</b>: an event and a race of the calendar take the rows over the event page's
 * own route; anything new goes over `POST /api/results/on-a-race-of-an-event`, which makes it with the
 * rows in one transaction. After the save the screen goes to the event's page, with no sentence of its
 * own („posle čuvanja ekran vodi na stranu događaja, bez nove rečenice”).
 */
export function EnterForAnEvent() {
  return (
    <Guard need={{ of: 'right', right: queueRight(QUEUE.results) }}>
      <TheBlockAndTheRows />
    </Guard>
  )
}

/**
 * THE TWO BOXES OF THE BLOCK THAT CARRY HELP, as definitions declare a hint (`hintKey`), so the help is
 * counted with every other help of the portal (`forms/fieldHint.test.tsx`) and never typed into a call:
 * the race's box is the member's form's own, help and all, and the event's carries the moderator's own
 * sentence („kad sačuvaš rezultate”, approved 19.10.2026) under the member's word for it.
 */
const RACE_BOX = unosRezultata.fields.filter((one) => one.name === 'raceName')
const EVENT_BOX = unosRezultata.fields
  .filter((one) => one.name === 'eventName')
  .map((one) => ({ ...one, hintKey: 'leagueResults.eventHint' }))

/** The id of the sentence under one box of the block, which that box is described by. */
const blockProblemId = (box: string) => `league-block-${box}-problem`

function TheBlockAndTheRows() {
  const { locale, t } = useI18n()
  const today = useToday()
  const events = useEvents()
  const races = useRaces()
  const runners = useRunners()
  const [block, setBlock] = useState<TheBlock>(emptyBlock)
  /* Whether a press has asked the block yet: its sentences are said after the first, as the rows' are. */
  const [pressed, setPressed] = useState(false)
  /* THE SEASONS THE SERVER SAYS ARE OPEN, for one question only: whether a new race on an event of the
     calendar may be of the other year, which is so on the morning of 1 January and never else (owner,
     22.10.2026, the exception kept beside „Ekran 7b: dan trke mora biti u godini izabranog događaja”, and
     the cost of reading them accepted) and, since 23.10.2026, whether a day of another year makes a new
     edition of a name of one edition (`aNewEditionOf`), which it never does on that morning. Not waited
     for: until they are known the day is not held to the event's year here, and the server holds it either
     way. Asked once per visit, so under a constant. */
  const open = useSeasonsOpenForAReport('league')
  const seasons = open.status === 'ready' ? open.data : null
  /* EVERY RACE EVENT BEGUN BY TODAY, OF ANY YEAR (owner, 21.10.2026: „Moderator i admin smeju da unose
     rezultate za BILO KOJU prethodnu godinu”, which overturns „NE NUDE SE STARIJI DOGAĐAJI VAN TEKUĆE
     SEZONE!” of 20.10.2026 for this screen), so no season is read off the server here. A name typed
     exactly links an event of this list only when it names one (`exactName.ts`): the same name in two
     years links neither, and the reader chooses from the list. */
  const offeredEvents = useMemo(
    () => (events.status === 'ready' ? everyEventToOffer(events.data, today) : []),
    [events, today],
  )
  const ofTheBlock = { open: seasons, offered: offeredEvents }
  /* A NEW EDITION OF THE EVENT CHOSEN (owner, 23.10.2026, „Unos trke sa imenom događaja koji ima samo
     jedno izdanje, a dan trke je u drugoj godini, pravi novo izdanje tog događaja”): the day is of another
     year than the only edition of the name, so the race goes on an event nobody has made yet and the old
     edition's races are not offered under the race's box. */
  const edition = aNewEditionOf(block, ofTheBlock)
  const linked = edition ? undefined : block.event?.eventId
  const offeredRaces = useMemo(
    () =>
      events.status === 'ready' && races.status === 'ready' && linked !== undefined
        ? racesToOffer(
            events.data.filter((one) => one.id === linked),
            races.data,
            today,
            locale,
          )
        : [],
    [events, races, linked, today, locale],
  )
  /* What a choice is looked up in: the files as they were read, and nothing while they are not, when no
     list stands under either box to choose from (the boxes say why, `unreadable`). */
  const calendar = events.status === 'ready' ? events.data : []
  const run = races.status === 'ready' ? races.data : []
  const wrong = pressed ? whatIsWrongWithTheBlock(block, today, ofTheBlock) : []
  const said = (box: string) => wrong.find((one) => one.box === box)
  const kind = kindOfTheRows(block)

  /* A box of the block, with its label, its sentence when it is wrong, and the control the caller draws. */
  const box = (name: string, label: string, control: (described: string | undefined) => ReactNode, hintKey?: string) => {
    const hint = hintKey === undefined ? undefined : t(hintKey)
    const words = said(name)
    const hintId = `league-block-${name}-hint`
    const described =
      [hint === undefined ? '' : hintId, words === undefined ? '' : blockProblemId(name)]
        .filter((one) => one !== '')
        .join(' ') || undefined

    return (
      <div className="field" key={name}>
        <AskedLabel id={`league-block-${name}`} className="field__label">
          {label}
        </AskedLabel>
        {control(described)}
        {/* The help under the box, read out with it, as the member's form says the same two sentences. */}
        {hint !== undefined && (
          <p className="rate__hint" id={hintId}>
            {hint}
          </p>
        )}
        {words !== undefined && (
          <p className="field__error" id={blockProblemId(name)}>
            {t(words.key)}
          </p>
        )}
      </div>
    )
  }

  const above = (
    <div className="races">
      <fieldset className="race">
        <legend className="race__legend">{t('newResult.eventName')}</legend>
        <div className="race__row">
          {box(
            'eventName',
            t('newResult.eventName'),
            (described) => (
              <Suggesting
                shared={{
                  className: heldControl(false),
                  id: 'league-block-eventName',
                  name: 'eventName',
                  maxLength: limitOf(dogadjaj, 'name'),
                  'aria-required': true,
                  'aria-invalid': said('eventName') !== undefined,
                  'aria-describedby': described,
                }}
                value={block.eventName}
                suggestions={offeredEvents}
                unreadable={
                  events.status === 'error' ? { said: t('data.error'), named: t('admin.events'), read: events } : undefined
                }
                onType={(next) => setBlock((now) => typingTheEvent(now, next, offeredEvents, calendar))}
                onChoose={(one) => setBlock((now) => choosingTheEvent(now, one, calendar))}
              />
            ),
            hintOf(EVENT_BOX),
          )}
          {/* A new event's one date, and a new race's own day on an event of the calendar, which starts
              as the event's; a race of the calendar has its day, so none is asked. */}
          {block.race === null &&
            box('date', t(block.event === null ? 'admin.field.date' : 'newResult.date'), (described) => (
              <DatePicker
                id="league-block-date"
                name="date"
                required
                value={block.date}
                invalid={said('date') !== undefined}
                describedBy={described}
                within={yearsOfTheDay(block, seasons, offeredEvents)}
                onChange={(next) => setBlock((now) => changingTheDay(now, next, ofTheBlock))}
              />
            ))}
          {(block.event === null || edition) &&
            box('city', t('newResult.city'), (described) => (
              <PlaceField
                id="league-block-city"
                name="city"
                required
                value={block.city}
                country={block.country}
                wrote={block.countryWrote}
                invalid={said('city') !== undefined}
                describedBy={described}
                onChange={(city, country, wrote) => setBlock((now) => withThePlace(now, city, country, wrote))}
              />
            ))}
        </div>
        <div className="race__row">
          {box(
            'raceName',
            t('newResult.raceName'),
            (described) => (
              <Suggesting
                shared={{
                  className: heldControl(false),
                  id: 'league-block-raceName',
                  name: 'raceName',
                  maxLength: limitOf(unosRezultata, 'raceName'),
                  'aria-required': true,
                  'aria-invalid': said('raceName') !== undefined,
                  'aria-describedby': described,
                }}
                value={block.raceName}
                suggestions={offeredRaces}
                unreadable={
                  races.status === 'error' ? { said: t('data.error'), named: t('event.races'), read: races } : undefined
                }
                onType={(next) => setBlock((now) => typingTheRace(now, next))}
                onChoose={(one) => setBlock((now) => choosingTheRace(now, one, run))}
              />
            ),
            hintOf(RACE_BOX),
          )}
          {block.race === null &&
            box('raceKind', t('newResult.raceKind'), () => (
              <select
                id="league-block-raceKind"
                className={heldControl(false)}
                aria-required="true"
                value={block.kind}
                onChange={(chosen) => setBlock((now) => ({ ...now, kind: raceKind(chosen.target.value) }))}
              >
                {unosRezultata.fields
                  .filter((one) => one.name === 'raceKind')
                  .flatMap((field) => optionsFor(field, {}))
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
              </select>
            ))}
        </div>
        {block.race === null && block.kind === 'time' && <p className="rate__hint">{t('review.limitNote')}</p>}
        {block.race === null && figuresOfANewRace(block.kind).length > 0 && (
          <div className="race__row">
            {figuresOfANewRace(block.kind).map((figure) =>
              box(figure, t(`newResult.${figure}`), (described) => (
                <input
                  id={`league-block-${figure}`}
                  className={heldControl(false)}
                  type="text"
                  inputMode={figure === 'distanceKm' ? 'decimal' : 'numeric'}
                  aria-required="true"
                  aria-invalid={said(figure) !== undefined}
                  aria-describedby={described}
                  value={block[figure]}
                  onChange={(typed) => setBlock((now) => ({ ...now, [figure]: typed.target.value }))}
                />
              )),
            )}
          </div>
        )}
      </fieldset>
    </div>
  )

  return (
    <div className="member">
      <Resource state={runners}>
        {(listed) => (
          <Rows
            heading={t('leagueResults.forAnEvent')}
            kind={kind}
            runners={listed}
            editing={null}
            above={above}
            blockIsWrong={() => {
              setPressed(true)

              return whatIsWrongWithTheBlock(block, today, ofTheBlock).length > 0
            }}
            save={(rows, asked) =>
              block.race !== null
                ? theLeagueEntered(
                    block.race.raceId,
                    rows.map((one) => bodyOf(one, asked)),
                  )
                : theLeagueEnteredOnAnEvent({
                    ...eventAndRaceOf(block, ofTheBlock),
                    rows: rows.map((one) => bodyOf(one, asked)),
                  })
            }
            after={(answer) => theEventPageAfter(block, theEventSavedOn(answer), locale)}
          />
        )}
      </Resource>
    </div>
  )
}
