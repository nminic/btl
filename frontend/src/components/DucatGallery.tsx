import { DucatArt } from './DucatArt'
import { Resource } from './Resource'
import { firstOf, ruleSentence } from '../data/ducatRule'
import type { DucatFamily } from '../data/ducatRule'
import type { Gender } from '../data/types'
import { useDucats } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import './DucatGallery.css'

/* Every ducat the league awards, drawn.
 *
 * It was a screen of its own with filters until 04.08.2026, when the owner asked
 * for it to be a section of the rulebook instead, near its end, described in
 * words with a good deal of drawing in it.
 *
 * ## Still, and silent
 *
 * The card carried a hint until 11.08.2026: the rule of the ducat, opened by a
 * hover, by a tap or by the keyboard. The owner asked for the coins to stand
 * still and for the words to be said once, above them, in the voice of the
 * president's address rather than in a specification. So there is no control
 * here at all, nothing to open, nothing to press, and no state.
 *
 * What that changes for a reader who cannot see the coins: the drawing used to
 * be decorative because the hint beside it carried the rule. With the hint gone
 * it has to carry its own name, so each coin is an image with a sentence for a
 * label. Nothing of that shows on the page, which is what was asked for; it is
 * what a screen reader is given instead of a picture of a coin.
 *
 * ## Fifteen coins, not fifty-five
 *
 * What stands here is one coin per family, not one per ducat. Four families give
 * a ducat every season and two give one every month, so the count of ducats that
 * exist is fifty-five in the first season and grows by twenty-eight a year
 * (ADL A12, 7). The coin drawn is the first of its family.
 *
 * ## The order
 *
 * As the owner ranked them on 10.08.2026, from the one most people will win to
 * the one nobody is expected to: the file is in that order and this draws it in
 * file order, three to a row, five rows. Nothing here sorts, because the order is
 * a judgement about how hard a thing is to do and not a property of the data.
 */

/** Three families read differently for a woman. With no member to read it for,
 *  the rulebook shows examples of both, alternating in the order they appear, so
 *  the wall does not silently address one half of the league. */
function exampleGender(family: DucatFamily, families: DucatFamily[]): Gender {
  if (family.topFemale === '') {
    return 'M'
  }

  const among = families.filter((one) => one.topFemale !== '').indexOf(family)

  return among % 2 === 0 ? 'F' : 'M'
}

export function DucatGallery() {
  const { locale, t } = useI18n()
  const state = useDucats()

  /* `inline`, because this is a part of a page rather than a page: the section
     around it is already drawn, and a sheet over the whole screen while the
     ducats arrive would take the rulebook away from somebody reading it. */
  return (
    <Resource state={state} inline label={t('ducats.title')}>
      {(families) =>
        families.length === 0 ? (
          <p className="ducats__empty">{t('ducats.empty')}</p>
        ) : (
          <ul className="ducats" aria-label={t('ducats.title')}>
            {families.map((family) => (
              <li className="ducat" key={family.id}>
                <DucatArt
                  ducat={firstOf(family, exampleGender(family, families))}
                  label={`${family.name}. ${ruleSentence(family, t, locale)} ${t(
                    `ducats.tier.${family.tier}`,
                  )}`}
                />
                <span className="ducat__name">{family.name}</span>
              </li>
            ))}
          </ul>
        )
      }
    </Resource>
  )
}
