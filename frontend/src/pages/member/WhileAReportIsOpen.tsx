import type { ReactElement } from 'react'
import { Resource } from '../../components/Resource'
import { useI18n } from '../../i18n/useI18n'
import { aReportIsOpen } from './reportingOpen'
import { useSeasonsOpenForAReport } from './useSeasonsOpenForAReport'

/**
 * THE FORM ITSELF, AND NOT ONLY THE LINKS TO IT, is not drawn while the server names no season open
 * for his report (`reportingOpen.ts`, PDL P9, owner, 24.11.2026), for the reason `event/NotRunYet.tsx`
 * gives: an address typed or kept in a history is a way in that no hidden link closes.
 *
 * <p>Loading and a failed read are said through `Resource`, the way every read says them, so a member
 * whose answer could not be read is told so with a way to ask again, and is never shown the form.
 */
export function WhileAReportIsOpen({ asked, children }: { asked: number | string; children: ReactElement }) {
  const { t } = useI18n()
  const open = useSeasonsOpenForAReport(asked)

  return (
    <Resource state={open}>
      {(seasons) =>
        aReportIsOpen(seasons) ? (
          children
        ) : (
          /* Inside the screen's own `member` box, the way `Resource` draws its loading and failure. */
          <>
            <h1>{t('newResult.notOpen')}</h1>
            <p>{t('newResult.notOpenWhy')}</p>
          </>
        )
      }
    </Resource>
  )
}
