import type { ReactNode } from 'react'
import type { ResourceState } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { Loader } from './Loader'

type Props<T> = {
  state: ResourceState<T>
  children: (data: T) => ReactNode
}

/* Every screen that reads data goes through here, so loading and failure look
 * the same everywhere and no screen forgets to handle them. */
export function Resource<T>({ state, children }: Props<T>) {
  const { t } = useI18n()

  /* A sheet over the whole page rather than a word where the content will be
     (owner, 31.07.2026). Nothing underneath can be pressed while it waits, so a
     link clicked a moment before the data lands cannot take the reader
     somewhere they did not mean to go. */
  if (state.status === 'loading') {
    return <Loader />
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
