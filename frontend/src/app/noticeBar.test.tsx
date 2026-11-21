import { configure, screen, waitFor } from '@testing-library/react'
import { SLOW } from '../test/slow'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { NOTICE_STORAGE_KEY } from './noticeBarFacts'
import { EXTRA_ADDRESSES, ROUTES } from './routes'

/* THE GOLD STRIP UNDER THE HEADER (owner, 21.11.2026, PDL „Zlatna traka obaveštenja ispod zaglavlja, do
 * početka prve sezone"). Reached by role and by name, which is how a reader reaches it.
 *
 * The days are the ones the owner's sentence is about: `BEFORE` is a day on which the warm-up is shown,
 * `LAST_DAY` is the last one, and `FIRST_DAY` is the first on which „počinje 1. januara" would be false.
 * Every case that is about the strip being there asks for a day on which it should be, and every case about
 * it being gone asks for the one after, so a condition read off any other clock fails one of the two. */

/* Every wait of this file is given half of the time a case has, so a wait that never succeeds ends the case with the
   assertion's own words and not with the case's clock (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

const BEFORE = '2026-11-21'
const LAST_DAY = '2026-12-31'
const FIRST_DAY = '2027-01-01'

const NOTE = { name: 'Obaveštenje' }
const CLOSE = { name: 'Zatvori obaveštenje' }

/** The sentence the owner approved, word for word (PDL 21.11.2026, „Tekst"). Written out here and not read
 *  from the dictionary, so a changed word in the dictionary is a failing case and not a quiet edit. */
const SENTENCE =
  'Trenutno prikazani podaci su istorijski podaci članova, prikazani zabave radi. ' +
  'Zvanična sezona počinje 1. januara u ponoć: tada brojači i poredak kreću od nule za sve, ' +
  'a ono što je ranije istrčano ostaje na profilima.'

/** The screens the strip stands on, as addresses a reader types: the front page, the Top lists and the three
 *  cards of the BTL tables (Muškarci and Žene at `tabela`, Timovi at `timovi`; owner, 21.11.2026). */
const STANDS_ON = ['/sr', '/sr/top-liste', '/sr/tabela', '/sr/timovi']

/** The same, as the part of the address after the language: written out here and not read from
 *  `NOTICE_SHOWN_ON`, which a list asked about itself could only agree with. */
const WHERE_IT_STANDS: readonly string[] = ['', 'top-liste', 'tabela', 'timovi']

afterEach(() => {
  vi.restoreAllMocks()
})

/** A browser that has been told to keep no site data refuses the strip's own note, and only that: the theme
 *  and the rest of the portal read the same store and are not what is being measured. */
function refuseTheNote(key: string): void {
  if (key === NOTICE_STORAGE_KEY) {
    throw new Error('site data is blocked')
  }
}

function refuseReading() {
  const original = Storage.prototype.getItem

  return vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    refuseTheNote(key)

    return original.call(this, key)
  })
}

function refuseWriting() {
  const original = Storage.prototype.setItem

  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    refuseTheNote(key)

    original.call(this, key, value)
  })
}

function refuseRemoving() {
  const original = Storage.prototype.removeItem

  return vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
    refuseTheNote(key)

    original.call(this, key)
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe('where the strip stands', { timeout: SLOW }, () => {
  it.each(STANDS_ON)('stands under the header on %s, with the owner\'s sentence', async (address) => {
    renderAt(address, 'visitor', null, undefined, BEFORE)

    const note = await screen.findByRole('note', NOTE)

    expect(note).toHaveTextContent(SENTENCE)
    expect(screen.getByRole('button', CLOSE)).toBeVisible()
  })

  it('is written the same way in whatever case and with whatever trailing slash the address is typed', async () => {
    renderAt('/sr/TABELA/', 'visitor', null, undefined, BEFORE)

    expect(await screen.findByRole('note', NOTE)).toBeVisible()
  })

  it('is there for a member who has signed in as well, not for visitors alone', async () => {
    renderAt('/sr', 'competitor', '000007', undefined, BEFORE)

    expect(await screen.findByRole('note', NOTE)).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()
  })

  it('is a note and not a landmark, so it adds nothing to the regions a reader counts', async () => {
    renderAt('/sr', 'visitor', null, undefined, BEFORE)

    const note = await screen.findByRole('note', NOTE)

    expect(screen.queryByRole('region', NOTE)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    /* The last thing in the header, after its bar and navigation, and not in the main content: axe's `region`
       rule asks for all content to be inside a landmark (`pages/accessibility.test.tsx`), and the page has to
       begin with its heading in `main` (`test/met.ts`, `pages/publicData.test.tsx`). */
    expect(note.parentElement).toBe(screen.getByRole('banner'))
    expect(note.parentElement?.lastElementChild).toBe(note)
    expect(screen.getByRole('main')).not.toContainElement(note)
  })

  /* THE FLOOR, asked of the router rather than written out. Every address the portal has without a
     parameter is opened, and the strip is on exactly the screens the owner named: the front page, the Top
     lists and the three cards of the BTL tables. Another screen that comes to carry it, or the teams (the
     third card) dropping out and moving the cards by the height of the strip when one is pressed, is a
     failing case here and not a surprise on the screen. */
  it('is on the screens named, the teams as the third card among them, and on no other address the portal has', async () => {
    const addresses = [...ROUTES, ...EXTRA_ADDRESSES].map((route) => route.path).filter((path) => !path.includes(':'))

    expect(addresses.length).toBeGreaterThan(20)
    expect(addresses, 'the named ones are among the addresses opened').toEqual(
      expect.arrayContaining([...WHERE_IT_STANDS]),
    )

    for (const address of addresses) {
      const { unmount } = renderAt(`/sr/${address}`, 'visitor', null, undefined, BEFORE)

      await screen.findByRole('main')

      const shown = screen.queryByRole('note', NOTE) !== null

      expect(shown, `/sr/${address}`).toBe(WHERE_IT_STANDS.includes(address))
      unmount()
    }
  }, 120_000)
})

describe('how long the strip lasts', { timeout: SLOW }, () => {
  it('is still there on the last day of the warm-up', async () => {
    renderAt('/sr', 'visitor', null, undefined, LAST_DAY)

    expect(await screen.findByRole('note', NOTE)).toBeVisible()
  })

  it('is gone on 1 January 2027, the day the sentence „počinje 1. januara" stops being true', async () => {
    renderAt('/sr', 'visitor', null, undefined, FIRST_DAY)

    await screen.findByRole('main')

    expect(screen.queryByRole('note', NOTE)).toBeNull()
    expect(screen.queryByRole('button', CLOSE)).toBeNull()
  })

  it('goes with the warm-up on every screen it stood on', async () => {
    for (const address of STANDS_ON) {
      const { unmount } = renderAt(address, 'visitor', null, undefined, FIRST_DAY)

      await screen.findByRole('main')

      expect(screen.queryByRole('note', NOTE), address).toBeNull()
      unmount()
    }
  })

  it('takes its note out of the browser once it is gone, so no record of it outlives it', async () => {
    localStorage.setItem(NOTICE_STORAGE_KEY, 'closed')

    renderAt('/sr', 'visitor', null, undefined, FIRST_DAY)

    await waitFor(() => expect(localStorage.getItem(NOTICE_STORAGE_KEY)).toBeNull())
  })

  it('leaves the note alone while the strip is still on', async () => {
    localStorage.setItem(NOTICE_STORAGE_KEY, 'closed')

    renderAt('/sr', 'visitor', null, undefined, LAST_DAY)

    await screen.findByRole('main')

    expect(localStorage.getItem(NOTICE_STORAGE_KEY)).toBe('closed')
  })

  it('does not stop the portal when the browser will not let the note be taken out', async () => {
    const remove = refuseRemoving()

    renderAt('/sr', 'visitor', null, undefined, FIRST_DAY)

    await screen.findByRole('main')

    expect(remove).toHaveBeenCalled()
    expect(screen.queryByRole('note', NOTE)).toBeNull()
  })
})

describe('closing it', { timeout: SLOW }, () => {
  it('takes the strip away, writes one note in the browser, and puts the focus on the main content', async () => {
    const user = setupUser()

    renderAt('/sr', 'visitor', null, undefined, BEFORE)

    await user.click(await screen.findByRole('button', CLOSE))

    expect(screen.queryByRole('note', NOTE)).toBeNull()
    expect(screen.queryByRole('button', CLOSE)).toBeNull()
    expect(NOTICE_STORAGE_KEY).toBe('btl-notice-closed')
    expect(localStorage.getItem(NOTICE_STORAGE_KEY)).not.toBeNull()
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('closes from the keyboard, with Enter on the button', async () => {
    const user = setupUser()

    renderAt('/sr', 'visitor', null, undefined, BEFORE)

    const button = await screen.findByRole('button', CLOSE)

    button.focus()
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('note', NOTE)).toBeNull()
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('stays closed on the next screen the strip would stand on, in the same visit', async () => {
    const user = setupUser()

    renderAt('/sr', 'visitor', null, undefined, BEFORE)

    await user.click(await screen.findByRole('button', CLOSE))
    await user.click(screen.getByRole('link', { name: 'Top liste' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Top liste' })).toBeVisible()
    expect(screen.queryByRole('note', NOTE)).toBeNull()
  })

  it('stays closed on a later visit, on any of the screens it stands on, until the warm-up ends', async () => {
    const user = setupUser()
    const first = renderAt('/sr', 'visitor', null, undefined, BEFORE)

    await user.click(await screen.findByRole('button', CLOSE))
    first.unmount()

    for (const address of STANDS_ON) {
      const { unmount } = renderAt(address, 'visitor', null, undefined, LAST_DAY)

      await screen.findByRole('main')

      expect(screen.queryByRole('note', NOTE), address).toBeNull()
      unmount()
    }
  })

  /* WHERE THE NOTE IS KEPT IS NOT A PER-LANGUAGE FACT: one strip, one cross. A key that carried the
     language would let the Serbian visit close it and the English one see it again. */
  it('is closed for both languages at once', async () => {
    const user = setupUser()
    const first = renderAt('/sr', 'visitor', null, undefined, BEFORE)

    await user.click(await screen.findByRole('button', CLOSE))
    first.unmount()

    renderAt('/en', 'visitor', null, undefined, BEFORE)

    await screen.findByRole('main')

    expect(screen.queryByRole('note', { name: 'Notice' })).toBeNull()
  })

  it('has its own words in English', async () => {
    renderAt('/en', 'visitor', null, undefined, BEFORE)

    const note = await screen.findByRole('note', { name: 'Notice' })

    expect(note).toHaveTextContent(/^The data shown at the moment are the historical data of members/)
    expect(screen.getByRole('button', { name: 'Close the notice' })).toBeVisible()
  })

  it('stands on the teams in English as well, the third card of the tables', async () => {
    renderAt('/en/timovi', 'visitor', null, undefined, BEFORE)

    expect(await screen.findByRole('note', { name: 'Notice' })).toBeVisible()
  })

  it('still closes for the visit when the browser keeps nothing, and still opens when it cannot be read', async () => {
    const user = setupUser()

    refuseReading()
    refuseWriting()

    renderAt('/sr', 'visitor', null, undefined, BEFORE)

    await user.click(await screen.findByRole('button', CLOSE))

    expect(screen.queryByRole('note', NOTE)).toBeNull()
    expect(screen.getByRole('main')).toHaveFocus()
  })
})
