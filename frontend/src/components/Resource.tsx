import type { ReactNode } from 'react'
import type { ResourceState } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { Loader } from './Loader'
import { Unreadable } from './Unreadable'

type Props<T> = {
  state: ResourceState<T>
  children: (data: T) => ReactNode
  /* Set where this Resource owns a part of the screen rather than the screen.
     Four open a second one inside their own: the front page around the
     president's address, the event around its races and its results, the league
     around its standing, and any written page carrying the wall of ducats, which
     since 04.08.2026 is a section of the rulebook. */
  inline?: boolean
  /* What is being waited for, for a part that has a name. Only read when
     `inline` is set, because a screen waiting as a whole has nothing to
     distinguish itself from.

     **It names the button as well as the loader, since 02.10.2026.** A part that failed
     says so with a button that asks again for THAT part („Pokušaj ponovo: Trke"), so two
     failed parts of one screen are two controls a reader can tell apart. A part with no
     name has a button with no name beyond its own word, which is the boundary the four
     unnamed ones (`home/President`, `member/ServedTeamInvite` and the two in
     `member/Settings`) are left in. */
  label?: string
}

/* Every screen that reads data goes through here, so loading and failure look the
 * same everywhere and no screen forgets to handle them. */
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

  /* A READ THAT FAILED SAYS SO AND OFFERS TO ASK AGAIN, on every screen that goes through here
     (decision of 02.10.2026, PENDING stavka 368, in the words of the PDL's record of it and not
     the owner's: „Spisak koji ne moze da se ucita KAZE to, umesto da izgleda prazan, uz dugme
     „Pokusaj ponovo". Vazi za sve ekrane sa spiskom."). The first half of it went into the team's
     page and the panel under the envelope (`Unreadable`); this is the second, and it is HERE and
     not on each screen for the reason the decision gives: a screen that goes through this
     component never looked like an empty list, but every one of them reads the state that now
     carries the way to ask again, so one place gives all of them the button.

     **Drawn for every failed read, lists and screens that are not lists alike.** Telling the two
     apart would need a verdict on every element that goes through here, and a list of verdicts is
     the shape that never converges. That is MY reading of the decision, not a recorded one, and
     it costs nothing a reader can lose: the sentence was already here, and the button asks for
     the same thing the sentence says could not be had. */
  if (state.status === 'error') {
    return (
      <Unreadable
        said={t('data.error')}
        named={label}
        reading={state.reading}
        onRetry={state.readAgain}
      />
    )
  }

  return <>{children(state.data)}</>
}
