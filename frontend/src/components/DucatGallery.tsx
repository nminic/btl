import { useState } from 'react'
import { DucatArt } from './DucatArt'
import { Resource } from './Resource'
import { ruleSentence, thresholdOf } from '../data/ducatRule'
import { useDucats } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import './DucatGallery.css'

/* Every ducat the league awards, drawn.
 *
 * It was a screen of its own with filters by kind and by period until 04.08.2026,
 * when the owner asked for them to be a section of the rulebook instead, near
 * its end, described in words with a good deal of drawing in it. What
 * filters answered was "which of these can I still win", and that is a question
 * about a member rather than about the rules; what is left is the wall itself,
 * which is what a reader of the rulebook came for.
 *
 * The card carries the mark and the name and nothing else (owner, 30.07.2026).
 * The rule is the hint, shown on hover, on keyboard focus and on a tap. It is the
 * accessible description of the ducat at all times, whether or not it is drawn,
 * because a fact that exists only under a mouse pointer does not exist for a
 * keyboard or for a screen reader (WCAG 2.2 AA).
 *
 * The rule is never described again in words of this component's own: what a
 * member reads is the sentence the administrator read back when saving it
 * (ruleSentence), so the wall and the panel cannot say two things about one
 * ducat.
 */
export function DucatGallery() {
  const { locale, t } = useI18n()
  /** The ducat whose hint is pinned open by a tap; empty when none is. */
  const [pinned, setPinned] = useState('')
  const state = useDucats()

  /* `inline`, because this is a part of a page rather than a page: the section
     around it is already drawn, and a sheet over the whole screen while the
     ducats arrive would take the rulebook away from somebody reading it. It also
     keeps the promise the front page makes about the address of the president,
     that a failure on one side costs one widget and not the page. */
  return (
    <Resource state={state} inline label={t('ducats.title')}>
      {(ducats) =>
        ducats.length === 0 ? (
          <p className="ducats__empty">{t('ducats.empty')}</p>
        ) : (
          <ul className="ducats" aria-label={t('ducats.title')}>
            {ducats.map((ducat) => (
              <li className="ducat" key={ducat.id}>
                <button
                  type="button"
                  className="ducat__face"
                  aria-describedby={`ducat-${ducat.id}-rule`}
                  aria-expanded={pinned === ducat.id}
                  onClick={() => setPinned(pinned === ducat.id ? '' : ducat.id)}
                  /* A hint opened by a tap has to close again without hunting
                     for the same spot. */
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setPinned('')
                    }
                  }}
                >
                  <DucatArt
                    kind={ducat.kind}
                    threshold={thresholdOf(ducat, locale)}
                    label={ducat.label}
                  />
                  <span className="ducat__name">{ducat.name}</span>
                </button>

                {/* How it is earned. Drawn on hover, on focus and when pinned;
                    read by a screen reader always, through the description
                    above. */}
                <div className="ducat__hint" id={`ducat-${ducat.id}-rule`}>
                  <p>{ruleSentence(ducat, t, locale)}</p>
                  {ducat.description !== '' && <p>{ducat.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        )
      }
    </Resource>
  )
}
