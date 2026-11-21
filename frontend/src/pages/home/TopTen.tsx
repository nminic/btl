import { ProfileLink } from '../profile/ProfileLink'
import { Link } from 'react-router'
import { BOARD_PLACES, boardOfTen, categoryLabelIn, type BoardSlot } from '../../data/derive'
import type { Competitor, Gender, Result } from '../../data/types'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { Portrait } from '../../components/Portrait'

/** The three that stand on the podium; the places behind them are the list. */
const PODIUM = 3

/**
 * One face on the board, carrying the number of its place, as a way to that
 * person or as a plain circle where there is nowhere to go.
 *
 * Whether there is anywhere to go is not asked here. `ProfileLink` asks it, for this board and
 * for every other list on the portal, and the reasons are its own to keep: a member whose fee has
 * run out has no profile to link to (PDL P11), and one who has hidden theirs has none for a
 * reader who is neither an active member nor the administration (P23).
 *
 * The circle is a picture and the name is what the link is called and what the tooltip says: the
 * circle and the number beside it are `aria-hidden`, so without the words on `label` the link would
 * be empty to a screen reader.
 */
function Face({ slot, place }: { slot: Competitor | undefined; place: number }) {
  const { t } = useI18n()

  if (slot === undefined) {
    return <Portrait />
  }

  const name = `${slot.firstName} ${slot.lastName}`
  const reading = `${t('home.place', { place })} ${name}`

  /* **One rule and one shape, since 07.09.2026.** A branch stood here asking
     `!slot.active` and drawing the circle as a plain `<span>`, which is the very
     question `ProfileLink` was written to answer once for all eight screens. Two
     homes for one rule drifted the moment the rule grew a second reason: hiding
     was added to `profile/visible.ts` and this branch knew nothing of it, so the
     board went on linking a member the profile itself turns away. */
  return (
    <ProfileLink competitor={slot} className="top10__face" title={name} label={reading}>
      <Portrait competitor={slot} />
    </ProfileLink>
  )
}

/**
 * One of the three on the podium: the circle, the name in two lines, the points, the category, and
 * the step with its place on it.
 *
 * **The name is two elements, the first name above and the surname under it, for all six people**
 * (owner, 20.11.2026, over a screenshot: „Pogledaj kako Vesni stane u jedan red ime i prezime, a
 * Vedrani ide u dva, i onda se Vedrana popne na nivo Vesne. Može li nekako da se napravi da svima na
 * podijumu ime i prezime idu u dva reda?"). Written as one line that wraps where it can, a long name
 * made its block taller and the circle above it climbed to the level of its neighbour; two lines of
 * a height of their own (`Home.css`, `.stand__name`) make the step decide the height and the name
 * never. **And a name that does not fit its column is set in a smaller letter, not broken** (owner,
 * 21.11.2026, „Manje slovo za dugo prezime"): the number of letters of each line goes to the stylesheet
 * in `--chars`, which works the size out from the width of the column. **And where even the smallest letter
 * does not fit, the line ends in three dots** (owner, 21.11.2026, „Tri tacke na granici”), the whole name
 * staying in the `title` of the line and in the link.
 *
 * **A screen reader hears one name, once.** The link carries „1. Vesna Đoković" and the two lines
 * drawn under it are `aria-hidden`, so the name is neither read twice nor read as two pieces.
 *
 * **The points are written with the short unit „p" / „pts"** (owner, 21.11.2026: „umesto BTL poena verovatno
 * treba da piše samo p / pts da bi moglo da stane lepo"), under a key of the podium's own
 * (`home.podiumPointsUnit`): the figures of the front page read `home.pointsUnit` and
 * `home.pointsUnitShort`, and a decision about the podium is not a decision about them. Until
 * 1 January 2027 the figure is the BTL points of the whole history (owner, 21.11.2026, `boardOfTen`).
 *
 * **The ring of gold around the first place is for a place that was WON** (PDL, 18.10.2026, „Red
 * bez trke ima redni broj, ali nikad boju postolja", applied by the owner on 20.11.2026). A member who only holds the place
 * until he has a result (`ranked` false) stands on the podium without it.
 */
function PodiumPlace({
  slot,
  place,
  season,
}: {
  slot: BoardSlot | undefined
  place: number
  season: number
}) {
  const { locale, t } = useI18n()
  const step = t('home.place', { place })

  if (slot === undefined) {
    /* A place with nobody in it is a circle and its step and no more, and it is out of the reading
       entirely: „place two, empty" is not a fact anybody needs read out to them. */
    return (
      <li className={`stand__item stand__item--${place}`} aria-hidden="true">
        <span className="stand__no">
          <Face slot={undefined} place={place} />
        </span>
        <span className="stand__name" />
        <span className="stand__step">{step}</span>
      </li>
    )
  }

  const { competitor } = slot
  const category = categoryLabelIn(competitor, season, t)
  const won = place === 1 && slot.ranked

  return (
    <li className={`stand__item stand__item--${place}${won ? ' stand__item--won' : ''}`}>
      <span className="stand__no">
        <Face slot={competitor} place={place} />
      </span>
      <span className="stand__name" aria-hidden="true">
        <span className="stand__first" title={competitor.firstName} style={{ '--chars': competitor.firstName.length }}>
          {competitor.firstName}
        </span>
        <span className="stand__last" title={competitor.lastName} style={{ '--chars': competitor.lastName.length }}>
          {competitor.lastName}
        </span>
      </span>
      <span className="stand__points">
        {formatPoints(slot.points, locale)}
        {t('home.podiumPointsUnit')}
      </span>
      {category !== '' && <span className="stand__cat">{category}</span>}
      <span className="stand__step" aria-hidden="true">
        {step}
      </span>
    </li>
  )
}

/**
 * One of the places from the fourth on: the number, the circle, the name, the category and the
 * points, as a row of the list.
 *
 * The rows are cells of one grid (`Home.css`, `.toprows`, a subgrid), so the number, the circle, the
 * name, the category and the points stand in the same columns in every row of a board, whatever the
 * names are.
 */
function ListedPlace({
  slot,
  place,
  season,
}: {
  slot: BoardSlot | undefined
  place: number
  season: number
}) {
  const { locale, t } = useI18n()

  if (slot === undefined) {
    return (
      <li className="toprow toprow--empty" aria-hidden="true">
        <span className="no">{t('home.place', { place })}</span>
        <Portrait />
      </li>
    )
  }

  const { competitor } = slot
  const name = `${competitor.firstName} ${competitor.lastName}`

  return (
    <li className="toprow">
      <span className="no" aria-hidden="true">
        {t('home.place', { place })}
      </span>
      <Face slot={competitor} place={place} />
      <span className="nm">
        <ProfileLink competitor={competitor}>{name}</ProfileLink>
      </span>
      <span className="kt">{categoryLabelIn(competitor, season, t)}</span>
      <span className="pt">{formatPoints(slot.points, locale)}</span>
    </li>
  )
}

/**
 * The top ten of one gender (owner, 20.11.2026, PDL „Četiri dodatka naslovne iz tuđeg nacrta"): the
 * first three on a stepped podium, the first in the middle and the highest, the second on the left and
 * lower, the third on the right and lowest, each with a name, points and a category; and the seven
 * behind them as a list of rows.
 *
 * **This replaces the board of faces and numbers and nothing else** that stood here from 31.07.2026
 * („the board is faces and numbers and nothing else", „no names under the circles, no points beside
 * them"). ~~The decision of 31.07.2026 that the front page's top ten carries no names and no points.~~
 * **[OVERTURNED 20.11.2026, owner, chosen with the recommendation put to him]** for the three on the
 * podium, and then for the whole board, when he asked for the places from the fourth on to be a list
 * with a category and not circles: „Prve tri osobe treba da budu na postolju, ostali u listi kao u
 * predlogu koji si prvo razmatrao (lista sa kategorijom i sl)."
 *
 * **No yellow heading.** The board is named by a heading that is there for a screen reader and not
 * drawn (owner, 20.11.2026: „da li su uopšte potrebni žuti naslovi sekcija top 10 muškarci i žene? Možda
 * se uzalud baca prostor"), and the link at the foot says whose standing it is: „Kompletan poredak
 * muškaraca", „Kompletan poredak žena".
 *
 * The board keeps its ten places whether or not the league has ten members, so the two boards standing
 * side by side are the same height all season. From 1 January 2027 the places nobody has won are empty
 * circles (owner, 17.10.2026).
 */
export function TopTen({
  competitors,
  results,
  season,
  today,
  gender,
}: {
  competitors: Competitor[]
  results: Result[]
  season: number
  /** The day the board is read on, which decides whether places are held for members who have
   *  not scored (`boardsAreToppedUp`). Not the season and not a date of any result. */
  today: string
  gender: Gender
}) {
  const { locale, t } = useI18n()
  const slots = boardOfTen(competitors, results, season, gender, today)
  const headingId = `top-ten-${gender}`
  const places = Array.from({ length: BOARD_PLACES }, (_, index) => slots[index])

  return (
    <section className="card top10" aria-labelledby={headingId}>
      <div className="top10__block">
        <h2 className="card__title visually-hidden" id={headingId}>
          {t(gender === 'M' ? 'home.topMen' : 'home.topWomen')}
        </h2>

        {/* `role` is written out because a list with no markers is enough, on its own, to make a
            browser forget it is a list. The podium is the first three of the ten and the list is the
            other seven, and `start` says where it begins, so a screen reader that counts them counts
            from four. */}
        <ol className="stand" role="list">
          {places.slice(0, PODIUM).map((slot, index) => (
            <PodiumPlace
              key={slot?.competitor.memberNumber ?? `empty-${index}`}
              slot={slot}
              place={index + 1}
              season={season}
            />
          ))}
        </ol>

        <ol className="toprows" role="list" start={PODIUM + 1}>
          {places.slice(PODIUM).map((slot, index) => (
            <ListedPlace
              key={slot?.competitor.memberNumber ?? `empty-${PODIUM + index}`}
              slot={slot}
              place={PODIUM + index + 1}
              season={season}
            />
          ))}
        </ol>
      </div>

      {/* The standing lives at /tabela; /top-liste is the page of Top 10 boards
          beside it (PDL P28a). The same address the link „Cela tabela" went to. */}
      <Link className="card__more" to={`/${locale}/tabela?pol=${gender === 'M' ? 'm' : 'z'}`}>
        {t(gender === 'M' ? 'home.wholeStandingMen' : 'home.wholeStandingWomen')}{' '}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  )
}
