import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'

/* One field of one record, changed in place.
 *
 * Editing in the row rather than on a separate screen, because the work is
 * almost always a correction of one value spotted while reading a list, and
 * sending somebody to a form and back to find their place again costs more than
 * the correction.
 */
export function EditableCell({
  id,
  field,
  value,
  label,
}: {
  id: string
  field: string
  value: string
  label: string
}) {
  const { t } = useI18n()
  const { edits, edit } = useSession()
  const [editing, setEditing] = useState(false)
  const current = edits[id]?.[field] ?? value

  if (!editing) {
    return (
      <button
        type="button"
        className="editable"
        onClick={() => setEditing(true)}
        aria-label={`${label}: ${current}. ${t('admin.change')}`}
      >
        {current}
      </button>
    )
  }

  return (
    <input
      className="editable__input"
      type="text"
      autoFocus
      aria-label={label}
      defaultValue={current}
      onBlur={(event) => {
        edit(id, field, event.target.value)
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
