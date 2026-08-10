import { useState } from 'react'
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
 * words with a good deal of drawing in it. What the filters answered was "which
 * of these can I still win", and that is a question about a member rather than
 * about the rules.
 *
 * ## Fifteen coins, not fifty-five
 *
 * What stands here is one coin per family, not one per ducat. Four families give
 * a ducat every season and two give one every month, so the count of ducats that
 * exist is fifty-five in the first season and grows by twenty-eight a year
 * (ADL A12, 7). A rulebook that drew them all would be a rulebook that has to be
 * scrolled past. The coin drawn is the first of the family, and the sentence
 * under it says that it repeats.
 *
 * ## The order
 *
 * As the owner ranked them on 10.08.2026, from the one most people will win to
 * the one nobody is expected to: the file is in that order and this draws it in
 * file order, three to a row, five rows. Nothing here sorts, because the order is
 * a judgement about how hard a thing is to do and not a property of the data.
 *
 * ## The card
 *
 * The coin, and under it two or three words that say what it is about and never
 * how much (the owner, 10.08.2026). The threshold is on the coin itself and in
 * the sentence; a name that repeats it would say the same number three times.
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
  /** The ducat whose hint is pinned open by a tap; empty when none is. */
  const [pinned, setPinned] = useState('')
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
                <button
                  type="button"
                  className="ducat__face"
                  aria-describedby={`ducat-${family.id}-rule`}
                  aria-expanded={pinned === family.id}
                  onClick={() => setPinned(pinned === family.id ? '' : family.id)}
                  /* A hint opened by a tap has to close again without hunting
                     for the same spot. */
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setPinned('')
                    }
                  }}
                >
                  <DucatArt ducat={firstOf(family, exampleGender(family, families))} />
                  <span className="ducat__name">{family.name}</span>
                </button>

                {/* How it is earned. Drawn on hover, on focus and when pinned;
                    read by a screen reader always, through the description
                    above. */}
                <div className="ducat__hint" id={`ducat-${family.id}-rule`}>
                  <p>{ruleSentence(family, t, locale)}</p>
                  <p>{t(`ducats.tier${family.tier}`)}</p>
                </div>
              </li>
            ))}
          </ul>
        )
      }
    </Resource>
  )
}
