import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { usePages } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { EditableCell } from './EditableCell'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/* The written pages: the rulebook, the history, the privacy policy, the terms.
 * The title is editable here; the body is long-form text and belongs in a
 * proper editor, which arrives with the database rather than before it. */
export function AdminPages() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const state = usePages()

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('admin.pages')}</h1>
      <p className="member__note">{t('admin.pagesNote')}</p>

      <Resource state={state}>
        {(pages) => (
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">{t('admin.pages')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.pageTitle')}</th>
                  <th scope="col">{t('admin.address')}</th>
                  <th scope="col">{t('admin.sections')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(pages).map(([slug, page]) => (
                  <tr key={slug}>
                    <td>
                      <EditableCell
                        id={slug}
                        field="title"
                        value={page.title}
                        label={t('admin.pageTitle')}
                      />
                    </td>
                    <td>
                      <Link to={`/${locale}/${slug}`}>/{slug}</Link>
                    </td>
                    <td>{formatNumber(page.sections.length, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Resource>
    </div>
  )
}
