import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { EventComment, PendingItem } from '../data/types'
import {
  SessionContext,
  type Creations,
  type Decision,
  type Decisions,
  type Deletions,
  type Edits,
  type Message,
  type NotificationKey,
  type Rights,
  type SessionValue,
  type Submission,
  type SubmissionStatus,
} from './context'

/* Two messages to start with, so the inbox is not judged empty. They are the
 * kind the portal actually sends: one about a result, one about the season. Both
 * are the league talking to everybody, which is what an empty `to` means. */
const FIRST_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    from: 'Balkanska trkačka liga',
    to: '',
    subject: 'Dobro došao u pripremu sezone 2027',
    body: 'Portal je otvoren za razgledanje. Kalendar se puni, a učlanjenje kreće 1. oktobra po ceni od 35 EUR.',
    date: '2026-07-20',
    read: false,
  },
  {
    id: 'msg-2',
    from: 'Balkanska trkačka liga',
    to: '',
    subject: 'Rezultat je odobren',
    body: 'Tvoj rezultat sa Jadovničkog ultramaratona je proveren i ušao je u rang listu.',
    date: '2026-07-12',
    read: true,
  },
]

export function SessionProvider({
  initialMemberNumber = null,
  children,
}: {
  initialMemberNumber?: string | null
  children: ReactNode
}) {
  const [memberNumber, setMemberNumber] = useState<string | null>(initialMemberNumber)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [messages, setMessages] = useState<Message[]>(FIRST_MESSAGES)
  const [edits, setEdits] = useState<Edits>({})
  const [creations, setCreations] = useState<Creations>({})
  const [rights, setRights] = useState<Rights>({})
  const [decisions, setDecisions] = useState<Decisions>({})
  const [deletions, setDeletions] = useState<Deletions>({})
  const [proposals, setProposals] = useState<PendingItem[]>([])
  const [published, setPublished] = useState<EventComment[]>([])
  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    resultApproved: true,
    resultChanged: true,
    upcomingEvent: true,
    newsletter: false,
  })

  const submit = useCallback((submission: Omit<Submission, 'id' | 'status' | 'note'>) => {
    setSubmissions((current) => [
      { ...submission, id: `sub-${current.length + 1}`, status: 'pending', note: '' },
      ...current,
    ])
  }, [])

  /* An id of its own shape, so nothing can collide with the ids in the file the
     rest of the queue is read from, and so a decision written against it is
     plainly a decision about something this visit put there. */
  const propose = useCallback((item: Omit<PendingItem, 'id'>) => {
    setProposals((current) => [{ ...item, id: `prop-${current.length + 1}` }, ...current])
  }, [])

  /* Kept once. A moderator can settle the same item twice (approve, take down,
     approve again), and a list that grew each time would draw the comment
     twice on the event page. */
  const publish = useCallback((comment: EventComment) => {
    setPublished((current) =>
      current.some((one) => one.id === comment.id) ? current : [...current, comment],
    )
  }, [])

  const decide = useCallback((id: string, status: SubmissionStatus, note: string) => {
    setSubmissions((current) =>
      current.map((one) => (one.id === id ? { ...one, status, note } : one)),
    )
  }, [])

  const markRead = useCallback((id: string) => {
    setMessages((current) => current.map((one) => (one.id === id ? { ...one, read: true } : one)))
  }, [])

  const notify = useCallback((message: Omit<Message, 'id' | 'read'>) => {
    // Newest first, so what just arrived is at the top of the panel and of the
    // inbox, which is where somebody looking for it will look.
    setMessages((current) => [{ ...message, id: `msg-${current.length + 1}`, read: false }, ...current])
  }, [])

  const edit = useCallback((id: string, field: string, value: string) => {
    setEdits((current) => ({ ...current, [id]: { ...current[id], [field]: value } }))
  }, [])

  const editRecord = useCallback((id: string, values: Record<string, string>) => {
    setEdits((current) => ({ ...current, [id]: { ...current[id], ...values } }))
  }, [])

  const create = useCallback((entity: string, id: string, values: Record<string, string>) => {
    // Newest first, because the record somebody just entered is the one they are
    // looking for when the list comes back.
    setCreations((current) => ({ ...current, [entity]: [{ id, values }, ...(current[entity] ?? [])] }))
  }, [])

  const setRight = useCallback((moderator: string, right: string, granted: boolean) => {
    setRights((current) => ({
      ...current,
      [moderator]: { ...current[moderator], [right]: granted },
    }))
  }, [])

  const setNotification = useCallback((key: NotificationKey, on: boolean) => {
    setNotifications((current) => ({ ...current, [key]: on }))
  }, [])

  const settle = useCallback((id: string, decision: Decision) => {
    setDecisions((current) => ({ ...current, [id]: decision }))
  }, [])

  /**
   * Three things happen, and all three are the same act.
   *
   * The identity goes on the entity's list of deletions, so the generated record
   * underneath is read past. Any record created during this visit under that
   * identity is dropped outright, because there is nothing underneath it to read
   * past and a deletion entry would then also swallow the next record entered
   * under the same identity. And the changes remembered against it go with it,
   * or a record entered later under a freed identity would inherit the edits of
   * the one that is gone: the overlay of changes is keyed by identity, and an
   * identity really is freed by deletion (PDL P23).
   */
  const remove = useCallback((entity: string, id: string) => {
    setDeletions((current) => ({ ...current, [entity]: [...(current[entity] ?? []), id] }))
    setCreations((current) => ({
      ...current,
      [entity]: (current[entity] ?? []).filter((one) => one.id !== id),
    }))
    setEdits(({ [id]: _gone, ...rest }) => rest)
  }, [])

  /* What the person at the keyboard is allowed to see: what was written to them,
   * and what was written to the whole league. The store holds everybody's. */
  const inbox = useMemo(
    () => messages.filter((one) => one.to === '' || one.to === memberNumber),
    [messages, memberNumber],
  )

  const value = useMemo<SessionValue>(
    () => ({
      memberNumber,
      signIn: setMemberNumber,
      signOut: () => setMemberNumber(null),
      submissions,
      submit,
      decide,
      inbox,
      markRead,
      notify,
      notifications,
      setNotification,
      edits,
      edit,
      editRecord,
      creations,
      create,
      rights,
      setRight,
      decisions,
      settle,
      deletions,
      remove,
      proposals,
      propose,
      published,
      publish,
    }),
    [
      memberNumber,
      submissions,
      submit,
      decide,
      inbox,
      markRead,
      notify,
      notifications,
      setNotification,
      edits,
      edit,
      editRecord,
      creations,
      create,
      rights,
      setRight,
      decisions,
      settle,
      deletions,
      remove,
      proposals,
      propose,
      published,
      publish,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
