import { formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { PER_PAGE } from './pageOf'
import './Pager.css'
import { useFilterParams } from '../app/useFilterParams'

/**
 * The way from one page of a long table to the next.
 *
 * In the address rather than in state, like the season and the month before it:
 * a page somebody is reading is a page they can send to somebody else, and a
 * page held in state is lost by every reload.
 *
 * Drawn only when there is more than one page. A control that can do nothing is
 * a control that has to be read before it can be dismissed.
 */
export function Pager({
  page: asked,
  rows,
  label,
}: {
  page: number
  rows: number
  label: string
}) {
  const { locale, t } = useI18n()
  const [params, setParams] = useFilterParams()
  const pages = Math.ceil(rows / PER_PAGE)
  /* Held inside its own bounds, whatever it was handed. A caller that forgets to
     read the address through `pageFrom` would otherwise draw "Prikazano 401 do
     137 od 137" and two steps that both look usable. */
  const page = Math.min(Math.max(1, asked), Math.max(1, pages))

  if (pages <= 1) {
    return null
  }

  const go = (to: number) => {
    /* Nothing at either end. The steps stay focusable rather than being
       switched off, so pressing the last one somebody can press does not throw
       the keyboard back to the top of the document; `aria-disabled` says the
       same thing to a screen reader that `disabled` would, and leaves the
       button where the reader's finger is. */
    if (to < 1 || to > pages) {
      return
    }

    const next = new URLSearchParams(params)

    /* The first page is the one with no number on it, so the address of a table
       nobody has paged through stays the address of the table. */
    if (to === 1) {
      next.delete('strana')
    } else {
      next.set('strana', String(to))
    }

    setParams(next)
  }

  const first = (page - 1) * PER_PAGE + 1
  const last = Math.min(page * PER_PAGE, rows)

  return (
    <nav className="pager" aria-label={label}>
      {/* Said out loud when it changes, which is the only signal a page turn
          gives: the focus deliberately stays on the step that was pressed, so
          without this a reader hears nothing, presses again thinking the first
          press was lost, and lands two pages on (WCAG 2.2 SC 4.1.3; ADL A7 asks
          for the same where a filter changes how many rows a standing has).

          It arrives with the table, holding words already, and the announcement
          that matters comes later over a node that has been standing since. */}
      <p className="pager__count" role="status">
        {t('pager.showing', {
          first: formatNumber(first, locale),
          last: formatNumber(last, locale),
          rows: formatNumber(rows, locale),
        })}
      </p>

      <p className="pager__steps">
        <button
          type="button"
          className="button button--secondary"
          aria-disabled={page === 1}
          onClick={() => go(page - 1)}
        >
          {t('pager.previous')}
        </button>

        {/* The page a reader is on, said in words rather than left to the two
            steps to imply. */}
        <span className="pager__where">
          {t('pager.page', {
            page: formatNumber(page, locale),
            pages: formatNumber(pages, locale),
          })}
        </span>

        <button
          type="button"
          className="button button--secondary"
          aria-disabled={page === pages}
          onClick={() => go(page + 1)}
        >
          {t('pager.next')}
        </button>
      </p>
    </nav>
  )
}
