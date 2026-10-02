import { useState } from 'react'
import { Link } from 'react-router'
import { Unreadable } from '../components/Unreadable'
import { formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import { dataOr, theInboxHasChanged, useInbox } from '../data/useResource'
import type { InboxLine } from '../data/types'
import { Dropdown } from './Dropdown'
import { MailIcon } from './icons'

/* The inbox as a small panel under the header (PDL P28a): enough to see what
 * arrived and whether it matters. The subject is a link, and it opens the
 * message on its own page in the member area, because a panel this size is a
 * glance, not a place to read.
 *
 * **SINCE 27.09.2026 WHAT IT SHOWS IS THE SERVER'S ANSWER** and not a list the browser was
 * holding, for the reason written over `pages/member/Messages.tsx`: the owner signed out and
 * back in and the message the server had kept was gone from the screen.
 *
 * **Two components and not one, because the envelope is drawn for every signed in account and
 * the inbox belongs only to somebody the league has given a number.** The header draws this
 * beside the picture whenever `signedIn !== null` (`app/Shell.tsx`, which names no member
 * number anywhere in it), and `GET /api/inbox` answers an account that races for nobody the
 * way an address that is not there answers. So the asking is gated by which of the two is
 * drawn - the shape `AdminLink` in the same folder already uses - rather than by a condition
 * inside a hook, which cannot be written. */
export function MessagesMenu() {
  const { signedIn } = useSession()

  /* A moderator and a superadmin have no competitor row at all (PDL P21, owner 14.09.2026),
     so they have NO inbox rather than an empty one - `InboxApi` says exactly that. What the
     header shows them is the empty panel, which is the same sentence an inbox with nothing in
     it gets: „there is nothing here" is true for both, and the difference between having none
     and having one that is empty is not a difference a header can usefully draw. */
  /* `useInbox` reads fresh the moment `mine` changes, even without a key: `app/Shell.tsx`
     never unmounts this panel while `signedIn` stays non-null, so a caller who changes
     without signing out has to reach a caller-aware read inside `useResource` itself, not a
     remount here (review of PR 406, second round - a `key` on this element was tried first
     and reverted, because it forced `MessageDetail.tsx`'s equivalent to tear down hooks the
     owner change had nothing to do with; `useResource`'s own doc has the measurement). */
  return signedIn !== null && signedIn.as === 'member' ? (
    <HisOwnInbox mine={signedIn.memberNumber} />
  ) : (
    <ThePanel lines={[]} />
  )
}

/** The panel for whoever has one, read off the server. */
function HisOwnInbox({ mine }: { mine: string }) {
  /* **WAITED FOR BY NOBODY, WHICH IS THE ONE THING THIS MAY NOT DO.** This panel stands over
     every screen on the portal, so a `Resource` here would put the loading sheet over all of
     them, and an error state would put „Podaci se ne mogu učitati." in the header of a portal
     that is otherwise working. `Shell.tsx` answers the same question the same way for the
     count of work waiting: „A header that waited for it would hold up every screen behind it."
     Until the answer lands the panel says there is nothing, and then it says what arrived.

     **AND WHEN THE ANSWER NEVER COMES IT SAYS THAT, INSIDE THE PANEL, and no longer „there is
     nothing"** (owner, 02.10.2026, PENDING stavka 368: „Spisak koji ne moze da se ucita KAZE to,
     umesto da izgleda prazan, uz dugme „Pokusaj ponovo". Vazi za sve ekrane sa spiskom."). The
     paragraph above is what this was written against and what it said is still true of the
     loading sheet and of an error drawn over the page: neither is drawn. What is drawn is a
     sentence in a panel that is shut until somebody opens it, with the button that asks again,
     so a server that did not answer is no longer read as an inbox with nothing in it. */
  const inbox = useInbox(mine)
  /* Which state of the read the last press was made on, and never a flag of its own: the read
     replaces its state with a new object whether it comes back or fails again, so „the press is
     out" is exactly „the state is still the one it was pressed on", and it ends by itself the
     moment the answer lands, without an effect to clear it. */
  const [askedOn, setAskedOn] = useState<typeof inbox | null>(null)

  return (
    <ThePanel
      lines={dataOr(inbox, [])}
      unreadable={
        inbox.status === 'error'
          ? {
              reading: askedOn === inbox,
              retry: () => {
                setAskedOn(inbox)
                theInboxHasChanged()
              },
            }
          : undefined
      }
    />
  )
}

function ThePanel({
  lines,
  unreadable,
}: {
  lines: InboxLine[]
  /**
   * Present only where the read FAILED, which is a different fact from a read that came back
   * empty, and carrying what asking again needs: whether it is out, and how to do it. One object
   * and not three props, so there is no state in which the panel is told it is unreadable and not
   * how to ask again.
   */
  unreadable?: { reading: boolean; retry: () => void }
}) {
  const { locale, t } = useI18n()
  const unread = lines.filter((one) => !one.read).length

  return (
    <Dropdown
      id="messages-menu"
      className="inbox"
      /* The count goes in the name of the button, not next to it: an aria-label
       * replaces everything inside the button, so a counter described only by a
       * hidden span is a counter a screen reader never reads out. */
      label={`${t('shell.openMessages')}, ${t('shell.unread', { count: unread })}`}
      trigger={
        <>
          <MailIcon className="inbox__glyph" />
          {unread > 0 && (
            <span className="inbox__count" aria-hidden="true">
              {unread}
            </span>
          )}
        </>
      }
    >
      {(close) => (
        <>
          <p className="inbox__title">{t('shell.messages')}</p>

          {unreadable !== undefined ? (
            <Unreadable
              said={t('shell.messagesUnreadable')}
              named={t('shell.messages')}
              reading={unreadable.reading}
              onRetry={unreadable.retry}
            />
          ) : lines.length === 0 ? (
            <p className="inbox__empty">{t('shell.noMessages')}</p>
          ) : (
            <ul className="inbox__list">
              {lines.map((message) => (
                <li key={message.id} className={message.read ? undefined : 'inbox__item--unread'}>
                  <Link
                    className="inbox__link"
                    to={`/${locale}/poruke/${message.id}`}
                    onClick={close}
                  >
                    <span className="inbox__subject">{message.subject}</span>
                    <span className="inbox__date">{formatShortDate(message.date, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link className="inbox__all" to={`/${locale}/poruke`} onClick={close}>
            {t('shell.allMessages')}
          </Link>
        </>
      )}
    </Dropdown>
  )
}
