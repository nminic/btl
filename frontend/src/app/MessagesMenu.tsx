import { Link } from 'react-router'
import { formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import { Dropdown } from './Dropdown'
import { MailIcon } from './icons'

/* The inbox as a small panel under the header (PDL P28a): enough to see what
 * arrived and whether it matters. The subject is a link, and it opens the
 * message on its own page in the member area, because a panel this size is a
 * glance, not a place to read. */
export function MessagesMenu() {
  const { locale, t } = useI18n()
  const { inbox: messages } = useSession()
  const unread = messages.filter((one) => !one.read).length

  return (
    <Dropdown
      id="messages-menu"
      className="inbox"
      /* The count goes in the name of the button, not next to it: an aria-label
       * replaces everything inside the button, so a badge described only by a
       * hidden span is a badge a screen reader never reads out. */
      label={`${t('shell.openMessages')}, ${t('shell.unread', { count: unread })}`}
      trigger={
        <>
          <MailIcon className="inbox__glyph" />
          {unread > 0 && (
            <span className="inbox__badge" aria-hidden="true">
              {unread}
            </span>
          )}
        </>
      }
    >
      {(close) => (
        <>
          <p className="inbox__title">{t('shell.messages')}</p>

          {messages.length === 0 ? (
            <p className="inbox__empty">{t('shell.noMessages')}</p>
          ) : (
            <ul className="inbox__list">
              {messages.map((message) => (
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
