import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { recordKey } from '../../session/context'
import { useSession } from '../../session/useSession'

/* One field of one record, changed in place.
 *
 * Editing in the row rather than on a separate screen, because the work is
 * almost always a correction of one value spotted while reading a list, and
 * sending somebody to a form and back to find their place again costs more than
 * the correction.
 *
 * **The family comes in from the caller and is not optional** (20.09.2026). A
 * change is filed under the family AND the identity since the records took the
 * shape the schema keeps, because a `bigserial` is only unique inside its own
 * table (`session/context.ts`, `recordKey`). This cell wrote and read the
 * identity on its own for a day, and a key written one way and read the other
 * never meets: the cell drew the new value out of its own state and every screen
 * reading through `recordsOf` went on showing the old one, the button in that
 * same row included.
 *
 * Handed in rather than worked out here, because every screen that draws a cell
 * already holds the definition the row came out of, and a cell that guessed the
 * family would be a second answer to a question that has one. Required rather
 * than defaulted, so the compiler is what answers „does every caller pass it":
 * a new cell that leaves it out does not build.
 */
export function EditableCell({
  under,
  id,
  field,
  value,
  label,
}: {
  under: string
  id: string
  field: string
  value: string
  label: string
}) {
  const { t } = useI18n()
  const { edits, edit } = useSession()
  const [editing, setEditing] = useState(false)
  const key = recordKey(under, id)
  const current = edits[key]?.[field] ?? value

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
        edit(key, field, event.target.value)
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
