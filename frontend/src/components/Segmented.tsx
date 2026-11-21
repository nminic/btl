import type { ReactNode } from 'react'
import './Segmented.css'

/**
 * One row of buttons, one of them pressed: the shape every filter of this kind has on the portal (owner,
 * 21.11.2026, PDL: „ostali filteri istog smisla na portalu dobijaju isti vizuelni oblik, istu komponentu").
 * The length filter of the front page and the profile and the category filter of the BTL tables are this
 * component, so the three cannot drift apart.
 *
 * **Each button says what its `content` draws; a name read out in full goes in a `.visually-hidden` span of
 * that content.** The group is named by `label` (an `aria-label`) or by `labelledBy` (the id of a visible
 * word), and a button says whether it is pressed with `aria-pressed`, never by colour alone.
 *
 * **`fit` makes the row as wide as its buttons ask, from the left**; without it the row is as wide as its
 * parent, as the length filter has always been.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  fit = false,
}: {
  options: readonly { key: K; content: ReactNode }[]
  value: K
  onChange: (key: K) => void
  label?: string
  labelledBy?: string
  fit?: boolean
}) {
  return (
    <div
      className={fit ? 'seg seg--fit' : 'seg'}
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={option.key === value ? 'seg__b seg__b--on' : 'seg__b'}
          aria-pressed={option.key === value}
          onClick={() => onChange(option.key)}
        >
          {option.content}
        </button>
      ))}
    </div>
  )
}
