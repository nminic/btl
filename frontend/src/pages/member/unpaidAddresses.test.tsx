import { act, configure, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BEHIND, BEHIND_DAY, DAY, PUBLIC } from '../../test/addresses'
import { neverPaidAsServed } from '../../test/neverPaid'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'

/**
 * EVERY ADDRESS THE PORTAL ANSWERS, READ AS SOMEBODY WHO REGISTERED AND HAS NOT PAID: the ones he may
 * not open send him to the page he pays on, and the ones he may open do not link to the ones he may
 * not.
 *
 * <p>Owner, 22.10.2026 (PDL, „Član koji još nije platio: bez reči nalog, samo Članarina"): „Sve opcije
 * koje mu nisu dostupne privremeno (dakle sve osim Članarine) ne treba da mu uopšte budu dostupne",
 * and „Kad kažem dostupne, mislim vidljive niti deep linkom dostupne." And, chosen between offered
 * outcomes with the recommendation: „Direktna adresa strane koja mu nije otvorena preusmerava na
 * Članarinu (ne otkriva da strana postoji)."
 *
 * <p><b>Read from the same table every other walk of the portal reads</b> (`test/addresses.ts`), so
 * that an address added to the portal is an address asked of him too, and not one somebody remembered.
 * Which of them are his is DERIVED from what a visitor is told at each (a sentence that asks him to
 * sign in marks a screen of the member area; the front page at an address that is not the front page
 * marks a door that is shut to him), and then held against a list written by hand, so that a new
 * address is a decision about him and not a default: the floor fails on the day there is a row it has
 * no opinion about.
 *
 * <p>Every wait is given half of the time a case has, so a wait that never succeeds ends the case in
 * an assertion and not in its own clock.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

const FEE = '/sr/moja-clanarina'

/** The two pages that are his, and that no address may send him away from. */
const HIS = [FEE, '/sr/moji-podaci']

const SIGN_IN_SENTENCE = 'Za ovo treba prijava'
const FRONT_PAGE = 'Balkanska trkačka liga'

/** The path of an address, without the query a walk puts on it. */
const pathOf = (address: string): string => address.split('?')[0] ?? address

/**
 * Whether an address is shut to him, worked out from what a visitor is told at it.
 *
 * <p>The sign in sentence marks a screen of the member area, and the front page where it is not the
 * front page marks a door the portal sends the reader who may not open it through (`Guard`, the card
 * „Podaci"). The two that are his are the exceptions the list above names.
 */
function shutToHim(row: (typeof PUBLIC)[number]): boolean {
  const [address, asVisitor] = row

  if (HIS.includes(pathOf(address))) {
    return false
  }

  return asVisitor === SIGN_IN_SENTENCE || (asVisitor === FRONT_PAGE && pathOf(address) !== '/sr')
}

/** Written by hand, and held against the derivation: a new address has to be decided about. */
const SHUT_TO_HIM = [
  '/sr/kalendar/fruskogorski-maraton-2010/ocena',
  '/sr/kalendar/fruskogorski-maraton-2010/prijava',
  '/sr/kalendar/fruskogorski-maraton-2010/rezultati',
  '/sr/takmicar/000021/podaci',
  '/sr/novi-tim',
  '/sr/tim/dunavski-trkaci/izmena',
  '/sr/moj-profil',
  '/sr/moji-rezultati',
  '/sr/podesavanja',
  '/sr/poruke',
  '/sr/poruke/41',
  '/sr/rezultat/novi',
]

const SHUT_PUBLIC = PUBLIC.filter(shutToHim)
const OPEN_PUBLIC = PUBLIC.filter((row) => !shutToHim(row))

/** The administrative screens and the two forms of the member area that are shut to the walks above. */
const SHUT_BEHIND = BEHIND.map(([address]) => address)

describe('which addresses are shut to somebody who has not paid', () => {
  it('are the ones written down, and a new address has to be decided about', () => {
    expect(SHUT_PUBLIC.map(([address]) => pathOf(address))).toEqual(SHUT_TO_HIM)
  })

  it('are all of administration and the forms of a team, and the league\'s entry of results', () => {
    expect(SHUT_BEHIND).toHaveLength(BEHIND.length)
    expect(BEHIND.map(([address]) => pathOf(address)).filter((one) => one.includes('/administracija')))
      .toHaveLength(16)
  })

  it('leave his two pages and the public ones open, and there are public ones', () => {
    for (const mine of HIS) {
      expect(OPEN_PUBLIC.map(([address]) => pathOf(address))).toContain(mine)
    }

    expect(OPEN_PUBLIC.length).toBeGreaterThan(HIS.length)
  })
})

describe('an address that is shut to somebody who has not paid', () => {
  it.each(SHUT_PUBLIC.map(([address]) => address))(
    'sends him from %s to the page he pays on, replacing the address and drawing nothing of its own',
    async (address) => {
      const { stop } = neverPaidAsServed()
      stops.push(stop)

      const { router } = renderAt(address, 'visitor', null, undefined, DAY)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(FEE)
      })
      expect(router.state.historyAction).toBe('REPLACE')
      expect(await screen.findByRole('heading', { level: 1, name: 'Moja članarina' })).toBeVisible()
    },
    SLOW,
  )

  it.each(SHUT_BEHIND)(
    'sends him from %s to the page he pays on as well, and not to the front page',
    async (address) => {
      const { stop } = neverPaidAsServed()
      stops.push(stop)

      const { router } = renderAt(address, 'visitor', null, undefined, BEHIND_DAY)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(FEE)
      })
      expect(router.state.historyAction).toBe('REPLACE')
    },
    SLOW,
  )

  it('sends everybody else from an address that is shut to him where it always sent them', async () => {
    /* The other side of the cases above: a member whose fee stands, opening the league's entry of
       results he may not open, is sent to the front page, as before. A door that sent EVERYBODY to the
       page he pays on would pass every case above. */
    const { router } = renderAt('/sr/administracija', 'competitor', '000001', undefined, BEHIND_DAY)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
  }, SLOW)
})

/**
 * What an address leads to, as the pages he may open link to it: the address of a screen that is shut
 * to him, in any of its spellings.
 */
const LEADS_TO_A_SHUT_DOOR = [
  /^\/sr\/(moj-profil|moji-rezultati|podesavanja|rezultat\/novi|novi-tim)$/,
  /^\/sr\/poruke(\/[^/]+)?$/,
  /^\/sr\/administracija(\/.*)?$/,
  /^\/sr\/kalendar\/[^/]+\/(prijava|ocena|rezultati)$/,
  /^\/sr\/tim\/[^/]+\/izmena$/,
  /^\/sr\/takmicar\/[^/]+\/podaci$/,
]

/** Everything the page links to, as the path of each address. */
function everyLinkOnTheScreen(): string[] {
  return [...document.querySelectorAll('a[href]')].map((one) =>
    pathOf(one.getAttribute('href') ?? ''),
  )
}

/** A few turns of the event loop, so what the screen was waiting on has been drawn. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let tick = 0; tick < 8; tick += 1) {
      await new Promise((settled) => {
        setTimeout(settled, 0)
      })
    }
  })
}

describe('a page that is open to somebody who has not paid', () => {
  it.each(OPEN_PUBLIC.map(([address, , , part]) => [address, part] as const))(
    'does not link to a screen that is shut to him: %s',
    async (address) => {
      const { stop } = neverPaidAsServed()
      stops.push(stop)

      renderAt(address, 'visitor', null, undefined, DAY)

      /* The page itself has drawn, and the header with his name in it: nothing is asserted about a
         screen that has not arrived, because an absence of links is true of every screen that has not. */
      await screen.findByRole('heading', { level: 1 })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Otvori moj meni' })).toHaveTextContent('TS')
      })
      await settle()

      const shut = everyLinkOnTheScreen().filter(
        (path) => LEADS_TO_A_SHUT_DOOR.some((pattern) => pattern.test(path)),
      )

      expect(shut).toEqual([])
    },
    SLOW,
  )
})
