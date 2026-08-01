import { useI18n } from '../i18n/useI18n'
import './Loader.css'

/**
 * What is on screen while a screen, or a part of one, waits for its data
 * (owner, 31.07.2026).
 *
 * The page-level form is a sheet over the whole page rather than the word
 * "Učitavanje" where the content will be. Two reasons, and the second is the
 * real one.
 *
 * A line of text where a table is about to appear reads as the answer: somebody
 * glances, sees words, and looks away before the table arrives. And the page
 * underneath is still there to be clicked, so a link pressed a quarter of a
 * second before the data lands takes the reader somewhere they did not mean to
 * go. The sheet covers it, so nothing under it can be clicked.
 *
 * It does not take the keyboard. Every control in the header and the footer is
 * still reachable by Tab and still activates, and a focus ring under a 78% tint
 * and a blur is hard to see. That is a gap against WCAG 2.2 SC 2.4.7 and 2.4.11,
 * raised for the owner rather than closed here: closing it means giving the
 * header its own stacking context above the sheet and lifting the skip link with
 * it, which overturns what this file is for.
 *
 * The `inline` form is for a Resource that owns a part of a screen rather than
 * the screen. Covering the page for it would hide the parts that have already
 * arrived and are useful, so it stands where the part will be, with no sheet, no
 * tint and no blur.
 *
 * It says what it is doing out loud, and it stands still for anyone who has
 * asked their system for less motion.
 */
export function Loader({ inline, label }: { inline: boolean; label?: string }) {
  const { t } = useI18n()

  return (
    <div className={inline ? 'loader loader--inline' : 'loader'} role="status" aria-live="polite">
      <span className="loader__ring" aria-hidden="true" />
      <span className="visually-hidden">
        {label === undefined ? t('data.loading') : t('data.loadingPart', { part: label })}
      </span>
    </div>
  )
}
