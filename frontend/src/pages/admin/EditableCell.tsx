import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

/* One field of one record, changed in place.
 *
 * Editing in the row rather than on a separate screen, because the work is
 * almost always a correction of one value spotted while reading a list, and
 * sending somebody to a form and back to find their place again costs more than
 * the correction. ADL, of a team's town: „mesto ostaje u ćeliji, jer iza njega ne
 * stoji ništa".
 *
 * **WHAT A CHANGE DOES IS THE CALLER'S, SINCE 23.11.2026.** ~~The cell wrote the
 * value into the browser's session under the family and the identity it was
 * handed~~, which for the one screen that draws it (`AdminTeams.tsx`) meant a town
 * changed in the list and never on the server (PDL P13, „[ZATEČENO 23.11.2026
 * ...]"). The cell now hands the typed value to `commit` and draws what it is
 * given: the caller sends it to its route and the list reads the answer back.
 * A value left as it was is not handed on, so leaving the box without changing it
 * sends nothing.
 */
export function EditableCell({
  value,
  label,
  commit,
}: {
  value: string
  label: string
  commit: (value: string) => void
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <button
        type="button"
        className="editable"
        onClick={() => setEditing(true)}
        aria-label={`${label}: ${value}. ${t('admin.change')}`}
      >
        {value}
      </button>
    )
  }

  return (
    <input
      className="editable__input"
      type="text"
      autoFocus
      aria-label={label}
      defaultValue={value}
      onBlur={(event) => {
        if (event.target.value !== value) {
          commit(event.target.value)
        }

        setEditing(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }

        if (event.key === 'Escape') {
          setEditing(false)
        }
      }}
    />
  )
}
