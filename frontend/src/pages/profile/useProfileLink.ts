import { useCallback } from 'react'
import { applyChanges } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { profilePath } from '../profileAddress'
import { reachable } from './visible'
import type { Competitor } from '../../data/types'

/**
 * The address a list may send a reader to, or nothing.
 *
 * **One question, asked in one place, for every screen that writes a name.** Nine screens draw a
 * competitor's name and eight of them may link it; the rule that says whether they may is the
 * same rule the profile page uses to decide whether to draw itself, so a member the page turns
 * away cannot be reached from a list either.
 *
 * Nothing is taken away from the reader when the answer is nothing: the name stays, as plain
 * text. The owner's rule, 06.09.2026: „sva njegova pojavljivanja na portalu u tabelama i rang
 * listama postaju tekst umesto link za sve posetioce koji nisu ulogovani." The data on those
 * lists is not touched either — hiding is about reaching the profile, not about what a list says.
 *
 * **Not exported**, so a screen cannot reach for it and build an address without coming through
 * the hook below — which is to say, without reading what this visit has said about that member.
 * It lived beside the rule in `profile/visible.ts` and was exported there until 07.09.2026;
 * measured that day, a screen rewritten to call it passed every gate, 2645 cases and 100 per cent,
 * while linking a member who had just hidden themselves.
 *
 * **What holds this is behaviour and not a rule about imports** (07.09.2026, after four rounds of
 * review). A floor stood here that asked which modules reach `pages/profileAddress`, and each
 * round found one more way to write the same import: a second exported name, double quotes,
 * `export … from`, `import(…)`, a `.ts` extension, and finally `export { profilePath }` written as
 * a statement beside the import it re-exports. The question was wrong, not the reading: what P23
 * forbids is a link, not an import, and a link can be built without importing anything at all.
 *
 * So the floor is gone and `pages/profilePrivacy.test.tsx` hides a member and asks **every address
 * the portal has** whether it still leads to their profile. All five mutations the floor used to
 * catch were run against it before it was deleted, and all five fall — including the two the floor
 * never could: an address spelt out by hand, and a bare re-export.
 */
function profileLinkFor(
  competitor: Competitor,
  reader: string | null,
  locale: string,
): string | undefined {
  return reachable(competitor, reader) ? profilePath(competitor, locale) : undefined
}

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
 * plain text.
 */
export function useProfileLink(): (competitor: Competitor) => string | undefined {
  const { memberNumber: reader, edits } = useSession()
  const { locale } = useI18n()

  return useCallback(
    (competitor: Competitor) =>
      profileLinkFor(applyChanges(competitor, edits[competitor.memberNumber]), reader, locale),
    [edits, reader, locale],
  )
}
