import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import sr from '../../i18n/sr.json'
import { serverThat } from '../../test/serverAnswers'
import {
  linesIn,
  setAsideAt,
  STATEMENT_LINES,
  statementToSend,
  takenIn,
  whatWaits,
  WHY_IT_WAITS,
} from './statement'

/**
 * WHAT THE PAYMENTS SCREEN READS OFF `StatementApi`, narrowed by looking at it (ADL A14), and the one
 * map that has a second home on the server.
 */

const WEB = join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web')

/** A line as the route answers it, every field present. */
function aLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    dated: '2027-10-23',
    statement: 1,
    position: 1,
    payer: 'DUŠKO KUNIĆ, ULICA 1, BEOGRAD',
    payerAccount: '200-0000000000001-11',
    amount: 4200.0,
    currency: 'RSD',
    paymentCode: '289',
    purpose: 'Članarina za 2027. godinu',
    reference: null,
    season: 2028,
    state: 'waiting',
    member: null,
    candidates: [
      { competitorId: 4, memberNumber: '000004', firstName: 'Duško', lastName: 'Kunić', city: 'Beograd' },
      { competitorId: 5, memberNumber: null, firstName: 'Duško', lastName: 'Kunić', city: null },
    ],
    waitsBecause: 'noReference',
    ...overrides,
  }
}

function resolve(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (typeof node === 'object' && node !== null ? Reflect.get(node, part) : undefined),
    dictionary,
  )
}

describe('why a payment on a statement waits', () => {
  it('is answered for every word WhyALineWaits.java declares, and for no other', () => {
    const java = readFileSync(join(WEB, 'WhyALineWaits.java'), 'utf-8')
    const declared = [...java.matchAll(/static final String \w+\s*=\s*"([^"]+)";/g)].map(
      (one) => one[1] ?? '',
    )

    expect(declared, 'the class names no reason, so this measures nothing').toHaveLength(6)
    expect(Object.keys(WHY_IT_WAITS).sort()).toEqual([...declared].sort())
  })

  it('with a sentence in both dictionaries', () => {
    for (const key of Object.values(WHY_IT_WAITS)) {
      expect(typeof resolve(sr, key), key).toBe('string')
      expect(typeof resolve(en, key), key).toBe('string')
    }
  })
})

describe('a line of a statement', () => {
  it('is read whole, with what the statement left out read as nothing', () => {
    expect(linesIn([aLine()])).toEqual([
      {
        id: 7,
        dated: '2027-10-23',
        statement: 1,
        payer: 'DUŠKO KUNIĆ, ULICA 1, BEOGRAD',
        payerAccount: '200-0000000000001-11',
        amount: 4200,
        currency: 'RSD',
        paymentCode: '289',
        purpose: 'Članarina za 2027. godinu',
        reference: '',
        season: 2028,
        state: 'waiting',
        member: null,
        candidates: [
          { competitorId: 4, memberNumber: '000004', firstName: 'Duško', lastName: 'Kunić', city: 'Beograd' },
          { competitorId: 5, memberNumber: '', firstName: 'Duško', lastName: 'Kunić', city: '' },
        ],
        waitsBecause: 'noReference',
      },
    ])
  })

  it('may be set aside, at an address of its own', () => {
    expect(linesIn([aLine({ state: 'setAside', candidates: [], waitsBecause: null })])?.[0]?.state).toBe('setAside')
    expect(setAsideAt(7)).toBe('/api/statements/lines/7/set-aside')
  })

  it('carries the member it was booked to', () => {
    const booked = linesIn([
      aLine({
        state: 'booked',
        candidates: [],
        waitsBecause: null,
        member: { competitorId: 4, memberNumber: '000004', firstName: 'D', lastName: 'K', city: 'B' },
      }),
    ])

    expect(booked?.[0]?.member?.competitorId).toBe(4)
    expect(booked?.[0]?.state).toBe('booked')
  })

  it.each([
    ['an id that is not a number', { id: '7' }],
    ['a state nobody named', { state: 'lost' }],
    ['an amount that is text', { amount: '4200.00' }],
    ['no payer', { payer: undefined }],
    ['a payer that is not text', { payer: 5 }],
    ['a reference that is a number', { reference: 2028000004 }],
    ['candidates that are not a list', { candidates: {} }],
    ['a candidate that is not one', { candidates: [{ competitorId: 'x' }] }],
    ['a member that is not one', { member: { competitorId: 4 } }],
    ['no season', { season: undefined }],
    ['no statement number', { statement: null }],
  ])('is not a line with %s, and nor is the list it stands in', (_what, broken) => {
    expect(linesIn([aLine(), aLine(broken)])).toBeNull()
  })

  it('is not a list when the answer is not one', () => {
    expect(linesIn({ lines: [] })).toBeNull()
    expect(linesIn(null)).toBeNull()
    expect(linesIn([null])).toBeNull()
  })
})

describe('what taking a statement answered', () => {
  it('is its number, its day, how many it booked and its lines', () => {
    expect(takenIn({ number: 12, dated: '2027-10-23', bookedNow: 1, lines: [aLine()] })).toMatchObject({
      number: 12,
      dated: '2027-10-23',
      bookedNow: 1,
      lines: [{ id: 7 }],
    })
  })

  it.each([
    ['nothing', null],
    ['a text', 'izvod'],
    ['no number', { dated: '2027-10-23', bookedNow: 0, lines: [] }],
    ['no day', { number: 1, bookedNow: 0, lines: [] }],
    ['no count', { number: 1, dated: '2027-10-23', lines: [] }],
    ['lines that are not', { number: 1, dated: '2027-10-23', bookedNow: 0, lines: [{}] }],
  ])('is nothing for %s', (_what, body) => {
    expect(takenIn(body)).toBeNull()
  })
})

describe('the payments that wait', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
  })

  it('are read off the route', async () => {
    const server = serverThat((path) =>
      path === STATEMENT_LINES
        ? new Response(JSON.stringify([aLine()]), { headers: { 'content-type': 'application/json' } })
        : null,
    )
    stop = server.stop

    expect((await whatWaits())?.map((one) => one.id)).toEqual([7])
    expect(server.asked.map((one) => one.path)).toContain(STATEMENT_LINES)
  })

  it.each([
    ['a refusal', () => new Response(null, { status: 404 })],
    ['a body that is not JSON', () => new Response('nije JSON', { status: 200 })],
    ['a body that is not lines', () => new Response(JSON.stringify({}), { status: 200 })],
  ])('are nothing at all for %s', async (_what, answer) => {
    stop = serverThat((path) => (path === STATEMENT_LINES ? answer() : null)).stop

    expect(await whatWaits()).toBeNull()
  })

  it('are nothing at all when the server cannot be reached', async () => {
    stop = serverThat((path) => (path === STATEMENT_LINES ? Promise.reject(new Error('down')) : null)).stop

    expect(await whatWaits()).toBeNull()
  })
})

describe('the file sent', () => {
  it('is one part named statement, the name the route reads', () => {
    const file = new File(['%PDF-1.4'], 'izvod.pdf', { type: 'application/pdf' })
    const sent = statementToSend(file)

    const part = sent.get('statement')

    expect([...sent.keys()]).toEqual(['statement'])
    expect(part instanceof File ? part.name : null).toBe(file.name)
  })
})
