import { ProfileLink } from '../profile/ProfileLink'
import { Link } from 'react-router'
import { BOARD_PLACES, boardOfTen } from '../../data/derive'
import type { Competitor, Gender, Result } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { Portrait } from '../../components/Portrait'

/**
 * One face on the board, carrying the number of its place, as a way to that
 * person or as a plain circle where there is nowhere to go.
 *
 * Whether there is anywhere to go is not asked here. `ProfileLink` asks it, for this board and
 * for every other list on the portal, and the reasons are its own to keep: a member whose fee has
 * run out has no profile to link to (PDL P11), and one who has hidden theirs has none for a
 * reader who is not signed in (P23).
 *
 * The name is on the link rather than under it (owner, 31.07.2026, with the old
 * widget in front of him): the board is faces and numbers and nothing else. A
 * circle still has to be somebody, though, so the name is what the link is
 * called and what the tooltip says.
 */
function Face({ slot, place }: { slot: Competitor | undefined; place: number }) {
  const { t } = useI18n()
  const numbered = t('home.place', { place })

  if (slot === undefined) {
    return <Portrait />
  }

  const name = `${slot.firstName} ${slot.lastName}`
  const reading = `${numbered} ${name}`

  /* **One rule and one shape, since 07.09.2026.** A branch stood here asking
     `!slot.active` and drawing the circle as a plain `<span>`, which is the very
     question `ProfileLink` was written to answer once for all eight screens. Two
     homes for one rule drifted the moment the rule grew a second reason: hiding
     was added to `profile/visible.ts` and this branch knew nothing of it, so the
     board went on linking a member the profile itself turns away.

     What the branch got right and took with it is the words: the circle is
     `aria-hidden` and so is the number beside it, so without them the item is
     empty to a screen reader. They are on `label`, which the component now says
     whichever of the two it draws. */
  return (
    <ProfileLink competitor={slot} className="top10__face" title={name} label={reading}>
      <Portrait competitor={slot} />
    </ProfileLink>
  )
}

/**
 * The top ten of one gender, in the shape the old portal had (owner,
 * 31.07.2026): the heading and the leader on one line, then the nine behind
 * them as a three by three block. Round faces carrying the number of their
 * place, and nothing else on the card: no names under the circles, no points
 * beside them, no sentence underneath.
 *
 * The board keeps its ten places whether or not the league has ten members, so
 * the two boards standing side by side are the same height all season.
 */
export function TopTen({
  competitors,
  results,
  season,
  gender,
}: {
  competitors: Competitor[]
  results: Result[]
  season: number
  gender: Gender
}) {
  const { locale, t } = useI18n()
  const slots = boardOfTen(competitors, results, season, gender)
  const headingId = `top-ten-${gender}`
  const places = Array.from({ length: BOARD_PLACES }, (_, index) => slots[index])

  return (
    <section className="card top10" aria-labelledby={headingId}>
      {/* The heading takes the first two cells of the block and the leader takes
          the third, which is the shape the old portal had. The list is what
          holds all ten places, so what a screen reader meets is one list of ten
          and not a list of nine with somebody standing outside it. `role` is
          written out because `display: contents` and a list with no markers are
          each enough, on their own, to make a browser forget it is a list. */}
      <div className="top10__block">
        <h2 className="card__title" id={headingId}>
          {t(gender === 'M' ? 'home.topMen' : 'home.topWomen')}
        </h2>

        <ol className="top10__places" role="list">
          {places.map((slot, index) => (
            <li
              className="top10__cell"
              key={slot?.competitor.memberNumber ?? `empty-${index}`}
              /* A place with nobody in it is a circle and no more, and it is out
                 of the reading entirely: "place five, empty" is not a fact
                 anybody needs read out to them. */
              aria-hidden={slot === undefined ? 'true' : undefined}
            >
              <Face slot={slot?.competitor} place={index + 1} />
              <span className="top10__place" aria-hidden="true">
                {t('home.place', { place: index + 1 })}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* The standing lives at /tabela; /top-liste is the page of Top 10 boards
          beside it (PDL P28a). */}
      <Link className="card__more" to={`/${locale}/tabela?pol=${gender === 'M' ? 'm' : 'z'}`}>
        {t('home.wholeStanding')}
      </Link>
    </section>
  )
}
