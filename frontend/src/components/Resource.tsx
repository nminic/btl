import { useLayoutEffect, useRef, type ReactNode } from 'react'
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
     `member/Settings`) are left in.

     **And it is what the keyboard hears when a part that failed has been read again**
     (see the effect below): the focus lands on a node that says the part's name and nothing
     else, so a reader who pressed the button learns which part came back. A part with no
     name gets the node and no words. */
  label?: string
}

/* Every screen that reads data goes through here, so loading and failure look the
 * same everywhere and no screen forgets to handle them. */
export function Resource<T>({ state, children, inline = false, label }: Props<T>) {
  const { t } = useI18n()

  /* **WHERE THE KEYBOARD GOES WHEN A READ THAT FAILED IS READ AGAIN AND WORKS** (review of PR 476,
     round 2). `Unreadable` keeps the focus on its button while it asks and the button is taken
     out of the document when what failed is replaced by what was read, so a reader who pressed
     it with Enter was left on `<body>`: on a whole screen, on a part and in the panel under the
     envelope alike (WCAG 2.2 SC 2.4.3). `Unreadable` says that the button left with the focus on
     it and this puts the focus where the reader was.

     **ONLY IF IT LEFT WITH THE FOCUS ON IT, AND ONLY IF NOBODY HAS TAKEN THE FOCUS SINCE.** A
     reader who moved on while it asked, or who never had the focus on the button, is not followed:
     that would be the portal taking the keyboard from somebody who was using it. And a screen that
     put the focus somewhere of its own while it drew (`autoFocus` in `pages/admin/PendingQueue.tsx`
     puts it on a control the moment the control is drawn) keeps it, as `app/useNewScreen.ts` keeps
     it for the same reason: the children's own layout effects run before this one, so by now the
     focus is theirs.

     **A WHOLE SCREEN GOES TO `main`**, which the shell already makes focusable for the router
     (`useNewScreen`) and already draws without a ring (`.shell__main:focus-visible`): the reader is
     put at the top of the screen, as after any navigation, and the next Tab goes into it. Not
     scrolled, as `useNewScreen` does not scroll: pulling the landmark into view would undo the
     position the reader is at.

     **A PART GOES TO A NODE OF ITS OWN IN FRONT OF IT, NOT TO A WRAPPER AROUND IT.** The reviewer
     proposed a wrapper with `tabIndex={-1}`, and that was measured before it was written: the
     containers parts are drawn in include `.section-body` (the wall of ducats) and `.member` (the
     settings), and each is a flex column with a `gap`, so a wrapper would swallow the gap between
     the part's own root elements and the part would be laid out differently after it was read
     again than before it failed. The node here is `visually-hidden`, so it is positioned
     absolutely and is not a flex item. Nor is it where a positional selector of the stylesheets
     looks (`:first-child`, `:nth-child`, `:empty`, `+`): those are aimed at table cells, a menu,
     chart columns, form and rights groups and three lines that say something and are empty
     otherwise, and none of the thirteen parts is drawn in one of them (read off the stylesheets and
     the parts, not measured on each part). The one part that was measured in a browser, the wall of
     ducats at three widths and with the text doubled, is laid out identically with the node and
     without it. The node is drawn only by a Resource that has failed at least once, so a part that
     never failed is exactly the markup it always was.

     **ACROSS A WAIT, NOT ACROSS A FAILURE.** When several files are asked for and the one that
     failed is read while another is still on its way, what is drawn is the loader, and the button
     is gone with the focus on it; the focus goes where it belongs when the last of them arrives. A
     new failure drops it: the button that is drawn then is a new one, and a press on it is a new
     question. */
  const keptTheFocus = useRef(false)
  const failedOnce = useRef(false)
  const anchor = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    if (state.status === 'error') {
      failedOnce.current = true
      keptTheFocus.current = false
    } else if (state.status === 'ready' && keptTheFocus.current) {
      keptTheFocus.current = false

      if (document.activeElement === document.body) {
        const where = inline ? anchor.current : document.querySelector<HTMLElement>('main')

        where?.focus({ preventScroll: true })
      }
    }
  })

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
        onLeaveWithFocus={() => {
          keptTheFocus.current = true
        }}
      />
    )
  }

  return (
    <>
      {inline && failedOnce.current && (
        <span className="visually-hidden" tabIndex={-1} ref={anchor}>
          {label}
        </span>
      )}
      {children(state.data)}
    </>
  )
}
