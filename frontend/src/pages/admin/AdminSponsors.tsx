import { useEffect, useRef, useState } from 'react'
import { SYMBOL } from '../../app/actionSymbol'
import { ActionButton } from '../../components/ActionButton'
import { Resource } from '../../components/Resource'
import type { SponsorEntered } from '../../data/types'
import { useEnteredSponsors, useHowManyTimesDropped } from '../../data/useResource'
import type { FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { DeletionSaid } from './DeletionSaid'
import { EntityBar, EntityEditor, RowActions, type Saving } from './EntityEditor'
import { SPONSORS, type Editing } from './entityForms'
import { identityIn } from './leagueWrites'
import { SponsorLogo } from './SponsorLogo'
import { theMoveOf, theSponsor, theSponsorsHaveChanged, upsertFrom, WHEN_WRITING_A_SPONSOR } from './sponsorWrites'
import '../member/Member.css'
import './Sponsors.css'

/** Why a write on a row did not happen, beside the row it was pressed on. */
type Refused = { id: number; answer: Exclude<Answer, { got: 'done' }> }

/** What the form is open on: a new sponsor, or one of the list as it was served. */
type Opened = { mode: 'new' } | { mode: 'one'; sponsor: SponsorEntered }

/** The arrow pressed last, put back under the focus once the list stands in its new order, which is a
 *  list that is not the one the press was made on (`from`). */
type Moved = { id: number; way: 'up' | 'down'; from: SponsorEntered[] }

/** The address of an arrow, which is how the focus finds it again after the rows have moved. */
function arrowOf(id: number, way: 'up' | 'down'): string {
  return `sponsor-${String(id)}-${way}`
}

/**
 * THE SPONSORS, IN ADMINISTRATION → PODACI → SPONZORI (owner, PDL 24.11.2026: „Zelim da mogu da u
 * sekciji Administracija > Podaci odem na Sponzori, i da tu dodajem, menjam ili brisem sponzore.").
 *
 * <p><b>The shape of the competitions' screen</b> (`AdminLeagues.tsx`): a list, a button that adds, a
 * pencil that opens the form and a cross that asks before it deletes, every write through a route and
 * nothing written that a route has not accepted. The logo is sent from inside the form, at once, as a
 * league's mark is (`SponsorLogo.tsx`).
 *
 * <p><b>WHAT IS DIFFERENT FROM THAT SCREEN, AND WHY: THE LIST IS READ AGAIN AFTER EVERY WRITE</b>, rather
 * than what was typed laid over the list this visit was first served. One write here moves more than its
 * own row. Marking a new main sponsor takes the mark off the old one in the same write („označavanje novog
 * glavnog sponzora skida oznaku sa prethodnog", the plan approved 24.11.2026), and an arrow swaps two
 * places at once; an overlay of the one row written would draw two main sponsors, or two sponsors in one
 * place. The server holds both halves, so every write drops the answer (`theSponsorsHaveChanged`) and the
 * list that is still mounted asks again through its revision (`useHowManyTimesDropped`). The list stands
 * as it was while the new answer is on its way, so nothing flickers.
 *
 * <p><b>In the order of the strip and never sorted here</b>: „Redosled u traci: glavni sponzor prvi, pa
 * ručni redosled koji se podešava u administraciji." The main sponsor stands first whatever its place, so
 * it is offered no arrows; every other one is moved one place at a time among the ones that are not main
 * (`SponsorWriteApi.move`), and the first one up and the last one down are offered and refused, so the
 * column does not change shape from row to row.
 */
export function AdminSponsors() {
  const { t } = useI18n()
  const state = useEnteredSponsors(useHowManyTimesDropped('sponsors/all'))

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the tab; it stays in the markup so
          the page has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.sponsors')}</h1>

      <Resource state={state}>{(sponsors) => <Sponsors sponsors={sponsors} />}</Resource>
    </div>
  )
}

function Sponsors({ sponsors: served }: { sponsors: SponsorEntered[] }) {
  const { t } = useI18n()
  /* THE SPONSORS THIS VISIT HAS DELETED, out of the list in the turn the route says yes, and not only once
     the list has been read again: the question closes with its row, and the focus goes to „Novi sponzor"
     in the same turn (`RowActions`), which it could not do over a row still standing. Only what a route
     has accepted is held here, and the list read again no longer carries it anyway. */
  const [gone, setGone] = useState<number[]>([])
  const sponsors = served.filter((one) => !gone.includes(one.id))
  const [opened, setOpened] = useState<Opened | null>(null)
  /** What just happened, for whoever is not watching the list. */
  const [said, setSaid] = useState('')
  const [refused, setRefused] = useState<Refused | null>(null)
  /* An arrow whose move is out, read in the handler: a second press before the list is read again would
     move the sponsor from a place it has already left. */
  const moving = useRef(false)
  const [moved, setMoved] = useState<Moved | null>(null)

  /* THE FOCUS FOLLOWS THE SPONSOR IT MOVED, and not the place it was in. The rows are drawn again in the
     server's new order, so the button that was pressed is either moved by the browser or drawn afresh,
     and in neither case is the focus left where the reader put it. Asked once the new list is here,
     which is the first render in which the served list is not the one the press was made on. */
  useEffect(() => {
    if (moved !== null && moved.from !== served) {
      document.getElementById(arrowOf(moved.id, moved.way))?.focus()
      setMoved(null)
    }
  }, [served, moved])

  const notMain = sponsors.filter((one) => !one.main)

  /**
   * MAKING ONE OR CHANGING ONE, the arrangement `AdminLeagues.saveOne` has: `POST` answers 201 with the id
   * the database handed out, `PUT` answers 200, and a refusal is said in the words of
   * `WHEN_WRITING_A_SPONSOR`.
   */
  async function saveOne(values: FormValues, open: Editing): Promise<Saving> {
    const id = open.mode === 'one' ? Number(open.record[SPONSORS.idField]) : null
    const answer = await askTheServer(
      id === null ? '/api/sponsors' : theSponsor(id),
      upsertFrom(values),
      id === null ? 'POST' : 'PUT',
    )

    if (answer.got !== 'done') {
      return { said: <ServerSaid answer={answer} refusals={WHEN_WRITING_A_SPONSOR} /> }
    }

    theSponsorsHaveChanged()

    if (id !== null) {
      return { written: String(id) }
    }

    /* The write happened and the answer did not say under which id, so there is no address for the
       logo of the new sponsor: the truth, and nothing drawn (the sentence `AdminLeagues` says). */
    const made = identityIn(answer.body)

    if (made === null) {
      return {
        said: (
          <p className="field__error" role="alert">
            {t('admin.sponsorSavedUnseen')}
          </p>
        ),
      }
    }

    return { written: String(made) }
  }

  /** Taking one away, and with it its logo (the plan approved 24.11.2026, „brisanje sponzora briše i njegov logo"). */
  async function deleteOne(sponsor: SponsorEntered): Promise<void> {
    const answer = await askTheServer(theSponsor(sponsor.id), {}, 'DELETE')

    if (answer.got !== 'done') {
      setRefused({ id: sponsor.id, answer })
      setSaid('')

      return
    }

    theSponsorsHaveChanged()
    setGone((were) => [...were, sponsor.id])
    setRefused(null)
    setSaid(t('admin.sponsorGone'))
  }

  /** One place earlier or later among the sponsors that are not main. */
  async function move(sponsor: SponsorEntered, way: 'up' | 'down'): Promise<void> {
    moving.current = true
    setSaid('')

    const answer = await askTheServer(theMoveOf(sponsor.id, way), {})

    moving.current = false

    if (answer.got !== 'done') {
      setRefused({ id: sponsor.id, answer })

      return
    }

    setRefused(null)
    setMoved({ id: sponsor.id, way, from: served })
    theSponsorsHaveChanged()
  }

  if (opened !== null) {
    const editing: Editing = opened.mode === 'one' ? { mode: 'one', record: opened.sponsor } : { mode: 'new' }

    return (
      <EntityEditor
        entity={SPONSORS}
        editing={editing}
        save={(values) => saveOne(values, editing)}
        /* THE LOGO STANDS IN THE FORM OF A SPONSOR THAT EXISTS, under its fields, as a league's mark does: a
           new one has no id until the route hands it out, and the logo is sent to `/api/sponsors/{id}/logo`. */
        beneath={opened.mode === 'one' ? () => <SponsorLogo sponsor={opened.sponsor} /> : undefined}
        onDone={() => setOpened(null)}
      />
    )
  }

  return (
    <>
      <EntityBar entity={SPONSORS} onNew={() => setOpened({ mode: 'new' })} />

      <DeletionSaid said={said} clear={setSaid} />

      <div className="table-scroll">
        <table className="table">
          <caption className="visually-hidden">{t('admin.sponsors')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('admin.field.sponsorName')}</th>
              <th scope="col">{t('admin.sponsorLogo')}</th>
              <th scope="col">{t('admin.sponsorMain')}</th>
              <th scope="col">{t('admin.sponsorInRotation')}</th>
              <th scope="col">{t('admin.sponsorInStrip')}</th>
              <th scope="col">{t('admin.sponsorOrder')}</th>
              <th scope="col">{t('admin.form.record')}</th>
            </tr>
          </thead>
          <tbody>
            {sponsors.map((sponsor) => {
              const place = notMain.indexOf(sponsor)

              return (
                <tr key={sponsor.id}>
                  <td>{sponsor.name}</td>
                  <td>
                    {sponsor.logo === null ? (
                      /* Derived and not the owner's sentence (24.11.2026, `SponsorApi`): a sponsor with no
                         logo stands neither in the box nor in the strip, so the row says why it is not on
                         the front page. */
                      <span className="tag tag--checking">{t('admin.sponsorNoLogo')}</span>
                    ) : (
                      <span className="sponsor-row__logo">
                        <img src={sponsor.logo} alt={t('sponsorLogo.alt', { name: sponsor.name })} />
                      </span>
                    )}
                  </td>
                  <td>{t(sponsor.main ? 'admin.yes' : 'admin.no')}</td>
                  <td>{t(sponsor.inRotation ? 'admin.yes' : 'admin.no')}</td>
                  <td>{t(sponsor.inStrip ? 'admin.yes' : 'admin.no')}</td>
                  <td>
                    {sponsor.main ? (
                      t('admin.sponsorMainFirst')
                    ) : (
                      <span className="sponsor-row__order">
                        <Arrow
                          sponsor={sponsor}
                          way="up"
                          held={place === 0}
                          onMove={() => {
                            if (!moving.current) {
                              void move(sponsor, 'up')
                            }
                          }}
                        />
                        <Arrow
                          sponsor={sponsor}
                          way="down"
                          held={place === notMain.length - 1}
                          onMove={() => {
                            if (!moving.current) {
                              void move(sponsor, 'down')
                            }
                          }}
                        />
                      </span>
                    )}
                  </td>
                  <td>
                    <RowActions
                      entity={SPONSORS}
                      asks={t('admin.sponsorDeleteAsk')}
                      asksWith={t('admin.sponsorDeleteWith')}
                      record={sponsor}
                      name={sponsor.name}
                      onOpen={() => setOpened({ mode: 'one', sponsor })}
                      deleteRecord={() => deleteOne(sponsor)}
                      onKeep={() => setRefused((was) => (was !== null && was.id === sponsor.id ? null : was))}
                    />
                    {refused !== null && refused.id === sponsor.id && (
                      <ServerSaid answer={refused.answer} refusals={WHEN_WRITING_A_SPONSOR} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

/**
 * ONE ARROW OF THE MANUAL ORDER. The first one up and the last one down are held rather than left out
 * (`aria-disabled`, and the press refused in the handler), the way every control that cannot act is on
 * this portal: the reader meets the same two controls on every row, and the focus is never on a button
 * that has just gone.
 */
function Arrow({
  sponsor,
  way,
  held,
  onMove,
}: {
  sponsor: SponsorEntered
  way: 'up' | 'down'
  held: boolean
  onMove: () => void
}) {
  const { t } = useI18n()

  return (
    <ActionButton
      id={arrowOf(sponsor.id, way)}
      symbol={way === 'up' ? SYMBOL.up : SYMBOL.down}
      word={t(way === 'up' ? 'admin.sponsorUp' : 'admin.sponsorDown')}
      name={t(way === 'up' ? 'admin.sponsorUpNamed' : 'admin.sponsorDownNamed', { name: sponsor.name })}
      className="entity-open"
      aria-disabled={held}
      onClick={() => {
        if (!held) {
          onMove()
        }
      }}
    />
  )
}
