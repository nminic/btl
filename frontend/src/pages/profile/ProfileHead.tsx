import { useSyncExternalStore, type ReactNode } from 'react'
import { profilePath } from '../profileAddress'
import { Link, NavLink, useLocation } from 'react-router'
import { DataIcon } from '../../app/icons'
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
  acts,
}: {
  competitor: Competitor
  team: Team | undefined
  /** Whom a partner's number names, read through this visit's overlay by the caller. */
  competitors: Competitor[]
  /** The pairs that hold now, the file and this visit together (`data/derive.ts`, `pairsNow`). */
  pairs: RacingPair[]
  /** What the reader can do about this person, at the end of the row of the name (`ProfileTop`). */
  acts?: ReactNode
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
            {/* One run of text and not three (the first name, a space and the last name): on a telephone the name
                wraps beside the symbols at the end of its row, and the symbols are centred on the name as a block,
                which is how `geometry/actionTip.geometry.ts` reads words that wrap, one text at a time. */}
            {`${competitor.firstName} ${competitor.lastName}`}
          </h1>
          {/* AT THE END OF THE ROW OF THE NAME since 21.11.2026 (owner, PDL „Zaglavlje profila: izbor
              „Godina” stoji u redu sa karticama, desno, na svim uređajima; „Pozovi u tim” postaje ikonica
              na kraju reda sa imenom"). The box gives up its own, so each act is an item of the row of the
              name and wraps on its own (`Profile.css`, `.profile__acts`). */}
          {acts !== undefined && <div className="profile__acts">{acts}</div>}
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
export function ProfileParts({
  competitor,
  data,
}: {
  competitor: Competitor
  /** The word of the card „Podaci" where it stands as a part, or null where it does not: not the reader's, or
   *  drawn as an icon in the row of the name (`ProfileTop`). */
  data: string | null
}) {
  return <TheParts competitor={competitor} data={data} />
}

/**
 * WHERE THE ROW CANNOT HOLD THREE PARTS AND THE SEASON, in `em` so that it moves with the text (ADL A7):
 * „Rezultati", „Priznanja", „Podaci" and „Sve ▾" ask for 324px at the browser's own text (parts 81,5 + 84,5 +
 * 68,3, two gaps of 6, a gap of 8 and the season of 70, measured 21.11.2026 in Chrome at 360px) in a row of 328:
 * they fit by under 4px, which another font on another telephone does not have, and at 125% text they do not
 * fit at all. So the line is drawn at 24em (384px at 100%, a window of 192px of room at 200%) and not at the
 * 22,3em where they stop fitting here: under it „Podaci" is an icon, over it a part, and a part never wraps
 * under the others on a font that is a little wider. Under it „Podaci" stands as an icon at the end of the row of the name,
 * beside the invitation (owner, PDL 21.11.2026: „ako ni tada tri kartice i izbor ne staju u red, „Podaci”
 * prelazi u ikonicu pored „Pozovi u tim”"). In the document the card is then in the row of the name and not in
 * the nav, so the order of the focus is the order of the eye (WCAG 2.2 SC 2.4.3).
 */
export const THREE_PARTS_DO_NOT_FIT = '(max-width: 23.99em)'

function subscribe(changed: () => void): () => void {
  const query = window.matchMedia(THREE_PARTS_DO_NOT_FIT)

  query.addEventListener('change', changed)

  return () => {
    query.removeEventListener('change', changed)
  }
}

function useThreePartsDoNotFit(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(THREE_PARTS_DO_NOT_FIT).matches)
}

function TheParts({ competitor, data }: { competitor: Competitor; data: string | null }) {
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
          label: t('profile.parts.overview'),
        },
        { to: `${base}/priznanja`, label: t('profile.parts.awards') },
        ...(data === null ? [] : [{ to: `${base}${THE_DATA}`, label: data }]),
      ]}
    />
  )
}

/**
 * The head of a profile, the parts of it, and the season, as one grid.
 *
 * The three are one arrangement and not three, because where the season stands
 * depends on how much room there is: beside the name on a wide screen, and in the
 * row with the parts („Rezultati" and „Priznanja" since 06.11.2026) once the screen is narrow (owner,
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
  acts,
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
  /**
   * WHAT THE READER CAN DO ABOUT THIS PERSON, in the row of the parts and to the right of them (owner,
   * 06.11.2026, PDL „Profil: forma „Podaci" po obliku forme za prijavu": „malo normalno dugme alignovano
   * desno, istog formata i reda gde se nalaze i Pregled, Priznanja i nagrade, i podaci"). Handed by the
   * part, because which parts carry it is the part's to say: „Rezultati" and „Priznanja" do, „Podaci" does
   * not (owner, same day). Left out, nothing is drawn for it.
   *
   * <p>Beside the nav and never inside it: a `nav` is a list of where to go, and a button that sends an
   * invitation is not a place.
   */
  acts?: ReactNode
}) {
  const { locale, t } = useI18n()

  const reader = useWhoReadsTheData(competitor.memberNumber)
  const narrow = useThreePartsDoNotFit()
  const { search } = useLocation()
  const base = profilePath(competitor, locale)
  /* THE CARD „PODACI" is the administration's alone (owner, 07.11.2026, PDL „Član svojim podacima pristupa iz
     glavnog menija": „na svom profilu član vidi samo „Rezultati” i „Priznanja”"). As a part where the row
     holds it, as an icon in the row of the name where it does not (`THREE_PARTS_DO_NOT_FIT`). */
  const data = reader === 'administration' ? t('profile.parts.data') : null

  return (
    <div className="profile__top">
      <ProfileHead
        competitor={competitor}
        team={team}
        competitors={competitors}
        pairs={pairs}
        acts={
          <>
            {data !== null && narrow && (
              /* THE SAME SQUARE AS THE INVITATIONS BESIDE IT (owner, 22.11.2026, PDL „OBA su zaobljeni kvadrati kao
                 dugmad u administraciji"): the owner named the two invitations, and a circle left standing beside
                 them in the one row would be the head coming apart again. A link of the nav and not an
                 `ActionLink`, because it says which part is open (`aria-current`), so it wears the square by its
                 classes: `entity-open` and `action` (`components/ActionButton.css`), the symbol in the middle. */
              <NavLink
                to={{ pathname: `${base}${THE_DATA}`, search }}
                className="entity-open action profile__act profile__act--icon profile__act--part"
                aria-label={data}
                title={data}
              >
                <DataIcon className="action__symbol" />
              </NavLink>
            )}
            {acts}
          </>
        }
      />
      {/* THE PARTS ON THE LEFT AND THE SEASON ON THE RIGHT, ONE ROW AT EVERY WIDTH (owner, 21.11.2026, PDL
          „Zaglavlje profila: izbor „Godina” (podrazumevano „Sve”) stoji u redu sa karticama, desno, na svim
          uređajima"). On a telephone the word „Godina" is drawn no more and stays the name of the field for a
          reader who hears it (`Profile.css`). The belt wraps when even that does not fit, which is what
          keeps the page from scrolling sideways at 200% text (WCAG 2.2 SC 1.4.10). Named and shaped like a
          field, as on the teams and the top boards (owner, 05.08.2026). */}
      <div className="profile__belt">
        <div className="profile__tabs">
          <ProfileParts competitor={competitor} data={narrow ? null : data} />
        </div>
        {season !== undefined && (
          <div className="rankings__head-tool profile__season">
            <SeasonPicker seasons={seasons} season={season} label={t('profile.year')} />
          </div>
        )}
      </div>
    </div>
  )
}
