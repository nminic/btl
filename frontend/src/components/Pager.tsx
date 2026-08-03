import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { PER_PAGE } from './pageOf'
import './Pager.css'

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
export function Pager({ page, rows, label }: { page: number; rows: number; label: string }) {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const pages = Math.ceil(rows / PER_PAGE)

  if (pages <= 1) {
    return null
  }

  const go = (to: number) => {
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
      <p className="pager__count">
        {t('pager.showing', { first, last, rows })}
      </p>

      <p className="pager__steps">
        <button
          type="button"
          className="button button--secondary"
          disabled={page === 1}
          onClick={() => go(page - 1)}
        >
          {t('pager.previous')}
        </button>

        {/* The page a reader is on, said in words rather than left to the two
            steps to imply. */}
        <span className="pager__where">{t('pager.page', { page, pages })}</span>

        <button
          type="button"
          className="button button--secondary"
          disabled={page === pages}
          onClick={() => go(page + 1)}
        >
          {t('pager.next')}
        </button>
      </p>
    </nav>
  )
}
