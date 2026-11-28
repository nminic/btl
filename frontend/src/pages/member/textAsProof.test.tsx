import { screen, waitFor } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import en from '../../i18n/en.json'
import sr from '../../i18n/sr.json'
import { SLOW } from '../../test/slow'

/**
 * WORDS ALONE ARE A PROOF, on the form of a profile, on both roads it sends a run by (PDL P9, „Dokaz uz
 * rezultat": 09.10.2026, „tekst sam je dovoljan dokaz i bez slike"; 03.10.2026, „Ovo treba da vazi na svim
 * slanjima rezultata"; put into force 28.11.2026).
 *
 * <p>**Three roads, and each is held on the screen that meets it**: a new run away from the calendar (here), a
 * run sent back and sent again (here), and the correction of a counted one (`ownResult.test.tsx`). The form of
 * the event page is the other form (`event/reportResult.test.tsx`).
 *
 * <p>**Each case is stood on both sides of its own axis**: the comment with a word in it and the comment of
 * blanks, the box of the link empty and the box of the link filled. A comment taken from any other box (the
 * name of the event, the name of the race, the town, all of which are filled here) would let the cases
 * that expect a refusal through, and they are the ones that name the second source.
 */

const ME = '000007'
const NEW = '/sr/rezultat/novi'
const TODAY = '2027-08-23'
const SOON = { timeout: SLOW / 2 }

/** The server's list of this member's own runs, and every `POST /api/results` it was sent. */
function recording(mine?: unknown[]): { sent: () => Record<string, unknown>[]; stop: () => void } {
  const server = serverThat((path) =>
    mine !== undefined && path === '/api/me/result-submissions'
      ? new Response(JSON.stringify(mine), { status: 200, headers: { 'content-type': 'application/json' } })
      : null,
  )

  return {
    sent: () =>
      server.asked
        .filter((one) => one.path === '/api/results' && one.init?.method === 'POST')
        .map((one) => {
          const body: unknown = JSON.parse(String(one.init?.body ?? '{}'))

          return typeof body === 'object' && body !== null ? { ...body } : {}
        }),
    stop: server.stop,
  }
}

/** A run on an event he typed, with every box filled but the two that are about the proof. */
async function aRunWithNoProofYet(user: ReturnType<typeof setupUser>): Promise<void> {
  renderAt(NEW, 'competitor', ME, undefined, TODAY)
  await user.type(await screen.findByLabelText(/^Događaj/), 'Seoska trka')
  await user.type(screen.getByLabelText(/Datum trke/), '01082027')
  await user.type(screen.getByLabelText('Mesto'), 'Niš')
  await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
  await user.type(screen.getByLabelText(/^Dužina/), '10')
  await user.type(screen.getByLabelText(/Uspon/), '20')
  await user.type(screen.getByLabelText(/Spust/), '20')
  await user.type(screen.getByLabelText('Sati'), '0')
  await user.type(screen.getByLabelText('Minuti'), '45')
  await user.type(screen.getByLabelText('Sekunde'), '0')
}

const SEND = { name: 'Pošalji rezultat' }

describe('a new run, proved by words alone', () => {
  it('is sent with a comment and no link and no picture, and the request carries no address', async () => {
    const user = setupUser()
    const route = recording()

    try {
      await aRunWithNoProofYet(user)
      await user.type(screen.getByLabelText(/Komentar/), 'Sat je stao na 12. km, vreme je sa mog sata.')
      await user.click(screen.getByRole('button', SEND))
      await screen.findByRole('heading', { name: 'Rezultat je poslat' }, SOON)

      const sent = must(route.sent()[0], 'what was sent')

      expect(route.sent()).toHaveLength(1)
      expect(sent.link, 'an address was sent where words stood in for one').toBe('')
      expect(sent.comment).toBe('Sat je stao na 12. km, vreme je sa mog sata.')
    } finally {
      route.stop()
    }
  }, SLOW)

  it('is not asked for the link once there are words, and is again when they are blanks', async () => {
    const user = setupUser()
    const route = recording()

    try {
      await aRunWithNoProofYet(user)

      const link = screen.getByLabelText(/^Link/)

      expect(link, 'with nothing else the link is asked for').toBeRequired()

      await user.type(screen.getByLabelText(/Komentar/), '   ')
      expect(link, 'blanks let the link go').toBeRequired()

      await user.type(screen.getByLabelText(/Komentar/), 'Sat')
      expect(link, 'a word did not let the link go').not.toBeRequired()
    } finally {
      route.stop()
    }
  }, SLOW)

  it.each([
    ['nothing at all', ''],
    ['blanks', '    '],
  ])('is refused with %s in the comment and nothing else, and sends nothing', async (_, comment) => {
    const user = setupUser()
    const route = recording()

    try {
      await aRunWithNoProofYet(user)

      if (comment !== '') {
        await user.type(screen.getByLabelText(/Komentar/), comment)
      }

      await user.click(screen.getByRole('button', SEND))
      await waitFor(() => expect(screen.getByLabelText(/^Link/)).toHaveAttribute('aria-invalid', 'true'), SOON)

      expect(route.sent()).toEqual([])
    } finally {
      route.stop()
    }
  }, SLOW)

  it('is still refused for a link that is not an address, whatever the words beside it say', async () => {
    const user = setupUser()
    const route = recording()

    try {
      await aRunWithNoProofYet(user)
      await user.type(screen.getByLabelText(/^Link/), 'pogledaj kod mene')
      await user.type(screen.getByLabelText(/Komentar/), 'Sat je stao.')
      await user.click(screen.getByRole('button', SEND))
      await waitFor(() => expect(screen.getByLabelText(/^Link/)).toHaveAttribute('aria-invalid', 'true'), SOON)

      expect(route.sent()).toEqual([])
    } finally {
      route.stop()
    }
  }, SLOW)
})

/** A run a moderator sent back, in a season that is open, with no link in it and the words the case says. */
const sentBackWith = (comment: string) => ({
  id: 77,
  state: 'rejected',
  raceId: null,
  eventId: null,
  eventName: 'Seoska trka',
  eventKind: 'race',
  raceName: 'Trka za proveru',
  raceDate: '2027-05-10',
  raceKind: 'length',
  city: 'Niš',
  country: 'RS',
  distanceKm: 21.1,
  ascentM: 540,
  descentM: 540,
  seconds: 6730,
  link: '',
  comment,
  reason: 'Slika se ne vidi.',
  amendsResultId: null,
})

describe('a run sent back, sent again with words alone', () => {
  it('goes with the comment it came back with, and no link', async () => {
    const user = setupUser()
    const route = recording([sentBackWith('Sat je stao na 12. km.')])

    try {
      renderAt(`${NEW}?ponovo=77`, 'competitor', ME, undefined, TODAY)
      await screen.findByText(/Slika se ne vidi/, undefined, SOON)
      await user.click(screen.getByRole('button', SEND))
      await screen.findByRole('heading', { name: 'Rezultat je poslat' }, SOON)

      const sent = must(route.sent()[0], 'what was sent')

      expect(sent.link).toBe('')
      expect(sent.comment).toBe('Sat je stao na 12. km.')
    } finally {
      route.stop()
    }
  }, SLOW)

  it('is refused once the words are taken away, because then nothing is left to prove it', async () => {
    const user = setupUser()
    const route = recording([sentBackWith('Sat je stao na 12. km.')])

    try {
      renderAt(`${NEW}?ponovo=77`, 'competitor', ME, undefined, TODAY)
      await screen.findByText(/Slika se ne vidi/, undefined, SOON)
      await user.clear(screen.getByLabelText(/Komentar/))
      await user.click(screen.getByRole('button', SEND))
      await waitFor(() => expect(screen.getByLabelText(/^Link/)).toHaveAttribute('aria-invalid', 'true'), SOON)

      expect(route.sent()).toEqual([])
    } finally {
      route.stop()
    }
  }, SLOW)
})

describe('the sentences said when none of the three proofs came', () => {
  it('is, in Serbian, the owner\'s sentence of 28.11.2026 and nothing near it', () => {
    /* „Nedostaje dokaz. Upiši link ka zvaničnim rezultatima, priloži sliku ili u komentaru napiši odakle
       je rezultat." (PDL P9, „Slika kao dokaz uz rezultat, posle izgradnje": the owner chose it among the
       offered). The dictionary and its snapshot are held to each other elsewhere, which would let the
       two be changed together; this holds the words themselves. */
    expect(sr.results.refused.nothingShowsItHappened).toBe(
      'Nedostaje dokaz. Upiši link ka zvaničnim rezultatima, priloži sliku ili u komentaru napiši odakle je rezultat.',
    )
  })

  it.each([
    ['Serbian', sr.results.refused.nothingShowsItHappened, sr.newResult.needsProof, ['link', 'slik', 'komentar']],
    ['English', en.results.refused.nothingShowsItHappened, en.newResult.needsProof, ['link', 'picture', 'comment']],
  ])('names all three ways of proving a run, in %s, on the server\'s refusal and on the correction\'s', (_, refused, correcting, three) => {
    for (const word of three) {
      expect(refused.toLowerCase(), `the refusal does not name ${word}`).toContain(word)
      expect(correcting.toLowerCase(), `the correction's sentence does not name ${word}`).toContain(word)
    }
  })
})

describe('the hint under the link box', () => {
  it('is, in Serbian, the owner\'s sentence of 28.11.2026, which lets the comment stand in for the link as the picture does', () => {
    /* „Obavezno, osim ukoliko prilažete slike rezultata / aplikacije kao dokaz ili u komentaru napišete
       odakle je rezultat." (PDL P9, 28.11.2026). One key serves both forms (`newResult.linkHint`). The
       dictionary and its snapshot are held to each other elsewhere, which lets the two be changed
       together; this holds the words themselves. */
    expect(sr.newResult.linkHint).toBe(
      'Obavezno, osim ukoliko prilažete slike rezultata / aplikacije kao dokaz ili u komentaru napišete odakle je rezultat.',
    )
  })

  it('names the comment in English as well', () => {
    expect(en.newResult.linkHint.toLowerCase()).toContain('comment')
  })
})
