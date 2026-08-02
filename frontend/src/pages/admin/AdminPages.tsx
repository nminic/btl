import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import type { StaticPage } from '../../data/types'
import { usePages } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { EditableCell } from './EditableCell'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { PAGES, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import '../member/Member.css'

/* The written pages: the rulebook, the privacy policy, the terms,
 * and the address of the president.
 *
 * A page is a title and a list of sections. The form reaches the first section,
 * which is where a page starts and the part somebody rewrites; the rest of the
 * sections wait for the long-form editor that arrives with the database.
 */
type PageRow = {
  slug: string
  title: string
  heading: string
  body: string
  sectionCount: number
}

/** The record flattened into the shape a form can hold. A page that has not been
 *  written yet has no sections at all, and has to be listed all the same. */
function pageRows(pages: Record<string, StaticPage>): PageRow[] {
  return Object.entries(pages).map(([slug, page]) => {
    const first = page.sections.at(0) ?? { heading: '', body: '' }

    return {
      slug,
      title: page.title,
      heading: first.heading,
      body: first.body,
      sectionCount: page.sections.length,
    }
  })
}

/* The pages that other pages take in, which are the ones with no address of
 * their own: the address of the president is written once and drawn inside the
 * front page and inside "O ligi" (PDL P28a). Its row is here, because this is
 * where it is maintained, but a link to /rec-predsednika would lead to "Ove
 * strane nema". */
function takenIn(pages: Record<string, StaticPage>): Set<string> {
  return new Set(Object.values(pages).flatMap((page) => page.includes ?? []))
}

export function AdminPages() {
  const { locale, t } = useI18n()
  const overlay = useOverlay()
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = usePages()

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.pages')}</h1>

      <Resource state={state}>
        {(pages) => {
          const rows = recordsOf(PAGES, pageRows(pages), overlay)
          const inside = takenIn(pages)

          if (editing !== null) {
            return (
              <EntityEditor
                entity={PAGES}
                editing={editing}
                /* The address is the identity of a page, so a new page cannot be
                   given one that answers already: two records on /pravilnik
                   would be one page arguing with itself. */
                taken={rows.map((page) => page.slug)}
                onDone={() => setEditing(null)}
              />
            )
          }

          return (
            <>
              <EntityBar entity={PAGES} onNew={() => setEditing({ mode: 'new' })} />

              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.pages')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('admin.pageTitle')}</th>
                      <th scope="col">{t('admin.address')}</th>
                      <th scope="col">{t('admin.field.sectionHeading')}</th>
                      <th scope="col">{t('admin.sections')}</th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((page) => (
                      <tr key={page.slug}>
                        <td>
                          <EditableCell
                            id={page.slug}
                            field="title"
                            value={page.title}
                            label={t('admin.pageTitle')}
                          />
                        </td>
                        <td>
                          {inside.has(page.slug) ? (
                            <span className="member__note">{t('admin.noAddress')}</span>
                          ) : (
                            <Link to={`/${locale}/${page.slug}`}>/{page.slug}</Link>
                          )}
                        </td>
                        <td>{page.heading}</td>
                        <td>{formatNumber(page.sectionCount, locale)}</td>
                        <td>
                          <RowActions
                            entity={PAGES}
                            record={page}
                            name={page.title}
                            onOpen={() => setEditing({ mode: 'one', record: page })}
                          />
                        </td>
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
