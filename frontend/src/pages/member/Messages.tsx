import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { formatShortDate } from '../../i18n/format'
import { useSession } from '../../session/useSession'
import { useInbox } from '../../data/useResource'
import { Resource } from '../../components/Resource'
import { useMemberScreen } from './memberScreen'
import './Member.css'

/* The inbox lives on the portal, not only in email: a member has to be able to
 * find what was said to them without digging through a mailbox.
 *
 * **SINCE 27.09.2026 IT IS THE SERVER'S INBOX AND NOT THE BROWSER'S.** Seven routes in
 * `backend/src/main` write into `message` and until that day not one of their rows was ever
 * drawn here; what this screen listed was a copy the session held in `useState`. The owner
 * met the difference himself: he refused a photograph with a reason, read the message, signed
 * out and in, and it was gone. `data/useResource.ts` says what the list is made of now. */
export function Messages({ only }: { only?: string[] } = {}) {
  const who = useMemberScreen()

  /* **THE GATE STANDS BEFORE THE ASKING, AND THAT IS THE ONE THING THIS SCREEN DOES NOT
     COPY FROM ITS NEIGHBOURS.** `Membership.tsx` and `MyResults.tsx` call their resource
     hooks and gate afterwards, which costs nothing there: results, teams and the price list
     are answered to anybody. `GET /api/inbox` is not - an account that races for nobody is
     told the address is not there (404, ADL A8, and `InboxApiTest`'s „an account with no
     member behind it is told the address is not there") - so asking first would spend a
     refused request on every moderator who opened this, and hand the screen an error state
     to draw over a sentence that is already correct.

     Gated by DRAWING the part that asks rather than by a condition inside it, because a hook
     cannot be called conditionally. The shape is `app/Shell.tsx`'s: the count of work waiting
     is read inside `AdminLink`, which is only drawn for somebody who may open administration. */
  return who.memberNumber === null ? (
    who.instead
  ) : (
    <TheWholeInbox only={only} mine={who.memberNumber} />
  )
}

/** The inbox itself, drawn only for somebody the league has given a number. */
function TheWholeInbox({ only, mine }: { only?: string[]; mine: string }) {
  const { locale, t } = useI18n()
  const { markRead } = useSession()
  const state = useInbox(mine)

  return (
    <Resource state={state}>
      {(all) => {
        /* `only` exists so the empty inbox can be seen; nothing in the application
           passes it. It filters what arrived rather than what was asked for, which is
           why it survived the move to the server unchanged. */
        const messages = only === undefined ? all : all.filter((one) => only.includes(one.id))
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
                  <li
                    key={message.id}
                    className={
                      message.read ? 'messages__item' : 'messages__item messages__item--unread'
                    }
                  >
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
                      <span className="messages__date">
                        {formatShortDate(message.date, locale)}
                      </span>
                    </div>
                    <p className="messages__from">{message.from}</p>
                    <p className="messages__body">{message.body}</p>
                    {/* **Not „unread" alone, since 27.09.2026.** A line that came off the
                        server is counted among the unread and carries no button, because
                        there is no route that writes `message_read` and a button that
                        cannot do what it says is worse than no button at all. Which lines
                        those are is decided in one place and carried on the line itself
                        (`data/types.ts`, `InboxLine.canBeMarkedRead`). */}
                    {!message.read && message.canBeMarkedRead && (
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
      }}
    </Resource>
  )
}
