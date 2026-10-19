import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useFilterParams } from '../../app/useFilterParams'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { raceKind } from '../../data/raceKind'
import { raceLabel } from '../../data/raceLabel'
import { inEventOrder } from '../../data/raceOrder'
import { combineFour, useEvents, useRaces, useResults, useRunners } from '../../data/useResource'
import type { BtlEvent, Race, RaceKind, Result, Runner } from '../../data/types'
import { AskedLabel } from '../../forms/AskedLabel'
import { heldControl } from '../../forms/held'
import { Suggesting } from '../../forms/Suggesting'
import { useI18n } from '../../i18n/useI18n'
import type { Answer, RowRefused } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { wordsFor as wordsOfTheServer } from '../account/serverWords'
import { Guard } from '../admin/Guard'
import { QUEUE } from '../admin/queues'
import { queueRight } from '../admin/rights'
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
import { theLeagueChanged, theLeagueEntered, THE_LEAGUE_ENTERING } from './leagueResultWrites'
import '../admin/Entity.css'
import '../member/Member.css'

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
  const { t } = useI18n()
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

          if (asked === null) {
            return <Rows event={event} race={race} among={run} runners={runners} editing={null} />
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
             is every member a result can name; his number where the list does not know it. */
          const runner = runners.find((one) => one.memberNumber === result.memberNumber)
          const name = runner === undefined ? String(result.memberNumber) : runnerLabel(runner)

          return (
            <Rows event={event} race={race} among={run} runners={runners} editing={{ result, name }} />
          )
        }}
      </Resource>
    </div>
  )
}

function Rows({
  event,
  race,
  among,
  runners,
  editing,
}: {
  event: BtlEvent
  race: Race
  among: Race[]
  runners: Runner[]
  editing: { result: Result; name: string } | null
}) {
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  /* Read through the one function that knows the three words (`data/raceKind.ts`): the record comes
     out of a file nothing checks, and a word that is not one of the three would draw no boxes. */
  const kind: RaceKind = raceKind(race.kind)
  const [rows, setRows] = useState<LeagueRow[]>(() =>
    editing === null ? [newLeagueRow()] : [rowOf(editing.result, String(editing.result.memberNumber), editing.name)],
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
  const back = `/${locale}/kalendar/${event.slug}`

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

    setChecked(wrong)
    setRefusal(null)

    if (wrong.some((one) => one !== undefined)) {
      return
    }

    outstanding.current = true
    setSending(true)

    const asking =
      editing === null
        ? theLeagueEntered(
            race.id,
            rows.map((one) => bodyOf(one, kind)),
          )
        : theLeagueChanged(race.id, editing.result.id, figuresOf(theOnlyRow(rows), kind))
    const answer = await asking

    outstanding.current = false
    setSending(false)

    if (answer.got !== 'done') {
      setRefusal(answer)

      return
    }

    void navigate(back)
  }

  function onSubmit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault()

    if (outstanding.current) {
      return
    }

    void send()
  }

  const title =
    editing === null
      ? t('leagueResults.title', { race: raceLabel(race, among, locale) })
      : t('leagueResults.editTitle', { name: editing.name })

  return (
    <>
      <h1>{title}</h1>
      <form noValidate onSubmit={onSubmit}>
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
                    <button
                      type="button"
                      className="entity-open entity-delete"
                      aria-label={t('leagueResults.removeRow', { which })}
                      onClick={() => {
                        setRows((were) => were.filter((_, one) => one !== at))
                        setChecked([])
                        setRefusal(null)
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </fieldset>
            )
          })}
        </div>
        <p className="member__actions">
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
