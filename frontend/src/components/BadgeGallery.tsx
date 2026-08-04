import { useState } from 'react'
import { BadgeArt } from './BadgeArt'
import { Resource } from './Resource'
import { ruleSentence, thresholdOf } from '../data/badgeRule'
import { useBadges } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import './BadgeGallery.css'

/* Every badge the league awards, drawn.
 *
 * It was a screen of its own with filters by kind and by period until 04.08.2026,
 * when the owner made the badges a section of the rulebook instead: "Značke
 * treba da bude opisna sekcija (sa dosta grafike) pred kraj Pravilnika." What
 * filters answered was "which of these can I still win", and that is a question
 * about a member rather than about the rules; what is left is the wall itself,
 * which is what a reader of the rulebook came for.
 *
 * The card carries the mark and the name and nothing else (owner, 30.07.2026).
 * The rule is the hint, shown on hover, on keyboard focus and on a tap. It is the
 * accessible description of the badge at all times, whether or not it is drawn,
 * because a fact that exists only under a mouse pointer does not exist for a
 * keyboard or for a screen reader (WCAG 2.2 AA).
 *
 * The rule is never described again in words of this component's own: what a
 * member reads is the sentence the administrator read back when saving it
 * (ruleSentence), so the wall and the panel cannot say two things about one
 * badge.
 */
export function BadgeGallery() {
  const { locale, t } = useI18n()
  /** The badge whose hint is pinned open by a tap; empty when none is. */
  const [pinned, setPinned] = useState('')
  const state = useBadges()

  /* `inline`, because this is a part of a page rather than a page: the section
     around it is already drawn, and a sheet over the whole screen while the
     badges arrive would take the rulebook away from somebody reading it. It also
     keeps the promise the front page makes about the address of the president,
     that a failure on one side costs one widget and not the page. */
  return (
    <Resource state={state} inline label={t('badges.title')}>
      {(badges) =>
        badges.length === 0 ? (
          <p className="badges__empty">{t('badges.empty')}</p>
        ) : (
          <ul className="badges" aria-label={t('badges.title')}>
            {badges.map((badge) => (
              <li className="badge" key={badge.id}>
                <button
                  type="button"
                  className="badge__face"
                  aria-describedby={`badge-${badge.id}-rule`}
                  aria-expanded={pinned === badge.id}
                  onClick={() => setPinned(pinned === badge.id ? '' : badge.id)}
                  /* A hint opened by a tap has to close again without hunting
                     for the same spot. */
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setPinned('')
                    }
                  }}
                >
                  <BadgeArt
                    kind={badge.kind}
                    threshold={thresholdOf(badge, locale)}
                    label={badge.label}
                  />
                  <span className="badge__name">{badge.name}</span>
                </button>

                {/* How it is earned. Drawn on hover, on focus and when pinned;
                    read by a screen reader always, through the description
                    above. */}
                <div className="badge__hint" id={`badge-${badge.id}-rule`}>
                  <p>{ruleSentence(badge, t, locale)}</p>
                  {badge.description !== '' && <p>{badge.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        )
      }
    </Resource>
  )
}
