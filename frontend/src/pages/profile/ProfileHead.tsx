import { profilePath } from '../profileAddress'
import { Link } from 'react-router'
import { PartsNav } from '../../components/PartsNav'
import { Portrait } from '../../components/Portrait'
import { SeasonPicker } from '../../components/SeasonPicker'
import { useToday } from '../../clock/useClock'
import { cardCategoryLabel, pairsFrom } from '../../data/derive'
import { seasonShown } from '../../data/season'
import type { Competitor, RacingPair, Team } from '../../data/types'
import { Sentence } from '../../i18n/Sentence'
import { useI18n } from '../../i18n/useI18n'
import { useProfileLink } from './useProfileLink'
import { THE_DATA, useWhoReadsTheData } from './whoReadsTheData'

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
 *
 * **„U timu", not „U klubu", and the racing pair after it** (PDL P11, owner, 18.10.2026: „I ne
 * treba da piše npr. U klubu HTEC nego u timu HTEC", and „Ukoliko nije, ništa se ne prikazuje,
 * ukoliko jeste, prikazuje se u gornjoj opisnoj liniji nakon tima"). See `RacingPartner` below.
 */
export function ProfileHead({
  competitor,
  team,
  competitors,
  pairs,
}: {
  competitor: Competitor
  team: Team | undefined
  /** Whom a partner's number names, read through this visit's overlay by the caller. */
  competitors: Competitor[]
  /** The pairs that hold now, the file and this visit together (`data/derive.ts`, `pairsNow`). */
  pairs: RacingPair[]
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

          A photograph where this member has had one approved, and initials where
          they have not, which is most of the league: the record has carried the
          portrait since 26.09.2026 (PDL P28f) and `components/Portrait.tsx`
          decides between the two. The owner asked for exactly that fallback, so
          the monogram is the other half of the circle rather than a stand-in
          waiting to be removed.

          `whole`, because this is the one circle that draws the ORIGINAL: owner,
          23.10.2026, „Server pravi i šalje umanjenu, već isečenu sliku za kružiće
          [...] original ostaje za profil." */}
      <Portrait competitor={competitor} whole />

      <div className="profile__identity">
        {/* The same row every screen with a control has, so the control lands at
            the height it lands at on the teams (owner, 05.08.2026). It was a row
            of its own making before, and a name set smaller than a screen title
            put the control a few pixels higher than anywhere else. */}
        <div className="profile__title rankings--tooled">
          <h1 className="profile__name">
            {competitor.firstName} {competitor.lastName}
          </h1>
        </div>

        <p className="profile__meta">
          {/* The public page of a competitor is the digital membership card, so the
              number is named rather than left to stand on its own between a name
              and a category (owner, 17.08.2026). What else stands here is what the
              member chose to put there, and nothing more. */}
          <span className="profile__number">
            {t('profile.memberNumberLabel', { number: competitor.memberNumber })}
          </span>
          {' · '}
          {/* With the dot that follows it, and neither where the category is shown nowhere: a member
              without the right to rank in the season his card speaks of (owner, 30.10.2026, „ne
              prikazuje se javno nigde njegov odabir", `cardCategoryOf`). */}
          {cardCategoryLabel(competitor, t) !== '' && (
            <>
              {cardCategoryLabel(competitor, t)}
              {' · '}
            </>
          )}
          {/* **THE BIRTHDAY IS NOT HERE, and that is a decision and not an omission**
              (12.09.2026). It was drawn here from 06.09.2026, for a member who chose to show
              it, on the strength of one sentence in section 3 of the privacy policy: an
              exception „ako sami izaberete da objavite svoj rođendan radi liste rođendana".
              The owner abolished the birthday list on 06.09.2026, so the exception named a
              thing that no longer existed, and on 12.09.2026 he had the sentence struck from
              both documents rather than rewritten. What is left is the rule without an
              exception: „Datum rođenja se nikada ne prikazuje, ni u punom ni u skraćenom
              obliku. Javna je samo kategorija koja iz njega proizlazi."

              So the year is not drawn for anybody, whatever the record says, and
              `profile.test.tsx` holds that against a member whose record asks for the
              full date. */}
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
              <Sentence text={t('profile.inTeam', { season: competitor.teamSince })} slot="team">
                <Link to={`/${locale}/tim/${team.slug}`}>{team.name}</Link>
              </Sentence>
            </span>
          )}
          <RacingPartner competitor={competitor} competitors={competitors} pairs={pairs} />
        </p>
      </div>
    </header>
  )
}

/**
 * „TRKAČKI PAR: [IME I PREZIME]" AT THE END OF THE LINE, OR NOTHING AT ALL.
 *
 * <p>PDL P11, owner, 18.10.2026: „Na profilnoj strani ne treba da piše Nije u trkačkom paru. Ukoliko
 * nije, ništa se ne prikazuje, ukoliko jeste, prikazuje se u gornjoj opisnoj liniji nakon tima."
 * The shape is the one he chose with the recommendation: „Trkački par: [ime i prezime]", the name a
 * link to the partner's profile, and no season in it. And of which pair (same day, „Samo tekući"):
 * **only the pair of the season shown as the running one**, `seasonShown(today)` - which is 2027
 * until 2027 is over, the same season the table opens on (PDL P7, „Važi za sezonu koja se prikazuje
 * kao tekuća"). A pair made for the season after is not in the line; it is the member's own business
 * and stands on „Moja članarina" with the way to end it (`member/MyRacingPairs.tsx`).
 *
 * <p><b>Where the name leads is not decided here</b>, for the reason the old line gave (security
 * review, 08.09.2026): `useProfileLink` is the one place that turns „may this reader reach this
 * member" into an address, and where it answers nothing the name stays as words. A partner the list
 * does not carry - which `GET /api/pairs` never serves (`PairApi`, both halves active), and which a
 * pair made during this visit could still name for a moment - is said by number, as it was.
 */
function RacingPartner({
  competitor,
  competitors,
  pairs,
}: {
  competitor: Competitor
  competitors: Competitor[]
  pairs: RacingPair[]
}) {
  const { t } = useI18n()
  const today = useToday()
  const linkTo = useProfileLink()
  const running = seasonShown(today)
  const pair = pairsFrom(pairs, competitor.memberNumber, running).find(
    (one) => one.season === running,
  )

  if (pair === undefined) {
    return null
  }

  const other = pair.memberNumbers.filter((one) => one !== competitor.memberNumber).join('')
  const partner = competitors.find((one) => one.memberNumber === other)
  const to = partner === undefined ? undefined : linkTo(partner)

  return (
    <>
      {' · '}
      <span className="profile__pair">
        <Sentence text={t('profile.racingPair')} slot="partner">
          {/* The name in an element of its own either way, so it is one thing to whoever reads
              it, linked or not, which is how the row it replaces drew it. */}
          {partner === undefined ? (
            <span>{other}</span>
          ) : to === undefined ? (
            <span>
              {partner.firstName} {partner.lastName}
            </span>
          ) : (
            <Link to={to}>
              {partner.firstName} {partner.lastName}
            </Link>
          )}
        </Sentence>
      </span>
    </>
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
  /* AND THE CARD „PODACI", AFTER THE TWO, offered only to whoever may open it (owner, 22.10.2026, PDL
     „Profil dobija karticu „Podaci", posle „Pregled" i „Priznanja i nagrade", koju vidi samo sam član i
     administracija"). Asked of the one home the card asks too (`whoReadsTheData.ts`). */
  const reader = useWhoReadsTheData(competitor.memberNumber)

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
        ...(reader === null ? [] : [{ to: `${base}${THE_DATA}`, label: t('profile.parts.data') }]),
      ]}
    />
  )
}

/**
 * The head of a profile, the parts of it, and the season, as one grid.
 *
 * The three are one arrangement and not three, because where the season stands
 * depends on how much room there is: beside the name on a wide screen, and in the
 * row with „Pregled" and „Priznanja i nagrade" once the screen is narrow (owner,
 * 23.08.2026: „Sezona 2026 sa dropdown treba da pređe u red gde su Pregled i
 * Priznanja / nagrade, a da Ime i Prezime ostane odmah iznad Članskog broja i sl.
 * bez ogromnog praznog prostora kao što je trenutno slučaj").
 *
 * Measured on 23.08.2026, before: at 760px the name and the season shared a row and
 * the member's number stood 6px under the name; at 520 and at 360 the season fell
 * **between** them and pushed the number 60px down. The gap the owner saw is that
 * fall.
 *
 * The season has **one** home in the markup and the grid decides which row it is
 * in, rather than being drawn twice and hidden by turns: two of them is two things
 * to keep in step, and a hidden one is still read out by anything that walks the
 * page (`components/PartsNav.tsx` keeps the same rule for the parts).
 */
export function ProfileTop({
  competitor,
  team,
  competitors,
  pairs,
  seasons = [],
  season,
}: {
  competitor: Competitor
  team: Team | undefined
  competitors: Competitor[]
  pairs: RacingPair[]
  /** The seasons the control offers. It governs both parts of the profile, not one
   *  of them (owner, 31.07.2026), which is why it stands with them rather than
   *  inside either. */
  seasons?: number[]
  /** Which of them the profile is being read in, worked out by the part that draws
   *  the content, so the control cannot disagree with what is below it. LEFT OUT by the card
   *  „Podaci" (23.10.2026), which is about no season, and then no control is drawn: a control that
   *  changes nothing on the screen it stands on is worse than none (the note on `ProfileParts`). */
  season?: string
}) {
  return (
    <div className="profile__top">
      <ProfileHead competitor={competitor} team={team} competitors={competitors} pairs={pairs} />
      {/* Named and shaped like a field, as on the teams and the top boards (owner,
          05.08.2026). It was a pill with its name hidden from 04.08.2026, on the
          reasoning that beside a name a labelled field reads as a second heading;
          the owner has since asked for the one shape everywhere, and one shape is
          one thing to learn. */}
      {/* The parts and the season as one belt, so that on a narrow screen they share
          a line and **wrap** when they cannot: „Priznanja i nagrade" and the season
          together ask for 435px at 200% text in a box of 328, and a row that cannot
          give way pushes the page sideways instead. Measured on the first attempt at
          this: 107px of page scroll at 200%, starting from 162%.

          Above the breakpoint the belt gives up its box (`Profile.css`), so the two
          become children of the grid and the season goes up beside the name. One
          markup, two arrangements, and no copy of the control. */}
      <div className="profile__belt">
        <ProfileParts competitor={competitor} />
        {season !== undefined && (
          <div className="rankings__head-tool profile__season">
            <SeasonPicker seasons={seasons} season={season} />
          </div>
        )}
      </div>
    </div>
  )
}
