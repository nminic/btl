/** Where a statement is taken. Written once so the screen and the cases about it cannot part. */
export const STATEMENTS = '/api/statements'

/** Where the payments of every statement that still wait for a person are read. */
export const STATEMENT_LINES = '/api/statements/lines'

/**
 * A member a payment on a statement may be about: the one its reference names, or one whose first and
 * last name the payer is (owner, 24.10.2026, PDL „Učitavanje izvoda iz banke": „Uplata bez poziva na
 * broj dobija predlog člana po imenu i prezimenu uplatioca"). The number and the town are what tell two
 * of one name apart, as on the list below it.
 */
export type Candidate = {
  competitorId: number
  memberNumber: string
  firstName: string
  lastName: string
  city: string
}

/** What a payment on a statement is: booked by the statement itself, already settled, or waiting. */
export type LineState = 'booked' | 'alreadyRecorded' | 'waiting'

/**
 * One payment a statement says arrived, as `StatementApi` answers it.
 *
 * Everything the statement printed about it, which is what the decision names („uplatioca, njegov
 * račun, iznos, šifru plaćanja, svrhu i poziv na broj kad postoji"), and what the portal made of it.
 */
export type StatementLine = {
  id: number
  /** The day of the statement it is on, and its number. */
  dated: string
  statement: number
  payer: string
  payerAccount: string
  amount: number
  currency: string
  paymentCode: string
  purpose: string
  reference: string
  /** The season being paid for when the statement was taken. */
  season: number
  state: LineState
  /** Whom it was booked to, or who already holds the season; null while it waits. */
  member: Candidate | null
  /** While it waits: whom it may be about, both namesakes when there are two. */
  candidates: Candidate[]
  /** While it waits: why it was not booked by itself, one of `WhyALineWaits`. */
  waitsBecause: string
}

/** What taking a statement did. */
export type Taken = {
  number: number
  dated: string
  /** How many of its payments this taking booked; nought for a statement taken before. */
  bookedNow: number
  lines: StatementLine[]
}

/**
 * THE SENTENCE FOR EACH REASON A PAYMENT WAITS, one for every constant of `WhyALineWaits.java`, which
 * `statement.test.ts` reads, in both directions.
 */
export const WHY_IT_WAITS: Record<string, string> = {
  noReference: 'review.statement.why.noReference',
  unknownReference: 'review.statement.why.unknownReference',
  anotherSeason: 'review.statement.why.anotherSeason',
  notInDinars: 'review.statement.why.notInDinars',
  notTheExpectedAmount: 'review.statement.why.notTheExpectedAmount',
  notBooked: 'review.statement.why.notBooked',
}

/** What `POST /api/statements` can refuse, each to its sentence (`refusals.test.ts` reads the route). */
export const WHEN_TAKING_A_STATEMENT: Record<string, string> = {
  theStatementIsMissing: 'review.statement.refused.theStatementIsMissing',
  theStatementIsTooLarge: 'review.statement.refused.theStatementIsTooLarge',
  theFileIsNotAStatement: 'review.statement.refused.theFileIsNotAStatement',
  theStatementIsOfAnotherAccount: 'review.statement.refused.theStatementIsOfAnotherAccount',
}

/** The file as the route takes it: one part, named `statement`. */
export function statementToSend(file: File): FormData {
  const body = new FormData()

  body.append('statement', file)

  return body
}

/**
 * The payments that wait, read straight off the route, or nothing at all.
 *
 * A plain `fetch` and no token, for the reason `member/myBalance.ts` gives beside its own read: a read
 * needs none. **Null covers every way this can fail**, the same decision: no server, 401, 404 for a
 * moderator without the tick, a body that is not JSON or not a list of lines. The screen then draws no
 * list rather than an empty one, because „nothing waits" is a claim and a failed read is not.
 */
export async function whatWaits(): Promise<StatementLine[] | null> {
  let answer: Response

  try {
    answer = await fetch(STATEMENT_LINES)
  } catch {
    return null
  }

  if (!answer.ok) {
    return null
  }

  try {
    return linesIn(await answer.json())
  } catch {
    return null
  }
}

/** What a taking answered, narrowed by looking at it (ADL A14), or null when it is not one. */
export function takenIn(body: unknown): Taken | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const number: unknown = Reflect.get(body, 'number')
  const dated: unknown = Reflect.get(body, 'dated')
  const bookedNow: unknown = Reflect.get(body, 'bookedNow')
  const lines = linesIn(Reflect.get(body, 'lines'))

  if (typeof number !== 'number' || typeof dated !== 'string' || typeof bookedNow !== 'number') {
    return null
  }

  return lines === null ? null : { number, dated, bookedNow, lines }
}

/** A list of lines, every one of them looked at, or null when any one is not a line. */
export function linesIn(body: unknown): StatementLine[] | null {
  if (!Array.isArray(body)) {
    return null
  }

  const lines: StatementLine[] = []

  for (const one of body) {
    const line = lineIn(one)

    if (line === null) {
      return null
    }

    lines.push(line)
  }

  return lines
}

/** A field that must be a text, or null when it is not one. */
function text(body: object, name: string): string | null {
  const value: unknown = Reflect.get(body, name)

  return typeof value === 'string' ? value : null
}

/**
 * A field the statement may not have printed (the payer's account, the code, the reference), or the
 * member's number and town, which a member may not have: answered as null by the route and drawn as
 * nothing, so it is read as an empty text. Anything else that is not a text is no line at all.
 */
function textOrNothing(body: object, name: string): string | null {
  const value: unknown = Reflect.get(body, name)

  return value === null ? '' : text(body, name)
}

function lineIn(body: unknown): StatementLine | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const id: unknown = Reflect.get(body, 'id')
  const statement: unknown = Reflect.get(body, 'statement')
  const amount: unknown = Reflect.get(body, 'amount')
  const season: unknown = Reflect.get(body, 'season')
  const state: unknown = Reflect.get(body, 'state')
  const dated = text(body, 'dated')
  const payer = text(body, 'payer')
  const payerAccount = textOrNothing(body, 'payerAccount')
  const currency = text(body, 'currency')
  const paymentCode = textOrNothing(body, 'paymentCode')
  const purpose = text(body, 'purpose')
  const reference = textOrNothing(body, 'reference')
  const waitsBecause = textOrNothing(body, 'waitsBecause')
  const memberBody: unknown = Reflect.get(body, 'member')
  const member = memberBody === null ? null : candidateIn(memberBody)
  const candidatesBody: unknown = Reflect.get(body, 'candidates')

  if (
    typeof id !== 'number' ||
    typeof statement !== 'number' ||
    typeof amount !== 'number' ||
    typeof season !== 'number' ||
    (state !== 'booked' && state !== 'alreadyRecorded' && state !== 'waiting') ||
    dated === null ||
    payer === null ||
    payerAccount === null ||
    currency === null ||
    paymentCode === null ||
    purpose === null ||
    reference === null ||
    waitsBecause === null ||
    (memberBody !== null && member === null) ||
    !Array.isArray(candidatesBody)
  ) {
    return null
  }

  const candidates: Candidate[] = []

  for (const one of candidatesBody) {
    const candidate = candidateIn(one)

    if (candidate === null) {
      return null
    }

    candidates.push(candidate)
  }

  return {
    id,
    dated,
    statement,
    payer,
    payerAccount,
    amount,
    currency,
    paymentCode,
    purpose,
    reference,
    season,
    state,
    member,
    candidates,
    waitsBecause,
  }
}

function candidateIn(body: unknown): Candidate | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const competitorId: unknown = Reflect.get(body, 'competitorId')
  const memberNumber = textOrNothing(body, 'memberNumber')
  const firstName = text(body, 'firstName')
  const lastName = text(body, 'lastName')
  const city = textOrNothing(body, 'city')

  if (
    typeof competitorId !== 'number' ||
    memberNumber === null ||
    firstName === null ||
    lastName === null ||
    city === null
  ) {
    return null
  }

  return { competitorId, memberNumber, firstName, lastName, city }
}
