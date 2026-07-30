import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { NotFound } from '../NotFound'
import { SignedOut } from './SignedOut'
import './Member.css'

/* Where a subject in the header panel leads: the message, opened out, on its
 * own address that can be kept and shared (PDL P28a). Opening it is what marks
 * it read; asking someone to press a button to say they have read what is on
 * the screen in front of them is asking for nothing.
 *
 * This is the one detail screen that deliberately does NOT name the page after
 * the record it shows, so there is no <PageMeta> here. The subject of a message
 * is personal data (PDL P23), and a document title is the least private thing
 * on a computer: it goes into the browser tab, into history, into a bookmark and
 * into whatever a shared screen shows. The generic name for this address is set
 * once, in EXTRA_ADDRESSES in src/app/routes.ts. */
export function MessageDetail() {
  const { locale, t } = useI18n()
  const { id } = useParams()
  const { memberNumber, inbox, markRead } = useSession()
  /* Out of the inbox rather than out of the store, so an address that names
   * somebody else's message answers with the not found page instead of showing
   * it (Message.to). */
  const message = inbox.find((one) => one.id === id)
  const unread = message !== undefined && !message.read

  useEffect(() => {
    if (unread && id !== undefined) {
      markRead(id)
    }
  }, [unread, id, markRead])

  if (memberNumber === null) {
    return <SignedOut />
  }

  if (message === undefined) {
    return <NotFound />
  }

  return (
    <div className="member">
      <Link className="member__back" to={`/${locale}/poruke`}>
        {t('shell.allMessages')}
      </Link>

      <h1>{message.subject}</h1>
      <p className="messages__from">
        {message.from} · {formatShortDate(message.date, locale)}
      </p>
      <p className="messages__body">{message.body}</p>
    </div>
  )
}
