import { useCallback } from 'react'
import { applyChanges } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { profileLinkFor } from './visible'
import type { Competitor } from '../../data/types'

/**
 * The address a screen may send a reader to for a competitor, or nothing.
 *
 * **A hook rather than a function every screen calls with three arguments**, because two of those
 * three are the same on every screen and reading them is the part that gets forgotten. Eight
 * screens draw a name that may be a link, and only three of them had the reader in hand: the
 * other five would each have had to fetch it, which is five chances to fetch it wrongly or not at
 * all. Here it is read once.
 *
 * **And the member is read again here too, which is the fourth thing** (review, 07.09.2026).
 * A screen hands in whatever record it happens to hold, and eleven of them hold the record as it
 * came off the file. Hiding is chosen during a visit and lives nowhere but the session until
 * there is a database, so a record off the file cannot carry it: measured on 07.09.2026, a member
 * who ticked the box and signed out was still a link on the standing, on the top boards, on the
 * front page, on an event and in a competition, while the list of competitors, which does read
 * through the overlay, drew plain text. Five screens, one omission each.
 *
 * Rather than a sixth chance to forget it, the answer is read where the question is asked. What a
 * screen hands in is the identity; what this visit has said about that member is taken from the
 * session and laid over it, exactly as `recordsOf` lays it over a whole list
 * (`pages/admin/entityForms.ts`). A screen that reads through the overlay already hands in the
 * same record, so nothing is applied twice: an edit written over itself is the same edit.
 *
 * Creations and deletions are deliberately not read here. A member created during this visit is
 * not on any of these lists to be linked, and a member deleted during it is a question about what
 * a list still draws rather than about where its names lead.
 *
 * Nothing comes back when the profile cannot be reached, and the screen then draws the name as
 * plain text. That is the whole of the rule the owner set on 06.09.2026: hiding takes away the
 * way in, not the name and not the row.
 */
export function useProfileLink(): (competitor: Competitor) => string | undefined {
  const { memberNumber: reader, edits } = useSession()
  const { locale } = useI18n()

  return useCallback(
    (competitor: Competitor) =>
      profileLinkFor(
        applyChanges(competitor, edits[competitor.memberNumber]),
        reader,
        locale,
      ),
    [edits, reader, locale],
  )
}
