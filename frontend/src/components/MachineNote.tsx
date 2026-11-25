import type { ShownText } from '../data/types'
import { useI18n } from '../i18n/useI18n'

/**
 * THE FEW WORDS UNDER A TEXT THE MACHINE TRANSLATED (owner, PDL P18, 25.11.2026: „uz mašinski preveden tekst stoji
 * kratka oznaka"), and nothing at all under any other: words as written, a hand translation and a text nobody has
 * translated yet are not the machine's.
 *
 * <p>The class is the one the description of an event has drawn since PR 835 (`.event__translated` in
 * `pages/Profile.css`, loaded with every screen): muted and smaller, still the muted text colour every other quiet
 * line of the portal is drawn in, so the contrast it already passes is the contrast this passes.
 *
 * @param inline a word in a cell of a table, where a paragraph would give the row a second line of its own margin
 */
export function MachineNote({ shown, inline = false }: { shown: ShownText; inline?: boolean }) {
  const { t } = useI18n()

  if (!shown.machine) {
    return null
  }

  return inline ? (
    <small className="event__translated"> {t('translation.machine')}</small>
  ) : (
    <p className="event__translated">{t('translation.machine')}</p>
  )
}
