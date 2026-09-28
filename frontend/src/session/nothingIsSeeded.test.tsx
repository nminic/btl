import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setupUser } from '../test/user'
import { SessionProvider } from './SessionProvider'
import { useSession } from './useSession'
import type { SessionValue } from './context'

/**
 * A SESSION THAT HAS JUST BEEN MOUNTED HOLDS NO RECORDS AT ALL.
 *
 * <p><b>Why this exists, in the owner's own words.</b> On 28.09.2026 he opened the portal on
 * QA, pulled down „PORUKE" in the header, and found two messages nobody had sent him: „Dobro
 * došao u pripremu sezone 2027" and „Rezultat je odobren". „Zasto su ove testne poruke i dalje
 * tu?????? NECU MOCK PODATKE NIGDE" (PDL 34). They were the starting value of the provider's
 * `messages`, they came from `data/seedMessages.ts`, and they had been in every build the
 * portal ever shipped.
 *
 * <p><b>Taking them out is one commit; keeping them out is this file.</b> The seed was written
 * as „a record somebody will replace with a row", which is a sentence that reads as temporary
 * and behaves as permanent: it survived the arrival of `GET /api/inbox` by months, because
 * nothing ever asked whether it was still there. The next collection the provider grows can be
 * seeded the same way, by somebody who has read neither the decision nor this file.
 *
 * <h2>It asks about BEHAVIOUR and it carries no list</h2>
 *
 * <p>Not „is `data/seedMessages.ts` gone" - that is a question about one file, and a guard that
 * asks it passes the day the same two messages are written into some other module. Not a list
 * of the collections the session holds either: a list is finished by thinking about the list,
 * which this repository has measured to be impossible more than once.
 *
 * <p>What is asked is of the SESSION VALUE ITSELF: walk its own keys, and every one of them
 * that holds records must hold none. So a collection added tomorrow is inside this question the
 * day it is added, without anybody remembering to come here, and a seeded one fails the gate
 * instead of waiting to be found on QA.
 *
 * <h2>What „holds records" means, and the line is the owner's own</h2>
 *
 * <p>PDL 34 is about seeded RECORDS - „ni poruka, ni takmicar, ni rezultat" - and it says in as
 * many words what it does not touch: the code lists that are part of the product
 * (`data/countries.json`, the categories, the shapes of a race) and the DEFAULT SETTINGS, which
 * notifications are switched on. The session holds both kinds, so the sweep below has to tell
 * them apart without being told which is which:
 *
 * <ul>
 * <li>an ARRAY is a list of records here, in all nine cases the provider holds, so it must be
 * empty;</li>
 * <li>an OBJECT keyed by identity is the same thing written the other way (`corrected` is
 * `Record&lt;string, Result&gt;`), so it must be empty as well - unless what it maps to is a
 * PRIMITIVE, which is a setting and not a record. `notifications` maps a key to a boolean and
 * is exactly what the decision leaves alone; so is `going`, and so is `signedIn`, whose fields
 * are the two strings the caller is known by.</li>
 * </ul>
 *
 * <p><b>Where this stops, said rather than left to be found.</b> It reads one level. A record
 * seeded inside another record - a default object with a list buried in it - is not seen here,
 * and the reason it is not worth guarding today is that no value in the session has that shape:
 * every collection of records is a top-level key. The day one is nested, the sweep below is
 * where to deepen rather than a list to extend.
 */
type Seeded = { name: string; held: number }

/**
 * Every collection of records this value holds, with how many are in it.
 *
 * <p><b>The same function answers all four cases below, and that sharing is what proves the
 * sweep really reads</b> - the shape `data/mockNotServed.test.ts` uses to prove its own
 * recursion against a root known to nest a file. A sweep that had stopped recognising a
 * collection would answer „nothing is seeded" for the same reason a correct one does, and the
 * first case alone cannot tell those apart. The other three make the portal write one record of
 * each shape this function knows and require it to name them, so neither test below can be
 * deleted without a case going red.
 */
function whatIsHeldIn(value: SessionValue): Seeded[] {
  return Object.entries(value).flatMap(([name, held]): Seeded[] => {
    if (Array.isArray(held)) {
      return [{ name, held: held.length }]
    }

    /* Keyed by identity, which is a list of records written the other way round. A map whose
       values are primitives is a setting instead, which is the half PDL 34 leaves standing. */
    if (typeof held === 'object' && held !== null) {
      const values = Object.values(held)

      return values.some((one) => typeof one === 'object' && one !== null)
        ? [{ name, held: values.length }]
        : []
    }

    return []
  })
}

/** What the sweep answers about the session it is mounted in, read off the screen so that the
 *  question is asked of a session a component is really inside rather than of a value built by
 *  hand. The three buttons each put ONE record into a different shape of collection; the first
 *  case presses none of them. */
function Probe({ mine }: { mine: string }) {
  const value = useSession()

  return (
    <>
      <output data-testid="seeded">
        {whatIsHeldIn(value)
          .filter((one) => one.held > 0)
          .map((one) => `${one.name}:${String(one.held)}`)
          .join(',')}
      </output>
      <button
        type="button"
        onClick={() => {
          value.notify({
            from: 'Balkanska trkačka liga',
            to: mine,
            subject: 'Poruka koju je portal napisao',
            body: 'Ovo je napisao ekran, a ne paket.',
            date: '2026-09-28',
          })
        }}
      >
        napisi poruku
      </button>
      {/* AND A RECORD INTO THE OTHER SHAPE A COLLECTION TAKES HERE, keyed by identity rather
          than counted. Without it the second half of the rule above would be a half nothing
          exercises: every collection that is filled during a visit in the cases of this file
          would be an array, so deleting the map half would change no answer and nobody would
          hear of it. */}
      <button
        type="button"
        onClick={() => {
          value.edit('takmicar-1', 'firstName', 'Nešto')
        }}
      >
        izmeni zapis
      </button>
      {/* AND A LIST OF BARE IDENTITIES, which is the one shape only the FIRST half of the rule
          can see. Measured, not assumed: with the array test disabled, a list of records falls
          through to the map test and is named anyway, because the values of an array of objects
          are objects. `pairsBroken` is `number[]`, so its values are numbers and the map test
          says nothing about it - which makes this the case that holds the array half up. */}
      <button
        type="button"
        onClick={() => {
          value.breakPair(7)
        }}
      >
        raskini par
      </button>
    </>
  )
}

function whatTheSweepSays(): string {
  return screen.getByTestId('seeded').textContent ?? ''
}

describe('what the bundle puts into a session before anything happens', () => {
  it('puts nothing into it: every collection of records is empty on mount', () => {
    render(
      <SessionProvider initialMemberNumber="000007">
        <Probe mine="000007" />
      </SessionProvider>,
    )

    /* Named rather than counted, so that a failure says WHICH collection arrived seeded and how
       many records are in it. „NIGDE" is the owner's word and this is its whole reading: not
       „the inbox is empty" but „nothing the session holds was filled in by the build". */
    expect(whatTheSweepSays()).toBe('')
  })

  it('and the sweep above really looks, because the same one names a record the portal writes', async () => {
    const user = setupUser()

    render(
      <SessionProvider initialMemberNumber="000007">
        <Probe mine="000007" />
      </SessionProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'napisi poruku' }))

    /* One record, in the one collection that received it. This is the half that cannot be
       satisfied by a broken sweep: `whatIsHeldIn` answering `[]` for everything passes the case
       above and fails this one. */
    expect(whatTheSweepSays()).toBe('inbox:1')
  })

  it('and it sees a record keyed by identity too, which is the other shape one arrives in', async () => {
    const user = setupUser()

    render(
      <SessionProvider initialMemberNumber="000007">
        <Probe mine="000007" />
      </SessionProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'izmeni zapis' }))

    /* `edits` is `Record<string, Record<string, string>>`: a list of records written the other
       way round, and the half of the rule that tells such a map from a settings map like
       `notifications`, whose values are booleans. Without this case that half could be deleted
       and every other case here would answer exactly as it does now. */
    expect(whatTheSweepSays()).toBe('edits:1')
  })

  it('and a list of bare identities, which only the first half of the rule can see', async () => {
    const user = setupUser()

    render(
      <SessionProvider initialMemberNumber="000007">
        <Probe mine="000007" />
      </SessionProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'raskini par' }))

    /* `pairsBroken` is `number[]`. Measured with the array test switched off: a list of RECORDS
       is still named, because the map test reads the values of an array of objects and finds
       objects, so no case built on `inbox` could ever say the array half was doing anything.
       This one can: switch that half off and a list of numbers goes unseen. */
    expect(whatTheSweepSays()).toBe('pairsBroken:1')
  })
})
