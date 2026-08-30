import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { EventComment, PendingItem, Result } from '../data/types'
import { nextNumber } from '../pages/admin/raceIds'
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
  type Amendment,
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
  /* The counted results a moderator has agreed to change during this visit, by the
     identity of the record each one replaces. Read by `useResults`, so the
     standing, the profile, the boards and the league all see one answer. */
  const [corrected, setCorrected] = useState<Record<string, Result>>({})
  const [messages, setMessages] = useState<Message[]>(FIRST_MESSAGES)
  const [edits, setEdits] = useState<Edits>({})
  const [creations, setCreations] = useState<Creations>({})
  const [rights, setRights] = useState<Rights>({})
  const [decisions, setDecisions] = useState<Decisions>({})
  const [deletions, setDeletions] = useState<Deletions>({})
  const [proposals, setProposals] = useState<PendingItem[]>([])
  const [going, setGoingAll] = useState<Record<string, boolean>>({})
  const [published, setPublished] = useState<EventComment[]>([])
  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    resultApproved: true,
    resultChanged: true,
    newsletter: false,
  })

  const submit = useCallback(
    (submission: Omit<Submission, 'id' | 'status' | 'note' | 'corrected'>) => {
      /* Counted up from the highest number already used, never from how many
         there are. Until 27.08.2026 nothing here ever went away, so a count was
         safe; `withdraw` on the same day made the list shorten, and a count then
         hands a new result the number a deleted one held. Two submissions answer
         to one id, React draws them under one key, and a moderator pressing
         „Odobri" on one approves the other as well: measured, one press approved
         a result belonging to another member and put it into the standings.

         `nextNumber` is the module the portal already keeps this rule in, and its
         own note records the same fault measured on races on 23.08.2026. Written
         through it rather than beside it, so there is one rule and not two. */
      setSubmissions((current) => [
        {
          ...submission,
          id: `sub-${String(nextNumber(current.map((one) => one.id), 'sub-'))}`,
          status: 'pending',
          note: '',
          corrected: false,
        },
        ...current,
      ])
    },
    [],
  )

  /**
   * The same result, corrected and sent in again (owner, 06.08.2026).
   *
   * The one that was refused, not a second one beside it. A refusal is not the
   * end of a result: the member is told why, corrects it and sends the same race
   * again, and it goes back into the queue it came from. Written as one item
   * because it is one race: two rows, one refused and one waiting, would have
   * the moderator reading the same morning twice and deciding it twice.
   *
   * The reason goes with it. It was the answer to the version that has just been
   * replaced, and left standing it would sit under a result nobody has looked at
   * yet, saying it was refused.
   */
  const resubmit = useCallback(
    (id: string, corrected: Omit<Submission, 'id' | 'status' | 'note' | 'corrected' | 'memberNumber'>) => {
      /* Where a new one goes, and not left where it stood (owner, 27.08.2026:
         „Vraća se na kraj reda kao nov"). A moderator who has already opened this
         item read the numbers it had then; left in place with different numbers,
         the next press decides something they never saw.

         **Where a new one goes** is the front of this list, because `submit`
         puts a new submission there and every list in this store is newest
         first. His sentence has two halves and under a newest-first list they
         pull apart: put at the far end of the array, a result corrected a minute
         ago is drawn **below** results sent last week, which is the one place a
         new arrival is never drawn. „Kao nov" is the half that can be obeyed
         exactly, and the half that decides: what it loses is its old place, which
         is the whole point, and what it gains is the place anything freshly
         arrived has. Said here because the other reading is defensible and the
         cost of changing it is one line.

         Marked as corrected on the way, and that mark is the whole of what the
         queue is told: „samo labela, ne šta je ispravljano" (owner, same day),
         which is the only thing that can be said while no history of a result is
         kept (P9). */
      setSubmissions((current) => [
        ...current
          .filter((one) => one.id === id)
          .map((one) => {
            /* Marked as corrected only where something really moved. „Samo
               labela" (owner, 27.08.2026) is a label that has to mean something,
               and a member who presses „Izmeni" and sends the same numbers back
               has corrected nothing: measured, that put „Ispravljeno" on a row
               nobody had touched, telling the moderator to re-read numbers that
               had not changed.

               Read through a plain record rather than by asserting the shape of a
               key, because an assertion is what this portal does not write
               (ADL A14). */
            const before: Record<string, unknown> = { ...one }
            const moved = Object.entries(corrected)
              /* The two the member never types: both are worked out from what
                 they do type, so a difference in either is a difference in
                 something already compared beside it, and comparing them again
                 only adds ways to be wrong. */
              .filter(([field]) => field !== 'points' && field !== 'category')
              .some(([field, value]) => before[field] !== value)

            return {
              ...one,
              ...corrected,
              status: 'pending' as const,
              note: '',
              corrected: one.corrected || moved,
            }
          }),
        ...current.filter((one) => one.id !== id),
      ])
    },
    [],
  )

  /**
   * Taking one's own result back.
   *
   * Owner, 27.08.2026: „član ga ili briše (ima pravo na to, iako je verifikovan)
   * ili menja i dostavlja dokaz za tu izmenu". The half that lives here is the
   * one about a result still in the queue; a verified one is not a submission at
   * all and is taken back where the portal keeps it.
   *
   * Gone rather than kept and flagged, because the portal keeps no history of a
   * result (P9): a withdrawn one would be a record nobody is allowed to read and
   * a row in a queue nobody may decide.
   */
  const withdraw = useCallback((id: string) => {
    setSubmissions((current) => current.filter((one) => one.id !== id))
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

  /**
   * What the administration puts right on a submission before it decides it.
   *
   * A separate act from `decide`, and from `resubmit`, because it is a third
   * thing. `resubmit` is the member's: it marks the item corrected, which is a
   * word aimed at the moderator („samo labela", owner 27.08.2026), and it sends
   * the item back to the front of the queue as new. Neither is true here. The
   * moderator is already reading this item, is the one changing it, and the mark
   * would tell them that somebody else had.
   *
   * What may be changed is what the owner named on 30.08.2026: the name of the
   * event, the name of the race, the kind, and the time. The member's answer to
   * the kind is a hint until this happens („Takmičar je mogao da izabere dužinska
   * ili vremenska, kao nagoveštaj tipa"), and the time on a timed race is the
   * race's limit rather than a run („ja ću lako promeniti njegovo vreme sa recimo
   * 23:23:15 na 24:00:00").
   *
   * Nothing is said to the member per change: one standing sentence in Član 44
   * covers it, which was the owner's own answer over a note beside each one.
   *
   * The item keeps its place. A moderator who has read the row is the one writing
   * on it, so there is nobody to surprise, which is the whole reason `resubmit`
   * moves an item and this does not.
   */
  const amend = useCallback((id: string, changes: Amendment) => {
    setSubmissions((current) => current.map((one) => (one.id === id ? { ...one, ...changes } : one)))
  }, [])

  const decide = useCallback((id: string, status: SubmissionStatus, note: string) => {
    setSubmissions((current) => {
      const one = current.find((item) => item.id === id)

      /* And where what was agreed to is a correction of a counted result, the
         standing changes here and nowhere else.
       *
         Owner, 28.08.2026: the old result stays where it is while the correction
         waits, and changes when somebody agrees with it. Until then the result
         left the standing the moment the correction was sent, so a refusal lost
         the points for good; the portal's own rule is that the standing is brought
         up to date **after** verification (PDL P9), and this is where "after"
         happens.
       *
         Only on approval, and nothing at all on a refusal: a member whose
         correction is turned down is left exactly where they were, which is the
         whole of what the owner chose.
       *
         Under the identity of the record it replaces, so the standing keeps one
         result for one race rather than growing a second beside it. */
      if (status === 'approved' && one?.corrects !== undefined) {
        const put = one.corrects

        setCorrected((so) => ({ ...so, [put.id]: put }))
      }

      return current.map((item) => (item.id === id ? { ...item, status, note } : item))
    })
  }, [])

  const markRead = useCallback((id: string) => {
    setMessages((current) => current.map((one) => (one.id === id ? { ...one, read: true } : one)))
  }, [])

  const setGoing = useCallback((eventId: string, going: boolean) => {
    setGoingAll((current) => ({ ...current, [eventId]: going }))
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
      corrected,
      submit,
      resubmit,
      amend,
      withdraw,
      decide,
      inbox,
      going,
      setGoing,
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
      going,
      setGoing,
      submissions,
      corrected,
      submit,
      resubmit,
      amend,
      withdraw,
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
