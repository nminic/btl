import { useI18n } from '../i18n/useI18n'
import './Loader.css'

/**
 * What is on screen while a screen waits for its data (owner, 31.07.2026).
 *
 * A sheet over the whole page rather than the word "Učitavanje" where the
 * content will be. Two reasons, and the second is the real one.
 *
 * A line of text where a table is about to appear reads as the answer: somebody
 * glances, sees words, and looks away before the table arrives. And the page
 * underneath is still there to be clicked, so a link pressed a quarter of a
 * second before the data lands takes the reader somewhere they did not mean to
 * go. The sheet covers it, so nothing under it can be reached, by mouse or by
 * keyboard.
 *
 * It says what it is doing out loud for anyone who cannot see the sheet, and it
 * stands still for anyone who has asked their system for less motion.
 */
export function Loader() {
  const { t } = useI18n()

  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="loader__ring" aria-hidden="true" />
      <span className="visually-hidden">{t('data.loading')}</span>
    </div>
  )
}
