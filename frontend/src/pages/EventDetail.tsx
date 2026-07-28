import { Link, useParams } from 'react-router'
import { Resource } from '../components/Resource'
import { useEvents, useRaces } from '../data/useResource'
import { formatDate, formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Profile.css'

/* The races load separately from the event on purpose: the heading, the date
 * and the organiser are useful the moment they arrive, and the race table is
 * the heavier half. */
function RaceTable({ eventId }: { eventId: string }) {
  const { locale, t } = useI18n()
  const races = useRaces()

  return (
    <Resource state={races}>
      {(all) => (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('event.raceName')}</th>
                <th scope="col">{t('event.category')}</th>
                <th scope="col">{t('event.distance')}</th>
                <th scope="col" className="table__hide-phone">
                  {t('event.ascent')}
                </th>
                <th scope="col" className="table__hide-phone">
                  {t('event.descent')}
                </th>
              </tr>
            </thead>
            <tbody>
              {all
                .filter((race) => race.eventId === eventId)
                .map((race) => (
                  <tr key={race.id}>
                    <td>{race.name}</td>
                    <td>{t(`category.${race.category}`)}</td>
                    <td>{formatNumber(race.distanceKm, locale, 2)}</td>
                    <td className="table__hide-phone">{formatNumber(race.ascentM, locale)}</td>
                    <td className="table__hide-phone">{formatNumber(race.descentM, locale)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </Resource>
  )
}

export function EventDetail() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const events = useEvents()

  return (
    <Resource state={events}>
      {(all) => {
        const event = all.find((one) => one.slug === slug)

        if (event === undefined) {
          return <h1>{t('event.notFound')}</h1>
        }

        return (
          <div className="profile">
            <header className="profile__head">
              <p className="profile__meta">
                <Link to={`/${locale}/kalendar?mesec=${event.date.slice(0, 7)}`}>
                  {t('event.backToCalendar')}
                </Link>
              </p>
              <h1>{event.name}</h1>
              <p className="profile__meta">
                {formatDate(event.date, locale)}
                {' · '}
                {event.city}
                {' · '}
                {t(`calendar.status.${event.status}`)}
              </p>
              <p className="profile__meta">
                {t('event.organizer')}
                {': '}
                {event.organizer}
              </p>
            </header>

            <h2 className="profile__section">{t('event.races')}</h2>

            <RaceTable eventId={event.id} />
          </div>
        )
      }}
    </Resource>
  )
}
