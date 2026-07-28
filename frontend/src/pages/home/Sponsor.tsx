import { useI18n } from '../../i18n/useI18n'
import type { SponsorEntry } from './content'

export function Sponsor({ sponsors }: { sponsors: SponsorEntry[] }) {
  const { t } = useI18n()

  if (sponsors.length === 0) {
    return null
  }

  return (
    <section className="card" aria-labelledby="sponsor-heading">
      <h2 className="card__title" id="sponsor-heading">
        {t('home.sponsorOfTheDay')}
      </h2>
      <p className="sponsor__name">{sponsors[0].name}</p>
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
