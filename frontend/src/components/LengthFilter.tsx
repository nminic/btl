import { CATEGORIES } from '../data/derive'
import type { RaceCategory } from '../data/types'
import { useI18n } from '../i18n/useI18n'
import { Segmented } from './Segmented'
import './LengthFilter.css'

/**
 * The six buttons, as one segmented control in one row. One component for the front page and the
 * profile (owner, 21.11.2026, PDL: the profile's filter is the same as the front page's, on every
 * width), so the two cannot drift apart.
 *
 * **Each says its name the way the profile says it and is read out in full.** What is drawn is the
 * short word (`profile.lengthsShort`); what a screen reader is given is that and the length as the
 * portal says it everywhere else (`category.*`), in a hidden span, so a button called „Kratke" is read
 * „Kratke, Kraća trka" and the word on it is inside its name (WCAG 2.5.3).
 *
 * **Only the unit goes when there is no room, and it goes by the card's width and not the window's**
 * (owner, 20.11.2026: „Gde ne staje, otpada samo km"): „21,1" and „42,2" are written apart from their
 * „km", which a container query on the card hides (`Home.css`).
 */
export function LengthFilter({
  value,
  onChange,
  fit = false,
}: {
  value: RaceCategory | null
  onChange: (value: RaceCategory | null) => void
  /** As wide as the buttons ask, from the left, with the room between them the BTL tables have (`Segmented`). */
  fit?: boolean
}) {
  const { t } = useI18n()
  const options = [
    { key: 'all' as const, word: t('profile.lengthsShort.all'), measure: '', rest: t('home.lengthsRest') },
    ...CATEGORIES.map((one) => ({
      key: one,
      word: t(`profile.lengthsShort.${one}`),
      measure: one === 'half' || one === 'marathon' ? t(`home.lengthNumber.${one}`) : '',
      rest: t(`category.${one}`),
    })),
  ].map((option) => ({
    key: option.key,
    content: (
      <>
        {option.measure === '' ? (
          option.word
        ) : (
          <>
            {option.measure} <span className="seg__km">{t('home.lengthKm')}</span>
          </>
        )}
        {/* The space is outside the hidden words and not the first thing in them: a name is read off
            the text nodes one by one and a space that begins a node is not kept (measured). */}
        {option.key === 'all' && ' '}
        <span className="visually-hidden">
          {option.key === 'all' ? '' : ', '}
          {option.rest}
        </span>
      </>
    ),
  }))

  return (
    <Segmented
      options={options}
      value={value ?? 'all'}
      onChange={(key) => onChange(key === 'all' ? null : key)}
      label={t('profile.length')}
      fit={fit}
    />
  )
}
