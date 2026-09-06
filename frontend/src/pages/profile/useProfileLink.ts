import { useCallback } from 'react'
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
 * Nothing comes back when the profile cannot be reached, and the screen then draws the name as
 * plain text. That is the whole of the rule the owner set on 06.09.2026: hiding takes away the
 * way in, not the name and not the row.
 */
export function useProfileLink(): (competitor: Competitor) => string | undefined {
  const { locale } = useI18n()
  const { memberNumber: reader } = useSession()

  return useCallback(
    (competitor: Competitor) => profileLinkFor(competitor, reader, locale),
    [reader, locale],
  )
}
