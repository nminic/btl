import { Link } from 'react-router'
import { formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import { dataOr, useInbox } from '../data/useResource'
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
  return signedIn !== null && signedIn.as === 'member' ? (
    /* Keyed on the member, so a caller who changes without signing out is handed a FRESH
       `HisOwnInbox` and not the one already mounted for whoever it was before. Without this,
       `app/Shell.tsx` never unmounts the panel across the switch - `signedIn !== null` stays
       true throughout - and `useResource`'s `useState` reads the cache once, at mount, and
       never again while the same instance lives on. Review of PR 406. */
    <HisOwnInbox key={signedIn.memberNumber} mine={signedIn.memberNumber} />
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
     Until the answer lands the panel says there is nothing, and then it says what arrived. */
  return <ThePanel lines={dataOr(useInbox(mine), [])} />
}

function ThePanel({ lines }: { lines: InboxLine[] }) {
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

          {lines.length === 0 ? (
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
