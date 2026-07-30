import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { BadgeArt } from '../components/BadgeArt'
import { Resource } from '../components/Resource'
import { BADGE_KINDS, ruleSentence, thresholdOf, type Badge } from '../data/badgeRule'
import { useBadges } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'
import './Badges.css'

/* Every badge the administrator has defined, and how each of them is earned
 * (PDL P28a, 30.07.2026). The screen is modelled on the Garmin one by what it
 * does and not by how it looks: a grid of marks, the threshold readable on the
 * mark itself, filters, and one button that clears them all.
 *
 * Two things it does not copy. Garmin filters by points, and a badge here carries
 * none at all (PDL P16), so that filter would have nothing to sort by; its place
 * is taken by the period a badge is valid for, which is the other half of every
 * rule and the one thing that decides whether a badge can still be won. And the
 * rule is never described again in words of this screen's own: what a member
 * reads is the sentence the administrator read back when saving it
 * (ruleSentence), so the page and the panel cannot say two things about one
 * badge.
 *
 * The card carries the mark and the name and nothing else (owner, 30.07.2026).
 * The kind is a hint, shown on hover, on keyboard focus and on a tap. It is the
 * accessible description of the badge at all times, whether or not it is drawn,
 * because a fact that exists only under a mouse pointer does not exist for a
 * keyboard or for a screen reader (WCAG 2.2 AA).
 */

/** The period filter: badges that count for ever, and badges tied to dates. */
const FOREVER = 'trajne'
const LIMITED = 'period'

function forever(badge: Badge): boolean {
  return badge.from === '' && badge.to === ''
}

function matches(badge: Badge, kind: string, period: string): boolean {
  if (kind !== '' && badge.kind !== kind) {
    return false
  }

  if (period === FOREVER) {
    return forever(badge)
  }

  if (period === LIMITED) {
    return !forever(badge)
  }

  return true
}

export function Badges() {
  const { locale, t } = useI18n()
  const [params, setParams] = useSearchParams()
  /** The badge whose hint is pinned open by a tap; empty when none is. */
  const [pinned, setPinned] = useState('')
  const kind = params.get('vrsta') ?? ''
  const period = params.get('period') ?? ''
  const state = useBadges()

  function choose(name: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(name, value)

    // No choice is the absence of a filter, not a filter for nothing.
    if (value === '') {
      next.delete(name)
    }

    setParams(next)
  }

  return (
    <div className="rankings">
      <h1>{t('badges.title')}</h1>
      <p className="rankings__note">{t('badges.intro')}</p>

      <Resource state={state}>
        {(badges) => {
          /* Only the kinds something has been defined for. Offering every kind
             the rule engine knows would offer choices that answer with an empty
             screen. */
          const kinds = BADGE_KINDS.filter((one) => badges.some((badge) => badge.kind === one))
          const shown = badges.filter((badge) => matches(badge, kind, period))

          return (
            <>
              <div className="rankings__filters">
                <label className="rankings__field">
                  <span>{t('badges.kindFilter')}</span>
                  <select value={kind} onChange={(event) => choose('vrsta', event.target.value)}>
                    <option value="">{t('badges.allKinds')}</option>
                    {kinds.map((one) => (
                      <option key={one} value={one}>
                        {t(`badges.kind.${one}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="rankings__field">
                  <span>{t('badges.periodFilter')}</span>
                  <select value={period} onChange={(event) => choose('period', event.target.value)}>
                    <option value="">{t('badges.allPeriods')}</option>
                    <option value={FOREVER}>{t('badges.forever')}</option>
                    <option value={LIMITED}>{t('badges.limited')}</option>
                  </select>
                </label>

                <button type="button" className="badges__clear" onClick={() => setParams({})}>
                  {t('badges.clear')}
                </button>
              </div>

              <p className="rankings__count">{t('badges.count', { count: shown.length })}</p>

              {shown.length === 0 ? (
                <p className="rankings__empty">{t('badges.empty')}</p>
              ) : (
                <ul className="badges" aria-label={t('badges.title')}>
                  {shown.map((badge) => (
                    <li className="badge" key={badge.id}>
                      <button
                        type="button"
                        className="badge__face"
                        aria-describedby={`badge-${badge.id}-rule`}
                        aria-expanded={pinned === badge.id}
                        onClick={() => setPinned(pinned === badge.id ? '' : badge.id)}
                        /* A hint opened by a tap has to close again without
                           hunting for the same spot. */
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

                      {/* How it is earned. Drawn on hover, on focus and when
                          pinned; read by a screen reader always, through the
                          description above. */}
                      <div className="badge__hint" id={`badge-${badge.id}-rule`}>
                        <p>{ruleSentence(badge, t, locale)}</p>
                        {badge.description !== '' && <p>{badge.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
