import { PageMeta } from '../../app/PageMeta'
import { useI18n } from '../../i18n/useI18n'
import type { Queue } from './queues'

/**
 * The name of one queue in the browser tab, in the history and in a shared link.
 *
 * Every address on the portal names itself, administration included (ADL A7),
 * and seven queues share one address pattern: without this all seven were called
 * "Red čekanja (administracija)", so seven tabs, seven history entries and seven
 * bookmarks were one word. The queue already carries its own name for the list
 * and the heading, so there is nothing to write twice.
 *
 * Written once and used by all three screens behind those addresses, because a
 * ninth queue must not be able to arrive without a name.
 */
export function QueueMeta({ queue }: { queue: Queue }) {
  const { t } = useI18n()
  const name = t(queue.labelKey)

  return (
    <PageMeta
      title={t('seo.verificationQueue.queueTitle', { name })}
      description={t('seo.verificationQueue.queueDescription', {
        name,
        source: t(queue.sourceKey),
      })}
    />
  )
}
