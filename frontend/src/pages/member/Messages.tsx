import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { formatShortDate } from '../../i18n/format'
import { useSession } from '../../session/useSession'
import { SignedOut } from './SignedOut'
import './Member.css'

/* The inbox lives on the portal, not only in email: a member has to be able to
 * find what was said to them without digging through a mailbox. */
export function Messages({ only }: { only?: string[] } = {}) {
  const { locale, t } = useI18n()
  const { memberNumber, inbox: all, markRead } = useSession()
  // `only` exists so the empty inbox can be seen; nothing in the application
  // passes it.
  const messages = only === undefined ? all : all.filter((one) => only.includes(one.id))

  if (memberNumber === null) {
    return <SignedOut />
  }

  const unread = messages.filter((one) => !one.read).length

  return (
    <div className="member">
      <h1>{t('messages.title')}</h1>
      <p className="member__note">{t('messages.unread', { count: unread })}</p>

      {messages.length === 0 ? (
        <p className="profile__empty">{t('messages.empty')}</p>
      ) : (
        <ul className="messages">
          {messages.map((message) => (
            <li key={message.id} className={message.read ? 'messages__item' : 'messages__item messages__item--unread'}>
              <div className="messages__head">
                {/* **The subject opens the message, on this screen as in the panel.**
                    Until 06.09.2026 this list wrote every message out whole and linked
                    to none of them, which was enough while every message told something.
                    One of them now asks (`member/InvitationAnswer.tsx`), and a member who
                    reads „Tim te poziva" here found no way to answer and no way to reach
                    the screen that has one: the only road was the panel in the header
                    (review, 06.09.2026). */}
                <Link className="messages__subject" to={`/${locale}/poruke/${message.id}`}>
                  {message.subject}
                </Link>
                <span className="messages__date">{formatShortDate(message.date, locale)}</span>
              </div>
              <p className="messages__from">{message.from}</p>
              <p className="messages__body">{message.body}</p>
              {!message.read && (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => markRead(message.id)}
                >
                  {t('messages.markRead')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
