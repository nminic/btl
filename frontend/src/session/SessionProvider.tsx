import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  SessionContext,
  type Message,
  type NotificationKey,
  type SessionValue,
  type Submission,
  type SubmissionStatus,
} from './context'

/* Two messages to start with, so the inbox is not judged empty. They are the
 * kind the portal actually sends: one about a result, one about the season. */
const FIRST_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    from: 'Balkanska trkačka liga',
    subject: 'Dobro došao u pripremu sezone 2027',
    body: 'Portal je otvoren za razgledanje. Kalendar se puni, a učlanjenje kreće 1. oktobra po ceni od 35 EUR.',
    date: '2026-07-20',
    read: false,
  },
  {
    id: 'msg-2',
    from: 'Balkanska trkačka liga',
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

  const decide = useCallback((id: string, status: SubmissionStatus, note: string) => {
    setSubmissions((current) =>
      current.map((one) => (one.id === id ? { ...one, status, note } : one)),
    )
  }, [])

  const markRead = useCallback((id: string) => {
    setMessages((current) => current.map((one) => (one.id === id ? { ...one, read: true } : one)))
  }, [])

  const setNotification = useCallback((key: NotificationKey, on: boolean) => {
    setNotifications((current) => ({ ...current, [key]: on }))
  }, [])

  const value = useMemo<SessionValue>(
    () => ({
      memberNumber,
      signIn: setMemberNumber,
      signOut: () => setMemberNumber(null),
      submissions,
      submit,
      decide,
      messages,
      markRead,
      notifications,
      setNotification,
    }),
    [memberNumber, submissions, submit, decide, messages, markRead, notifications, setNotification],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
