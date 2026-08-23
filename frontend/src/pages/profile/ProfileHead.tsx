import { profilePath } from '../profileAddress'
import { categoryLabel } from '../../data/categories'
import { Link } from 'react-router'
import { PartsNav } from '../../components/PartsNav'
import { Portrait } from '../../components/Portrait'
import { SeasonPicker } from '../../components/SeasonPicker'
import { categoryOfMember } from '../../data/derive'
import { SEASON } from '../../data/pricing'
import type { Competitor, Team } from '../../data/types'
import { Sentence } from '../../i18n/Sentence'
import { useI18n } from '../../i18n/useI18n'

/**
 * Who the person is, above everything else, and the same on every part of the
 * profile (PDL P11 puts it above the fold).
 *
 * The name stands alone in the heading. The club used to sit in brackets right
 * after it and now stands in the line below, as the continuation of how long
 * this person has been around: "U ligi od 2014. · U klubu Dunavski trkači od
 * 2018." (owner, 31.07.2026). Those are two different facts, and reading them
 * side by side is how anyone would say them out loud. It also gives the heading
 * back to the name, which is what a shared link is about.
 *
 * A club is never named without the year, and never the year without the club:
 * `teamSince` is null exactly when there is no club, so the two travel together.
 */
export function ProfileHead({
  competitor,
  team,
  seasons,
  season,
}: {
  competitor: Competitor
  team: Team | undefined
  /** The seasons the control offers. It stands level with the name because it
   *  governs both parts of the profile, not one of them (owner, 31.07.2026). */
  seasons: number[]
  /** Which of them the profile is being read in, worked out by the part that
   *  draws the content, so the control cannot disagree with what is below it. */
  season: string
}) {
  const { locale, t } = useI18n()

  return (
    <header className="profile__head profile__head--person">
      {/* The face first, and the name and the line under it beside it (owner,
          23.08.2026: „prvo ide slika, onda desno od nje u gornjem redu ime i
          prezime, a u donjem trenutna linija"). It is the same circle the top ten
          and the cards of the competitors draw, at the size this screen gives it:
          one shape in one place, so a photograph arriving in it arrives
          everywhere at once (components/Portrait.tsx).

          A photograph is what it is for and initials are what it holds today: the
          member record carries no picture yet, so every circle on the portal is a
          monogram on that member's own colour. The owner asked for exactly that
          fallback, and it is the whole of what is drawn until the picture has
          somewhere to live. */}
      <Portrait competitor={competitor} />

      <div className="profile__identity">
        {/* The same row every screen with a control has, so the control lands at
            the height it lands at on the teams (owner, 05.08.2026). It was a row
            of its own making before, and a name set smaller than a screen title
            put the control a few pixels higher than anywhere else. */}
        <div className="profile__title rankings--tooled">
          <h1 className="profile__name">
            {competitor.firstName} {competitor.lastName}
          </h1>
          <div className="rankings__head-tool">
            {/* Named and shaped like a field, as on the teams and the top boards
                (owner, 05.08.2026). It was a pill with its name hidden from
                04.08.2026, on the reasoning that beside a name a labelled field
                reads as a second heading; the owner has since asked for the one
                shape everywhere, and one shape is one thing to learn. */}
            <SeasonPicker seasons={seasons} season={season} />
          </div>
        </div>

        <p className="profile__meta">
          {/* The public page of a competitor is the digital membership card, so the
              number is named rather than left to stand on its own between a name
              and a category (owner, 17.08.2026). Nothing else is added here: a
              date of birth or anything else private has no place on a card. */}
          <span className="profile__number">
            {t('profile.memberNumberLabel', { number: competitor.memberNumber })}
          </span>
          {' · '}
          {categoryLabel(categoryOfMember(competitor, SEASON), t)}
          {' · '}
          {competitor.city}
          {' · '}
          {t('profile.memberSince', { season: competitor.firstSeason })}
          {' · '}
          {team === undefined || competitor.teamSince === null ? (
            <span>{t('profile.noTeam')}</span>
          ) : (
            /* The club name is a link inside the sentence rather than beside it,
               so a screen reader hears where the link goes without an
               aria-label having to repeat what the sentence already says. */
            <span className="profile__club">
              <Sentence text={t('profile.inClub', { season: competitor.teamSince })} slot="team">
                <Link to={`/${locale}/tim/${team.slug}`}>{team.name}</Link>
              </Sentence>
            </span>
          )}
        </p>
      </div>
    </header>
  )
}

/**
 * The two parts of a profile, as addresses rather than as panels swapped in
 * place.
 *
 * Two, not four (the design decision of 30.07.2026). The four kinds of content
 * do not weigh the same: a biography is one paragraph and a view whose whole
 * content is one paragraph is a click charged for nothing, while the results are
 * both the longest thing here and the thing every visitor came for, so they are
 * the one part that must never be behind a click.
 *
 * Links and `aria-current`, never a tablist: a tablist promises panels that swap
 * without leaving the page and takes over the arrow keys. The address carries
 * the part, which is what PDL P12 already decided for the tables, so a part can
 * be linked, bookmarked and indexed.
 *
 * The season rides inside the overview control rather than on a rule of its own
 * below (owner, 31.07.2026). It governs the overview and nothing else, so it
 * belongs to the overview the way a setting belongs to the thing it sets, and a
 * whole row plus a sentence explaining what that row governed both disappear.
 * On the awards it is not drawn at all: the awards are every season a person
 * ever placed in, and a control that changes nothing on the screen it is
 * standing on is worse than no control.
 *
 * The query travels with the link, so choosing a season and then looking at the
 * trophies does not lose the season on the way back.
 */
export function ProfileParts({ competitor }: { competitor: Competitor }) {
  const { locale, t } = useI18n()
  /* Handed the whole record rather than a number, since 15.08.2026: the
     address carries the name now (pages/profileAddress.ts), and a nav built
     from the number alone would send a reader from a profile at
     `/takmicar/000127-nikola-minic` to trophies at `/takmicar/000127/priznanja`
     and back again, which is two addresses for one person on one screen. */
  const base = profilePath(competitor, locale)

  return (
    <PartsNav
      label={t('profile.parts.label')}
      parts={[
        {
          to: base,
          end: true,
          /* The same screen is reached at `/moj-profil` too, by the same component
             (member/MyProfile.tsx), and the nav is built from the record's own
             address. Without this the reader who opened their own profile saw a row
             of parts with **nothing** marked, while the same screen entered from the
             list of competitors marks „Pregled" (owner, 23.08.2026). */
          also: `/${locale}/moj-profil`,
          label: t('profile.parts.overview'),
        },
        { to: `${base}/priznanja`, label: t('profile.parts.awards') },
      ]}
    />
  )
}
