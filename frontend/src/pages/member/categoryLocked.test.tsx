import { cleanup, configure, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clearResourceCache } from '../../data/client'
import { renderAt } from '../../test/render'
import { answeringCategory, refused, serverThat, type CategoryAnswered } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/**
 * THE CHOICE OF CATEGORY ON „MOJA ČLANARINA" SAYS EVERY WAY IT CAN FAIL, AND THE LOCK OF THE TRIAL PERIOD
 * AMONG THEM.
 *
 * <p>Owner, 23.10.2026 (`btl-produkt/PDL.md`): the message for a browser that forgot the trial password
 * „važi za svaki ekran koji upisuje [...] među njima izbor kategorije na „Moja članarina"". And 25.10.2026
 * (PDL, „Poruka o probnoj šifri na svakom ekranu koji upisuje: odgovori od 25.10.2026"): „Izbor kategorije
 * kaže svaki neuspeh, kao ostali ekrani (zaključavanje, istekla sesija, greška servera, „nije stiglo")".
 * Until then the box dropped all four and the radio went back with nothing said.
 *
 * <p><b>The words are written out here and not read from the dictionary</b>, for the reason
 * `account/theSiteIsLocked.test.tsx` gives: a case comparing the screen with `sr.server.locked` would
 * pass for any sentence at all.
 *
 * <p><b>The axes, counted.</b> The lock and the portal's own 401 are one number and two answers, so both
 * are asked. The sentence must stand in the box that was pressed and not elsewhere on the screen, which
 * has another write (leaving the team: 000013 is in Dunavski trkači). And it must go when the next press
 * goes through, or a sentence about the last press stands over this one.
 */

const ME = '000013'
const DAY = '2026-10-20'

const SENTENCE =
  'Pregledač je zaboravio pristupnu šifru za probni period. Otvori portal u novoj kartici i ukucaj je tamo, pa se vrati ovde i pošalji ponovo; ono što si upisao je i dalje tu.'

const OPEN = 'Otvori u novoj kartici'

/* Half of a case's clock for every wait (`pages/admin/saveWhileSaving.test.tsx`), so a sentence never
   drawn fails on the assertion and not as a case that ran out of time. */
configure({ asyncUtilTimeout: SLOW / 2 })

afterEach(() => {
  cleanup()
})

const AGE_BAND: CategoryAnswered = {
  season: 2027,
  firstSeason: false,
  firstSeasonAllowed: true,
  category: 'M40-54',
  open: true,
}

const BEGINNERS: CategoryAnswered = { ...AGE_BAND, firstSeason: true, category: 'M R' }

/** A 401 as the proxy gives it: no body, the challenge on it. */
const theProxy = () => new Response(null, { status: 401, headers: { 'www-authenticate': 'Basic realm="restricted"' } })

/** The server, answering the read of the box and each write in turn with what the case hands in. */
function serving(...writes: (() => Response | Promise<Response>)[]) {
  clearResourceCache()
  let next = 0

  return serverThat((path, init) => {
    if (path !== '/api/me/category') {
      return null
    }

    if (init?.method !== 'PUT') {
      return answeringCategory(AGE_BAND)
    }

    const answer = writes[Math.min(next, writes.length - 1)]

    next += 1

    return answer === undefined ? null : answer()
  })
}

/** Opens the screen and ticks the beginners' category, and answers the box that was pressed. */
async function pressed(): Promise<{ box: HTMLElement; user: ReturnType<typeof setupUser> }> {
  const user = setupUser()

  renderAt('/sr/moja-clanarina', 'competitor', ME, undefined, DAY)

  const box = await screen.findByRole('group', { name: /U kojoj kategoriji se takmičiš 2027/ })

  await user.click(within(box).getByRole('radio', { name: 'U početničkoj kategoriji' }))

  return { box, user }
}

describe('the choice of category, when the write does not go through', () => {
  it('says the site is locked, in the box that was pressed, with the way to a new tab', async () => {
    const server = serving(theProxy)

    try {
      const { box } = await pressed()

      expect(await within(box).findByRole('alert')).toHaveTextContent(SENTENCE)
      expect(within(box).getByRole('link', { name: OPEN })).toHaveAttribute('target', '_blank')
      /* Nothing changed, and the box says so by standing where it stood. */
      expect(within(box).getByRole('radio', { name: 'U svojoj starosnoj kategoriji' })).toBeChecked()
      /* And it is not said anywhere else on the screen, which has another write. */
      expect(screen.getAllByText(SENTENCE)).toHaveLength(1)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says the number and not the lock when the portal itself answered 401, which carries no challenge', async () => {
    const server = serving(() => new Response(null, { status: 401 }))

    try {
      const { box } = await pressed()

      expect(await within(box).findByRole('alert')).toHaveTextContent(
        'Server je odgovorio brojem 401 i ništa nije promenjeno. Pokušaj ponovo za koji minut.',
      )
      expect(screen.queryByText(SENTENCE)).not.toBeInTheDocument()
      expect(within(box).queryByRole('link', { name: OPEN })).not.toBeInTheDocument()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says an error of the server by its number', async () => {
    const server = serving(() => new Response(null, { status: 503 }))

    try {
      const { box } = await pressed()

      expect(await within(box).findByRole('alert')).toHaveTextContent(
        'Server je odgovorio brojem 503 i ništa nije promenjeno.',
      )
    } finally {
      server.stop()
    }
  }, SLOW)

  it('says so when no answer came at all', async () => {
    const server = serving(() => Promise.reject(new TypeError('Failed to fetch')))

    try {
      const { box } = await pressed()

      expect(await within(box).findByRole('alert')).toHaveTextContent(
        'Portal nije uspeo da dođe do servera. Proveri vezu i pokušaj ponovo.',
      )
    } finally {
      server.stop()
    }
  }, SLOW)

  it('keeps its own sentence for the refusal, and raises no alert beside it', async () => {
    const server = serving(() => refused('theChoiceIsShut', 409))

    try {
      const { box } = await pressed()

      expect(await within(box).findByText(/Izbor nije sačuvan, jer je rok istekao/)).toHaveAttribute('role', 'status')
      expect(within(box).queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      server.stop()
    }
  }, SLOW)

  it('takes the sentence away when the next press goes through', async () => {
    const server = serving(theProxy, () => answeringCategory(BEGINNERS))

    try {
      const { box, user } = await pressed()

      expect(await within(box).findByRole('alert')).toHaveTextContent(SENTENCE)

      await user.click(within(box).getByRole('radio', { name: 'U početničkoj kategoriji' }))

      expect(await within(box).findByText('U sezoni 2027 takmičiš se u kategoriji: Početnici')).toBeVisible()
      expect(screen.queryByText(SENTENCE)).not.toBeInTheDocument()
    } finally {
      server.stop()
    }
  }, SLOW)
})
