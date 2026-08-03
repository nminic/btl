import { useState } from 'react'
import { Link, useParams } from 'react-router'
import liga from '../forms/definitions/admin-liga.form.json'
import { limitOf } from '../forms/records'
import type { FormDef } from '../forms/types'
import { PageMeta } from '../app/PageMeta'
import { PartsNav } from '../components/PartsNav'
import { Resource } from '../components/Resource'
import { useMay } from './admin/rights'
import { useSession } from '../session/useSession'
import { combinePair, useEvents, useLeagues } from '../data/useResource'
import { formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { LeagueResults } from './league/LeagueResults'
import './Profile.css'

/* A league is a subset of events and a way of grouping the field, never a
 * different scoring formula. Its own page is therefore mostly the list of
 * events that count towards it, plus the rules and prizes that are written for
 * it. Both of those hide themselves while nobody has written them. */
function EditableText({
  value,
  headingId,
  heading,
  canEdit,
  onSave,
}: {
  id: string
  field: string
  value: string
  headingId: string
  heading: string
  canEdit: boolean
  onSave: (text: string) => void
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)

  if (value === '' && !canEdit) {
    return null
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 className="profile__section" id={headingId}>
        {heading}
      </h2>

      {editing ? (
        <textarea
          className="field__control league__editor"
          autoFocus
          aria-label={heading}
          defaultValue={value}
          /* The same cap the administration form puts on it. Rewriting in place
             took as much as anybody cared to paste, so the text could come back
             longer than the form that made it accepts, and the next person to
             open that form was told their own words were too long. The number
             lives in the definition (src/forms/records.ts). */
          maxLength={limitOf(liga as FormDef, 'rules')}
          onBlur={(event) => {
            onSave(event.target.value)
            setEditing(false)
          }}
        />
      ) : (
        <p className="profile__text">{value === '' ? t('leagues.notWritten') : value}</p>
      )}

      {canEdit && !editing && (
        <button type="button" className="button button--secondary" onClick={() => setEditing(true)}>
          {t('admin.change')}
        </button>
      )}
    </section>
  )
}

/**
 * One competition, in two parts (owner, 31.07.2026), the same shape the profile
 * has: the standing, and what the organiser has written about it.
 *
 * The list of events that count is under the standing rather than under the
 * writing, because it is the key to the columns above it: the grid names a race
 * and a date, and this says where and how many.
 */
export function LeagueDetail({ part = 'rules' }: { part?: 'results' | 'rules' } = {}) {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  /* The rules and the prizes of a competition are the league record, so the
     pencil beside them is the right to edit leagues and not the fact of being
     staff (PDL P21). A moderator who may judge results has no business rewriting
     what a competition awards. */
  const may = useMay()
  const { edits, edit } = useSession()
  /* Only what the head and the parts need. The grid asks for the races, the
     results and the members itself, so a competition still names itself while
     the heaviest file on the portal is on its way. */
  const state = combinePair(useLeagues(), useEvents())

  return (
    <Resource state={state}>
      {([leagues, events]) => {
        const league = leagues.find((one) => one.slug === slug)

        if (league === undefined) {
          return <h1>{t('leagues.notFound')}</h1>
        }

        const counting = events
          .filter((event) => league.eventIds.includes(event.id))
          .sort((left, right) => left.date.localeCompare(right.date))
        const base = `/${locale}/liga/${league.slug}`

        return (
          <>
            {/* The name of a competition already carries its season, so it is
                the whole title on its own. */}
            {/* Two addresses, two names. They shared one, and two indexable
                pages under one title is the fault the profile already avoids by
                naming its awards apart from itself. */}
            <PageMeta
              title={t(
                part === 'results' ? 'seo.leagueResults.recordTitle' : 'seo.league.recordTitle',
                { name: league.name },
              )}
              description={t(
                part === 'results'
                  ? 'seo.leagueResults.recordDescription'
                  : 'seo.league.recordDescription',
                { name: league.name, season: league.season },
              )}
            />

            <div className="profile">
              <header className="profile__head">
                <p className="profile__meta">
                  <Link to={`/${locale}/lige`}>{t('leagues.backToLeagues')}</Link>
                </p>
                <h1>{league.name}</h1>
                {/* Nothing under the name (owner, 31.07.2026). The season is in
                    the name of every competition already, and how the field is
                    grouped is a rule of the competition, so it belongs in its
                    terms rather than in a label. The parts follow straight
                    after. */}
              </header>

              <PartsNav
                label={t('leagues.parts.label')}
                parts={[
                  { to: base, end: true, label: t('leagues.parts.rules') },
                  { to: `${base}/rezultati`, label: t('leagues.parts.results') },
                ]}
              />

              {part === 'rules' ? (
                <>
                  {/* The competition's own administrator writes both; until
                      somebody does, the section is not there at all. */}
                  <EditableText
                    id={league.id}
                    field="rules"
                    value={edits[league.id]?.rules ?? league.rules}
                    headingId="league-rules"
                    heading={t('leagues.rules')}
                    canEdit={may('entity:leagues')}
                    onSave={(text) => edit(league.id, 'rules', text)}
                  />

                  <EditableText
                    id={league.id}
                    field="prizes"
                    value={edits[league.id]?.prizes ?? league.prizes}
                    headingId="league-prizes"
                    heading={t('leagues.prizes')}
                    canEdit={may('entity:leagues')}
                    onSave={(text) => edit(league.id, 'prizes', text)}
                  />

                  {/* The events that count, under what is written about them
                      (owner, 31.07.2026). They are the terms of the competition
                      rather than its result: which races you have to run is part
                      of what the organiser is telling you. */}
                  <h2 className="profile__section">
                    {t('leagues.countingEvents')}{' '}
                    <span className="profile__count">{counting.length}</span>
                  </h2>

                  {counting.length === 0 ? (
                    <p className="profile__empty">{t('leagues.noEvents')}</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="table">
                        <caption className="visually-hidden">{t('leagues.countingEvents')}</caption>
                        <thead>
                          <tr>
                            <th scope="col">{t('profile.columns.date')}</th>
                            <th scope="col">{t('profile.columns.event')}</th>
                            <th scope="col">{t('event.place')}</th>
                            <th scope="col">{t('event.races')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {counting.map((event) => (
                            <tr key={event.id}>
                              <td>{formatShortDate(event.date, locale)}</td>
                              <td>
                                <Link to={`/${locale}/kalendar/${event.slug}`}>{event.name}</Link>
                              </td>
                              <td>{event.city}</td>
                              <td>{event.raceIds.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <LeagueResults league={league} events={events} />
              )}
            </div>
          </>
        )
      }}
    </Resource>
  )
}
