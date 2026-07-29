import { createContext } from 'react'
import type { RaceCategory } from '../data/types'

/* What the prototype remembers between screens.
 *
 * It exists so the flows actually connect: a competitor enters a result, the
 * moderator finds it in the queue, approves it, and the competitor sees it
 * appear. Reading that sequence on a screen is worth more than any description
 * of it, and it is the whole reason for building the front end first.
 *
 * All of it is in memory. When the backend arrives this provider reads the
 * session and calls the API; the screens ask the same questions either way.
 */

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export type Submission = {
  id: string
  memberNumber: string
  eventName: string
  date: string
  distanceKm: number
  ascentM: number
  descentM: number
  seconds: number
  points: number
  category: RaceCategory
  link: string
  status: SubmissionStatus
  /** Why it was sent back, so the competitor is not left guessing. */
  note: string
}

export type Message = {
  id: string
  from: string
  subject: string
  body: string
  date: string
  read: boolean
}

export type NotificationKey = 'resultApproved' | 'resultChanged' | 'upcomingEvent' | 'newsletter'

export type SessionValue = {
  /** Member number of whoever is signed in, or null. */
  memberNumber: string | null
  signIn: (memberNumber: string) => void
  signOut: () => void

  submissions: Submission[]
  submit: (submission: Omit<Submission, 'id' | 'status' | 'note'>) => void
  decide: (id: string, status: SubmissionStatus, note: string) => void

  messages: Message[]
  markRead: (id: string) => void

  notifications: Record<NotificationKey, boolean>
  setNotification: (key: NotificationKey, on: boolean) => void
}

export const NOTIFICATION_KEYS: NotificationKey[] = [
  'resultApproved',
  'resultChanged',
  'upcomingEvent',
  'newsletter',
]

/** The seven obligatory emails cannot be switched off (PDL P17); these can. */
export const SessionContext = createContext<SessionValue | null>(null)
