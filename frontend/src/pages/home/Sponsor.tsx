import type { SponsorShown } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'

/**
 * „Sponzor dana", in the right column between the calendar and the calculator (PDL P24, variant A,
 * owner 18.11.2026).
 *
 * The logo centred at the top, 64px tall, and the name centred under it, both one link, and the two
 * lines of the description under them, aligned left: „Opis je poravnat levo, a logo i naziv su
 * centrirani." The domain is not written out anywhere („Domen sponzora se ne ispisuje"), and there
 * are no links at the foot of the box („Dve veze na dnu boksa se ne prave").
 *
 * **One link around the logo and the name, not two**, as the draft the owner approved draws it
 * (`predlozi/sponzori-nacrt-desna-kolona.html`, „Veze, i zašto jedna"): a press on either goes to the
 * sponsor, a keyboard takes one step instead of two, and a screen reader hears the name once. The
 * logo is therefore decoration inside the link (`alt=""`); the name of the link is the name of the
 * sponsor, and the sentence that it opens in a new window.
 *
 * Drawn only for a sponsor there is. Which one, and whether there is one at all, is the server's
 * answer (`SponsorApi`, „„Sponzor dana” se smenjuje po danu, a glavni sponzor ide duplo češće od bilo
 * kog drugog", PDL 24.11.2026), read once on the front page, which also decides the number of races in
 * the calendar and the shape of the grid by it (`Home.tsx`).
 *
 * **The description carries the language it is really written in** (`SponsorShown.language`): on `/en`
 * a sponsor with no English description is answered in Serbian („ako engleska nije upisana, engleska
 * naslovna pokazuje srpsku"), and `lang="sr"` is what keeps a screen reader from reading Serbian words
 * with English phonetics (WCAG 3.1.2), the reason `PageSectionBody` marks a written page the same way.
 * The name carries none: it is a name, the same in both.
 */
export function Sponsor({ sponsor }: { sponsor: SponsorShown }) {
  const { t } = useI18n()

  return (
    <section className="card sponsor-day" aria-labelledby="sponsor-heading">
      <h2 className="card__title" id="sponsor-heading">
        {t('home.sponsorOfTheDay')}
      </h2>
      <div className="sponsor-day__top">
        <a className="sponsor-day__link" href={sponsor.url} target="_blank" rel="noreferrer noopener">
          <img className="sponsor-day__logo" src={sponsor.logo} alt="" />
          <span className="sponsor-day__name">{sponsor.name}</span>{' '}
          <span className="visually-hidden">{t('home.opensInNewWindow')}</span>
        </a>
      </div>
      <p className="sponsor-day__text" lang={sponsor.language}>
        {sponsor.description}
      </p>
    </section>
  )
}

/**
 * The strip of every sponsor, across the full width under both columns (PDL P24, 18.11.2026).
 *
 * One tile of 120×48 for each, the same for all, with the logo centred in it and never distorted. The
 * rows and the spaces between the tiles are the stylesheet's (`Home.css`, `.sponsor-strip__row`): as
 * many as fit with at least 16px between them, the space growing until the row fills the strip but
 * never past 72px, and past that the row gathers in the middle, as does a last row that is not full.
 * The stylesheet is told how many there are (`--sponsors`), because a row of three is spaced as three
 * and not as the seven the width would hold.
 *
 * The name of each link is the logo's own `alt`, which is the sponsor's name, and the sentence that it
 * opens in a new window.
 *
 * **In the order the server gives, and never sorted again here**: „Redosled u traci: glavni sponzor
 * prvi, pa ručni redosled koji se podešava u administraciji" (PDL 24.11.2026), and the manual order is
 * a number this page is never handed.
 */
export function SponsorStrip({ sponsors }: { sponsors: SponsorShown[] }) {
  const { t } = useI18n()

  return (
    <section className="sponsor-strip" aria-label={t('home.partners')}>
      <ul className="sponsor-strip__row" style={{ '--sponsors': sponsors.length }}>
        {sponsors.map((one) => (
          <li key={one.id}>
            <a className="sponsor-strip__tile" href={one.url} target="_blank" rel="noreferrer noopener">
              <img className="sponsor-strip__logo" src={one.logo} alt={one.name} />{' '}
              <span className="visually-hidden">{t('home.opensInNewWindow')}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
