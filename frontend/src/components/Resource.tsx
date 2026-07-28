import type { ReactNode } from 'react'
import type { ResourceState } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'

type Props<T> = {
  state: ResourceState<T>
  children: (data: T) => ReactNode
}

/* Every screen that reads data goes through here, so loading and failure look
 * the same everywhere and no screen forgets to handle them. */
export function Resource<T>({ state, children }: Props<T>) {
  const { t } = useI18n()

  if (state.status === 'loading') {
    return (
      <p className="resource-state" role="status">
        {t('data.loading')}
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p className="resource-state" role="alert">
        {t('data.error')}
      </p>
    )
  }

  return <>{children(state.data)}</>
}
