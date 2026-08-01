import { useI18n } from '../../i18n/useI18n'
import type { SponsorEntry } from './content'

export function Sponsor({ sponsors }: { sponsors: SponsorEntry[] }) {
  const { t } = useI18n()
  // The one whose day it is, and nothing at all on a day with no sponsor: an
  // empty card under a heading reads as a sponsor whose name failed to load.
  const [ofTheDay] = sponsors

  if (ofTheDay === undefined) {
    return null
  }

  return (
    <section className="card" aria-labelledby="sponsor-heading">
      <h2 className="card__title" id="sponsor-heading">
        {t('home.sponsorOfTheDay')}
      </h2>
      <p className="sponsor__name">{ofTheDay.name}</p>
    </section>
  )
}

export function SponsorStrip({ sponsors }: { sponsors: SponsorEntry[] }) {
  const { t } = useI18n()

  if (sponsors.length === 0) {
    return null
  }

  return (
    <section className="sponsor-strip" aria-label={t('home.partners')}>
      {sponsors.map((one) => (
        <span key={one.id}>{one.name}</span>
      ))}
    </section>
  )
}
