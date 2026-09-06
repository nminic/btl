import { useState } from 'react'
import { liga } from '../../forms/definitions'
import { limitOf } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'

/**
 * A piece of what an organiser has written about a competition, read where it is written.
 *
 * **It stands on the list of competitions and nowhere else, since 07.09.2026.** The owner moved
 * the terms and the prizes off the page of a single league and onto the list of all of them:
 * „Propozicije i Nagrade treba da se izlistavaju na ovoj strani, a ne kad se uđe u ligu… na strani
 * Lige ne postoje propozicije i nagrade (one se vide samo na listi svih liga)."
 *
 * **Changed where it is read, and not in a screen of its own.** Asked where a moderator should
 * edit it now that the page it lived on no longer has it, the owner chose the same place it is
 * read (07.09.2026). A screen that shows one thing and changes it somewhere else is a screen
 * where the two can disagree, and the person who spots the mistake is the one who cannot fix it.
 *
 * Hides itself while nobody has written it and nobody may.
 */
export function EditableText({
  value,
  headingId,
  heading,
  canEdit,
  onSave,
}: {
  value: string
  headingId: string
  heading: string
  canEdit: boolean
  onSave: (text: string) => void
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)

  if (value === '' && !canEdit) {
    return null
  }

  return (
    <section aria-labelledby={headingId}>
      <h3 className="profile__section" id={headingId}>
        {heading}
      </h3>

      {editing ? (
        <textarea
          className="field__control league__editor"
          autoFocus
          aria-label={heading}
          defaultValue={value}
          /* The same cap the administration form puts on it. Rewriting in place took as much as
             anybody cared to paste, so the text could come back longer than the form that made it
             accepts, and the next person to open that form was told their own words were too
             long. The number lives in the definition (`forms/records.ts`). */
          maxLength={limitOf(liga, 'rules')}
          onBlur={(event) => {
            onSave(event.target.value)
            setEditing(false)
          }}
        />
      ) : (
        <p className="profile__text">{value === '' ? t('leagues.notWritten') : value}</p>
      )}

      {canEdit && !editing && (
        <button type="button" className="button button--secondary" onClick={() => setEditing(true)}>
          {t('admin.change')}
        </button>
      )}
    </section>
  )
}
