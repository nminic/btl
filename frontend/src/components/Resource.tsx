import type { ReactNode } from 'react'
import type { ResourceState } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { Loader } from './Loader'

type Props<T> = {
  state: ResourceState<T>
  children: (data: T) => ReactNode
  /* Set where this Resource owns a part of the screen rather than the screen.
     Four open a second one inside their own: the front page around the
     president's address, the event around its races and its results, the league
     around its standing, and any written page carrying the wall of badges, which
     since 04.08.2026 is a section of the rulebook. */
  inline?: boolean
  /* What is being waited for, for a part that has a name. Only read when
     `inline` is set, because a screen waiting as a whole has nothing to
     distinguish itself from. */
  label?: string
}

/* Every screen that reads data goes through here, so loading and failure look
 * the same everywhere and no screen forgets to handle them. */
export function Resource<T>({ state, children, inline = false, label }: Props<T>) {
  const { t } = useI18n()

  /* A sheet over the whole page rather than a word where the content will be
     (owner, 31.07.2026). Nothing underneath can be pressed while it waits, so a
     link clicked a moment before the data lands cannot take the reader
     somewhere they did not mean to go.

     The sheet is for a Resource that owns the whole screen. For one that owns a
     part, `inline` keeps the parts already drawn readable and usable, which is
     the point of loading them separately in the first place. */
  if (state.status === 'loading') {
    return <Loader inline={inline} label={label} />
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
