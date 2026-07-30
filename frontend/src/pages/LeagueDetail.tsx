import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { Resource } from '../components/Resource'
import { isStaff } from '../roles/context'
import { useRole } from '../roles/useRole'
import { useSession } from '../session/useSession'
import { combinePair, useEvents, useLeagues } from '../data/useResource'
import { formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
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

export function LeagueDetail() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const { role } = useRole()
  const { edits, edit } = useSession()
  /* Only what the page shows. The league lists its events, and never the races
   * on them, so waiting on the races turned one failed file into an error
   * message over data nothing here reads. */
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

        return (
          <>
            {/* The name of a competition already carries its season, so it is
                the whole title on its own. */}
            <PageMeta
              title={t('seo.league.recordTitle', { name: league.name })}
              description={t('seo.league.recordDescription', {
                name: league.name,
                season: league.season,
              })}
            />

            <div className="profile">
              <header className="profile__head">
                <p className="profile__meta">
                  <Link to={`/${locale}/lige`}>{t('leagues.backToLeagues')}</Link>
                </p>
                <h1>{league.name}</h1>
                <p className="profile__meta">
                  {t('leagues.season', { season: league.season })}
                  {' · '}
                  {league.groupsByCategory ? t('leagues.byCategory') : t('leagues.byGenderOnly')}
                </p>
              </header>

              {/* The competition's own administrator writes this; until somebody
                  does, the section is not there at all. */}
              <EditableText
                id={league.id}
                field="rules"
                value={edits[league.id]?.rules ?? league.rules}
                headingId="league-rules"
                heading={t('leagues.rules')}
                canEdit={isStaff(role)}
                onSave={(text) => edit(league.id, 'rules', text)}
              />

              <EditableText
                id={league.id}
                field="prizes"
                value={edits[league.id]?.prizes ?? league.prizes}
                headingId="league-prizes"
                heading={t('leagues.prizes')}
                canEdit={isStaff(role)}
                onSave={(text) => edit(league.id, 'prizes', text)}
              />

              <h2 className="profile__section">
                {t('leagues.countingEvents')}{' '}
                <span className="profile__count">{counting.length}</span>
              </h2>

              {counting.length === 0 ? (
                <p className="profile__empty">{t('leagues.noEvents')}</p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
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
            </div>
          </>
        )
      }}
    </Resource>
  )
}
