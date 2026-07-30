import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import type { StaticPage } from '../../data/types'
import { usePages } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { EditableCell } from './EditableCell'
import { EntityEditor, NewRecord, OpenRecord } from './EntityEditor'
import { PAGES, recordsOf, type Editing } from './entityForms'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/* The written pages: the rulebook, the history, the privacy policy, the terms.
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

export function AdminPages() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const { edits, creations } = useSession()
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = usePages()

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('admin.pages')}</h1>
      <p className="member__note">{t('admin.pagesNote')}</p>

      <Resource state={state}>
        {(pages) => {
          const rows = recordsOf(PAGES, pageRows(pages), edits, creations)

          if (editing !== null) {
            return (
              <EntityEditor entity={PAGES} editing={editing} onDone={() => setEditing(null)} />
            )
          }

          return (
            <>
              <NewRecord entity={PAGES} onOpen={() => setEditing({ mode: 'new' })} />

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
                          <Link to={`/${locale}/${page.slug}`}>/{page.slug}</Link>
                        </td>
                        <td>{page.heading}</td>
                        <td>{formatNumber(page.sectionCount, locale)}</td>
                        <td>
                          <OpenRecord
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
