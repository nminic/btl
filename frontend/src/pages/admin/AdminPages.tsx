import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { withoutOwnAddress } from '../../data/pages'
import type { StaticPage } from '../../data/types'
import { usePages } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import '../member/Member.css'

/* The written pages: the rulebook, the privacy policy, the terms, and the
 * address of the president. AN OVERVIEW AND NOTHING ELSE, since 27.09.2026.
 *
 * A written page is never edited through the portal (ADL.md, resolved
 * 18.09.2026, owner: "Nijedna pisana strana se ne uredjuje u portalu.
 * Upisne rute za strane nema i nece je biti."). The screen used to offer a
 * form to add one, a cell to rename one in place, and a way to open and
 * delete a row, and every one of those wrote nowhere a byte of it could
 * reach: a written page is one of the six entities administration still
 * edits as a browser-only overlay (entityForms.ts, EntityEditor.tsx) rather
 * than through a route, and unlike the other five this one was never going
 * to grow one. A control that writes nowhere is worse than no control
 * (PDL.md, "Kontrola koja nista ne radi je gora nego da je nema"), so this
 * screen keeps only what it can actually do: read what the server serves.
 *
 * The delete button was worse than merely silent. Deleting a row here left
 * `deletions.pages` holding the slug for the rest of the visit, and both
 * public readers of a written page (Rulebook.tsx, StaticPage.tsx) check it
 * before drawing the page - so an administrator who "removed" the rulebook
 * or the terms of use saw that same public address answer 404 for the rest
 * of the session, while every other visitor went on reading it unchanged.
 * Nothing here reaches for that overlay any more, and read-only was chosen
 * over reproducing that behaviour on purpose.
 */
type PageRow = {
  slug: string
  title: string
  heading: string
  sectionCount: number
}

/** The record read the way this screen shows it: only the first section's own
 *  heading, which is the same partial view the table always drew. A page
 *  that has not been written yet has no sections at all, and is listed with
 *  an empty heading rather than being left off. */
function pageRows(pages: StaticPage[]): PageRow[] {
  return pages.map((page) => ({
    slug: page.slug,
    title: page.title,
    heading: page.sections.at(0)?.heading ?? '',
    sectionCount: page.sections.length,
  }))
}

/* The pages with no address of their own: the address of the president is
 * written once and drawn inside the front page (PDL P28a). Its row is here,
 * because this is where it is maintained, but a link to /rec-predsednika would
 * lead nowhere. Asked of the data layer, which is where both ways of being
 * drawn inside something else are named (src/data/pages.ts). */

export function AdminPages() {
  const { locale, t } = useI18n()
  const state = usePages()

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.pages')}</h1>

      <Resource state={state}>
        {(pages) => {
          const rows = pageRows(pages)
          const inside = withoutOwnAddress(pages)

          return (
            <>
              {/* Said once, at the top, because the absence of every control that
                  used to be here is not an explanation on its own (same shape as
                  `AdminPricing.tsx`'s `admin.pricingFixed`, for the same reason). */}
              <p className="member__note">{t('admin.pagesNotEditable')}</p>

              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.pages')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('admin.pageTitle')}</th>
                      <th scope="col">{t('admin.address')}</th>
                      <th scope="col">{t('admin.field.sectionHeading')}</th>
                      <th scope="col">{t('admin.sections')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((page) => (
                      <tr key={page.slug}>
                        <td>{page.title}</td>
                        <td>
                          {inside.has(page.slug) ? (
                            <span className="member__note">{t('admin.noAddress')}</span>
                          ) : (
                            <Link to={`/${locale}/${page.slug}`}>/{page.slug}</Link>
                          )}
                        </td>
                        <td>{page.heading}</td>
                        <td>{formatNumber(page.sectionCount, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
