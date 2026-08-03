import { useEffect, useRef } from 'react'
import { useI18n } from '../../i18n/useI18n'

/**
 * What one decision for a whole queue did, said in words and given the focus.
 *
 * The button is drawn only while something is waiting, so the sweep takes it off
 * the screen in the same render that empties the queue. Without this the focus
 * falls to the document: the next Tab starts the page from the skip link, and
 * for anybody being read to nothing at all happened, because the only sign was
 * a table appearing further down.
 *
 * So the line takes the focus as it arrives, which both says what happened and
 * leaves the keyboard where the work now is, immediately above the table of what
 * was settled. It is the same answer the rest of the section already gives: a
 * deleted row hands the focus to the empty row, a closed reason box hands it back
 * to the button that opened it (PendingQueue, EntityEditor).
 *
 * Focus rather than a live region, because a live region that is added to the
 * page together with its text is the kind a screen reader often misses, and
 * because the keyboard has to be moved regardless.
 */
export function Swept({ count }: { count: number | null }) {
  const { t } = useI18n()
  const line = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (count !== null) {
      line.current?.focus()
    }
  }, [count])

  if (count === null) {
    return null
  }

  return (
    <p className="pending__swept" tabIndex={-1} ref={line}>
      {t('verification.approveAllDone', { count })}
    </p>
  )
}
