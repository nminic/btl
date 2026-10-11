import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  EventComment,
  MembershipBasis,
  PendingItem,
  RacingPair,
} from '../data/types'
import { nextIdentity, nextNumber } from '../pages/admin/raceIds'
import {
  SessionContext,
  type Application,
  type Invitation,
  type PairInvite,
  type Creations,
  type Decision,
  type Decisions,
  type Deletions,
  type Edits,
  type Message,
  type PictureSent,
  type Rights,
  type SessionValue,
} from './context'
import { readerOf, useTheCachesFollowTheReader } from './theCachesFollowTheReader'

export function SessionProvider({
  initialMemberNumber = null,
  children,
}: {
  initialMemberNumber?: string | null
  children: ReactNode
}) {
  const [memberNumber, setMemberNumber] = useState<string | null>(initialMemberNumber)
  /* What the server said, and nothing a test may set up front: a real session begins
     with a cookie and an answer to `GET /api/me`, and a prop that let a case skip that
     would be a way of measuring a signed in portal without ever measuring the signing
     in. `Shell` asks the server on every visit (session/useTheServersSession.ts) and
     writes it here. */
  const [account, setAccount] = useState<number | null>(null)
  /* WHETHER THE QUESTION HAS BEEN ANSWERED, WHICH IS NOT THE SAME AS WHO IT ANSWERED
     (29.09.2026). It begins false because at the first paint of a visit nothing has been
     asked yet, and no prop may set it for the same reason the account has none: a case
     that could start it true would be measuring a portal that had already been told, and
     the moment before it is told is the one this field exists for.

     NOT DERIVED FROM THE ACCOUNT, and that is the point rather than an oversight. „The
     server answered" and „the server answered with somebody" are different facts, and the
     four ways to be nobody - a 401, a server that is not running, a body of the wrong
     shape, a role the portal does not know - all end the first and none of them end the
     second. Derived, the portal would wait for ever on exactly the reader it should send
     away fastest. */
  const [theServerHasAnswered, setTheServerHasAnswered] = useState(false)
  /* Written as a `useCallback` over nothing so it is stable for the life of the provider,
     which is what lets the one question be asked once a visit rather than once a render
     (session/useTheServersSession.ts reads it in a dependency list). */
  const theServerAnswered = useCallback(() => {
    setTheServerHasAnswered(true)
  }, [])
  /* THE TWO CACHES THAT ANSWER DIFFERENTLY TO DIFFERENT READERS FOLLOW WHO IS SIGNED IN
     (02.10.2026). Worked out here, from the two facts this provider already holds and while
     it renders, because it is the one place that renders before every screen under it and
     the one place every change of reader passes through; `session/theCachesFollowTheReader.ts`
     says why neither an effect nor a drop written beside each caller would do. */
  useTheCachesFollowTheReader(readerOf(memberNumber, account), theServerHasAnswered)
  /* Beside the account and never apart from it, which is the rule this provider
     already keeps for the account and its role: the two arrive in one answer
     (`GET /api/me`) and a screen that had one without the other would be reading half
     a session. */
  const [myMembershipBasis, setMyMembershipBasis] = useState<MembershipBasis | null>(null)
  /* AND THE THREE THE SAME ANSWER CARRIES WHOSE OTHER DOOR CANNOT ANSWER THE CALLER,
     here since 25.09.2026 (PDL P8a). `/api/competitors` carries a country, a first
     season and a team on every row, so these three are not like the four around them -
     they have a second home and are read here all the same, because that home ends
     `where c.active` and the member whose fee has LAPSED has no row in it. He is the one
     „Moja članarina" is for. Set in the same breath as the basis, for the reason written
     above it: they come in one answer and half a session is worse than none. */
  const [myCountry, setMyCountry] = useState<string | null>(null)
  const [myFirstSeason, setMyFirstSeason] = useState<number | null>(null)
  const [myTeamId, setMyTeamId] = useState<number | null>(null)
  /* AND THE OTHER TWO THE SAME ANSWER CARRIES THAT HAVE NO OTHER DOOR, here since
     25.09.2026. P26a took the caller's own referral link and his count of whom he
     brought in off `/api/competitors`, so `GET /api/me` is where both arrive and this is
     where the visit remembers them. Set in the same breath as the basis, for the reason
     written above it: they come in one answer and half a session is worse than none. */
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null)
  const [myReferredCount, setMyReferredCount] = useState<number | null>(null)
  /* EMPTY, AND IT IS THE OWNER'S OWN DECISION RATHER THAN A TIDY-UP (PDL 34, 28.09.2026).
     Two records lived here as the starting value until that day - `data/seedMessages.ts`,
     „Dobro došao u pripremu sezone 2027" and „Rezultat je odobren" - and they shipped, so
     every member on QA was greeted with mail nobody had sent him. His words, looking at it:
     „Zasto su ove testne poruke i dalje tu?????? NECU MOCK PODATKE NIGDE".

     What that decision says, in its three parts: the inbox shows exactly what
     `GET /api/inbox` answers and nothing besides; no record standing in for a row of the
     database may be in the shipped bundle; and a case that needs a message writes one
     itself. An empty inbox is an empty inbox, and drawing it is the true picture.

     What this list still holds is everything `notify` puts in it during a visit - eight
     screens write here - and `data/useResource.ts` merges that half with the served one. So
     nothing about the two halves changed; what went is the pretence that the browser starts
     holding two rows it was never given. */
  const [messages, setMessages] = useState<Message[]>([])
  const [edits, setEdits] = useState<Edits>({})
  const [creations, setCreations] = useState<Creations>({})
  const [rights, setRights] = useState<Rights>({})
  const [decisions, setDecisions] = useState<Decisions>({})
  const [deletions, setDeletions] = useState<Deletions>({})
  const [proposals, setProposals] = useState<PendingItem[]>([])
  /* Beside `proposals` and deliberately not in it: the server files the queue row for a
     picture itself, so putting one here as well drew the member twice on one queue
     (`context.ts#pictureSent`). */
  const [pictureSent, setPictureSent] = useState<PictureSent | null>(null)
  const [published, setPublished] = useState<{ from: string; comment: EventComment }[]>([])

  /* An id of its own shape, so nothing can collide with the ids in the file the
     rest of the queue is read from, and so a decision written against it is
     plainly a decision about something this visit put there. */
  const propose = useCallback((item: Omit<PendingItem, 'id'>) => {
    setProposals((current) => [{ ...item, id: `prop-${current.length + 1}` }, ...current])
  }, [])

  /* No id is minted here, unlike `propose` above, and that is the difference between the
     two: the row this names was made by the server and is the one the moderator decides
     (`context.ts#pictureSent`). */
  const sendPicture = useCallback((one: PictureSent | null) => {
    setPictureSent(one)
  }, [])

  /**
   * The number the next comment let out in this visit is given.
   *
   * **Counted downwards from nought, and that is the prototype saying out loud
   * that it has no sequence.** `/api/comments` answers with a `bigserial`, which
   * starts at one and never goes below it, so nothing numbered here can collide
   * with the file or with anything a server ever hands out, whatever either
   * grows to.
   *
   * A ref and not the length of the list, because a moderator settles a whole
   * queue in one press and `published` is state: read there, every comment of
   * that press is handed the same number and the event page draws one of them.
   */
  const letOut = useRef(0)

  /* Kept once, by the QUEUE ITEM and not by the comment. A moderator can settle
     the same item twice (approve, take down, approve again), and a list that
     grew each time would draw the comment twice on the event page. */
  const publish = useCallback((from: string, comment: Omit<EventComment, 'id'>) => {
    setPublished((current) => {
      if (current.some((one) => one.from === from)) {
        return current
      }

      letOut.current -= 1

      return [...current, { from, comment: { ...comment, id: letOut.current } }]
    })
  }, [])

  const markRead = useCallback((id: string) => {
    setMessages((current) => current.map((one) => (one.id === id ? { ...one, read: true } : one)))
  }, [])

  /* The applications waiting for an answer. Kept as a list of what is open rather than as
     a list of everything ever sent with a decision beside it: an application that has been
     answered, refused or taken back is over, and nothing on the portal asks about it
     again. One list means „is this member waiting" cannot be answered two ways. */
  const [applications, setApplications] = useState<Application[]>([])

  const apply = useCallback((application: Omit<Application, 'id'>) => {
    setApplications((current) => [
      ...current,
      /* Counted up from the highest already used, never from how many there are, because
         `answer` above shortens this very list: two members ask, the first is answered, a
         third asks, and a count hands it the id the second holds. Two applications then
         answer to one identity, and taking one back takes the other with it, unseen by the
         team it was sent to (review, 06.09.2026). `proposals` and `messages` may count,
         because nothing ever leaves them. */
      { ...application, id: `app-${String(nextNumber(current.map((one) => one.id), 'app-'))}` },
    ])
  }, [])

  const answer = useCallback((id: string) => {
    setApplications((current) => current.filter((one) => one.id !== id))
  }, [])

  /* The invitations still open, kept the same way and for the same reason as the
     applications above: what is open rather than what was ever sent. */
  const [invitations, setInvitations] = useState<Invitation[]>([])
  /* Every identity this visit has handed out, including the ones already closed, so a
     number is never given twice even after the list it came from has shortened. */
  const sent = useRef<string[]>([])

  /* Counted up from the highest already used rather than from how many there are, for the
     reason written out beside `apply`: `close` shortens this very list, so a count would
     hand a later invitation the identity an earlier one still holds, and answering one
     would answer the other.

     Worked out here rather than inside the setter, because the caller needs it back: the
     message that carries the invitation names it, and a second copy of this rule at the
     call site is a second chance for the two to disagree. `useRef` rather than reading the
     state, because two presses in one render pass would both read the same list. */
  const invite = useCallback((invitation: Omit<Invitation, 'id'>) => {
    const id = `inv-${String(nextNumber(sent.current, 'inv-'))}`

    sent.current = [...sent.current, id]
    setInvitations((current) => [...current, { ...invitation, id }])

    return id
  }, [])

  const close = useCallback((id: string) => {
    setInvitations((current) => current.filter((one) => one.id !== id))
  }, [])

  /* The pair half of the same three things, kept the same way and for the same reasons written
     above: what is open rather than what was ever sent, and identities counted up from the highest
     already used rather than from how many there are, because closing one shortens the list. */
  const [pairInvites, setPairInvites] = useState<PairInvite[]>([])
  const [pairsMade, setPairsMade] = useState<RacingPair[]>([])
  const [pairsBroken, setPairsBroken] = useState<number[]>([])
  const asked = useRef<string[]>([])
  const paired = useRef<number[]>([])

  const invitePair = useCallback((invite: Omit<PairInvite, 'id'>) => {
    const id = `par-${String(nextNumber(asked.current, 'par-'))}`

    asked.current = [...asked.current, id]
    setPairInvites((current) => [...current, { ...invite, id }])

    return id
  }, [])

  const closePairInvite = useCallback((id: string) => {
    setPairInvites((current) => current.filter((one) => one.id !== id))
  }, [])

  const makePair = useCallback((pair: Omit<RacingPair, 'id'>) => {
    /* Counted down from nought over what this visit has paired, which is all it
       has to be counted over: the file's pairs carry a `bigserial` and this never
       reaches one (`raceIds.ts`, `nextIdentity`). */
    const id = nextIdentity(paired.current)

    paired.current = [...paired.current, id]
    setPairsMade((current) => [...current, { ...pair, id }])
  }, [])

  const breakPair = useCallback((id: number) => {
    /* Written twice is written twice, and that is harmless: the list is only ever read with
       `includes`, so a second entry says the same thing as the first. A guard against it would be
       a branch nothing reaches, and a branch nothing reaches is one nobody can be sure works. */
    setPairsBroken((current) => [...current, id])
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

  /**
   * What the server said about the caller, written down in one go.
   *
   * **Held steady across renders, and that is not tidiness.** `useTheServersSession`
   * asks `GET /api/me` inside an effect whose dependencies are this function and the
   * role setter, and its own note says the question is asked „once a visit rather than
   * once a render" because both are stable. Written inline it is a new function every
   * render, the effect runs again after every state change, and a member who signs out
   * is signed straight back in by the answer arriving a tick later. Measured 21.09.2026
   * on five cases about signing out, all of which came back with the account menu still
   * on the header.
   */
  const theServerSignedMeIn = useCallback(
    (who: {
      account: number
      memberNumber: string | null
      country: string | null
      firstSeason: number | null
      teamId: number | null
      membershipBasis: MembershipBasis | null
      referralCode: string | null
      referredCount: number | null
    }) => {
      setAccount(who.account)
      /* **WRITTEN EVEN WHEN IT IS NULL, and that is the half that carries a fault if it
         is skipped.** The tempting shape is „only write a number the answer really has",
         so that nothing can clear what was already there. It would be wrong on the one
         road where this is called twice in a visit: `SignIn` signs somebody in, navigates
         away, and the form can be walked back to and used by SOMEBODY ELSE. A moderator
         signing in after a member, on an answer with no record in it, would keep that
         member's number and be handed his profile, his messages and his settings -
         eleven screens of another person's, with the header naming the moderator.

         Nothing in production is being trampled by writing it: `App` mounts this
         provider with no member number, and the only other writer (`signIn`) is called by
         no screen, both measured 24.09.2026. `useTheServersSession` keeps the other half
         of the rule - an answer that never came writes nothing at all - and it keeps it
         by not calling this at all, which is where that decision belongs. */
      setMemberNumber(who.memberNumber)
      /* WRITTEN EVEN WHEN NULL, the same as every line around them and for the same
         road: a second sign in during one visit. A country left standing from the member
         before would put the person after on his payment slip - his currency, his ways
         of paying, and in Serbia a QR code for dinars - which is the sharpest form this
         fault takes anywhere on the portal, because it is the one screen where what is
         drawn is money. */
      setMyCountry(who.country)
      setMyFirstSeason(who.firstSeason)
      setMyTeamId(who.teamId)
      setMyMembershipBasis(who.membershipBasis)
      /* WRITTEN EVEN WHEN NULL, for the same reason the two above are: the road this
         rule was written for is a second sign in during one visit, and a value kept from
         the person before is a value shown to the person after. A member's referral link
         left standing for a moderator signing in behind him would be the plainest form
         of that, because the link is the one thing on „Moja članarina" that is his to
         hand out. */
      setMyReferralCode(who.referralCode)
      setMyReferredCount(who.referredCount)
    },
    [],
  )

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
      account,
      myMembershipBasis,
      myCountry,
      myFirstSeason,
      myTeamId,
      myReferralCode,
      myReferredCount,
      theServerSignedMeIn,
      theServerHasAnswered,
      theServerAnswered,
      /* One question, one answer, worked out here from the only two facts there are.
         The member number wins where both are set, because every screen that draws a
         member reads THROUGH it: the account number names a row of `account` and the
         member number names a person in the league, and only the second is somebody a
         screen can draw. Since 24.09.2026 both arrive in the SAME answer, so „both set"
         is no longer two sources disagreeing but one answer read whole.

         **It said „reads the mock through it" until 21.09.2026**, and the mock went off
         that day (`data/client.ts`); measured, putting `BASE` back fails two cases in
         `data/contract.test.ts`. What the sentence is about did not move: the two facts
         are a member number and an account, and only one of them names somebody a screen
         can draw. */
      signedIn:
        memberNumber !== null
          ? { as: 'member', memberNumber }
          : account !== null
            ? { as: 'account', account }
            : null,
      /* BOTH, and never one of them. Signing out of a real session while the prototype
         member number stood would leave the header signed in with a server that has
         already forgotten the cookie, which is the one state no screen could recover
         from without another sign in. */
      signOut: () => {
        setMemberNumber(null)
        setAccount(null)
      },
      inbox,
      applications,
      apply,
      answer,
      invitations,
      invite,
      close,
      pairInvites,
      invitePair,
      closePairInvite,
      pairsMade,
      pairsBroken,
      makePair,
      breakPair,
      markRead,
      notify,
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
      pictureSent,
      sendPicture,
      published,
      publish,
    }),
    [
      memberNumber,
      account,
      /* **BOTH OF THESE WERE MISSING UNTIL 21.09.2026, and the reason nothing showed it
         is the shape this repository keeps being bitten by.** The basis is set in the
         same breath as the account (`theServerSignedMeIn`), so the memo was rebuilt for
         the account's sake and the new basis came along with it - the right screen for
         the wrong reason, and a second writer of either would have parted them. The
         setter is a `useCallback` over nothing and never changes; it is named here all
         the same, because a dependency list that leaves out what it reads is a list
         somebody has to re-derive by hand the next time it grows. */
      myMembershipBasis,
      /* And the five P26a and P8a moved here on 25.09.2026, named for the same reason:
         they are set in the same breath as the basis, so the memo would be rebuilt for
         its sake and they would come along - which is the right screen for the wrong
         reason, and exactly what this comment was written about. */
      myCountry,
      myFirstSeason,
      myTeamId,
      myReferralCode,
      myReferredCount,
      theServerSignedMeIn,
      theServerHasAnswered,
      theServerAnswered,
      inbox,
      applications,
      apply,
      answer,
      invitations,
      invite,
      close,
      pairInvites,
      invitePair,
      closePairInvite,
      pairsMade,
      pairsBroken,
      makePair,
      breakPair,
      markRead,
      notify,
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
      pictureSent,
      sendPicture,
      published,
      publish,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
