import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clearResourceCache } from '../../data/client'
import sr from '../../i18n/sr.json'
import { inputElement } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { aCompetitor, myOwnRecordFromMe } from '../../test/theAnswer'
import { setupUser } from '../../test/user'

/**
 * WHAT A MEMBER SAVES ON HIS PROFILE IS THERE AFTER A REFRESH: THE SWITCH THAT HIDES IT AND THE WORDS
 * ABOUT HIMSELF.
 *
 * <p>Owner, 18.10.2026: „kad popravis adresu i telefon, budi siguran da se cuvaju i ostala polja, tipa
 * opis, slika i sl." The address and the telephone were stored and never read back, and the question
 * this file asks of the two fields beside them is the same one: save, tear the screen down as a refresh
 * does (`cleanup`, and the visit's cached lists with it), draw it again, and the box must hold what the
 * SERVER kept.
 *
 * <p><b>The server here keeps what it is told</b> and answers a later read out of the same place, so
 * the second screen can show what it shows only if it asked. The two sources of one value are the
 * session of the visit that saved (an overlay the panel writes to) and the list the server serves, and
 * they are told apart by tearing down everything that is held in memory in between.
 *
 * <p><b>The words that WAIT for a moderator are drawn after a refresh</b> (PDL P11, owner, 18.10.2026: „Dok
 * tekst o sebi čeka odobrenje, član ga vidi u Podešavanjima sa oznakom da čeka i može da ga ispravi pre
 * odluke; na profilu se do odobrenja vidi stari, odobren tekst"). This file held the opposite until that
 * day - after a refresh the box carried the words that STAND and a text that waited was not shown - and
 * that was the boundary measured and written down, not a decision. It is the decision now, so the cases
 * below hold both halves: the box and the mark carry the words that wait, and the profile carries the
 * words that stand, until somebody decides.
 */

const ME = '000009'
const HIM = { ...aCompetitor, memberNumber: ME, firstName: 'Strahinja', lastName: 'Vukićević' }
const SOMEBODY_ELSE = { ...aCompetitor, memberNumber: '000002', firstName: 'Relja', bio: 'Tuđa biografija.' }

function json(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function bodyOf(init: RequestInit | undefined): unknown {
  return JSON.parse(String(init?.body ?? '{}'))
}

/**
 * THE LIST AND THE WRITE OF ONE MEMBER'S PROFILE, kept in one place.
 *
 * <p>`PUT /api/me` answers `Changed` (`MeWriteApi`): the flag as the row now holds it, the text that
 * STANDS on the profile (never the one just sent) and the key of a text of his that waits. A text sent
 * is queued and the profile keeps the approved words; an empty one removes what stands, at once (PDL
 * P11, 19.09.2026).
 */
function aServerThatKeepsTheProfile(opening: { hidden: boolean; bio: string }): {
  asked: Asked[]
  stop: () => void
  held: () => { hidden: boolean; bio: string; waiting: string | null }
  decide: (approved: boolean) => void
} {
  let hidden = opening.hidden
  let bio = opening.bio
  let waiting: string | null = null

  const { asked, stop } = serverThat((path, init) => {
    if (path === '/api/competitors') {
      return json([SOMEBODY_ELSE, { ...HIM, profileHidden: hidden, bio }])
    }

    if (path === '/api/me' && init?.method === undefined) {
      const withoutTheTemplatesOwn = Object.fromEntries(
        Object.entries(myOwnRecordFromMe).filter(([name]) => name !== 'bioWaiting'),
      )

      return json({
        role: 'competitor',
        account: 1,
        member: {
          ...withoutTheTemplatesOwn,
          memberNumber: ME,
          firstName: HIM.firstName,
          lastName: HIM.lastName,
          gender: HIM.gender,
          city: HIM.city,
          ageBand: HIM.ageBand,
          firstSeason2027: HIM.firstSeason2027,
          profileHidden: hidden,
          bio,
          ...(waiting === null ? {} : { bioWaiting: waiting }),
        },
        mailLanguage: 'sr',
      })
    }

    if (path === '/api/me' && init?.method === 'PUT') {
      const said = bodyOf(init)
      const profileHidden: unknown = typeof said === 'object' && said !== null ? Reflect.get(said, 'profileHidden') : undefined
      const text: unknown = typeof said === 'object' && said !== null ? Reflect.get(said, 'bio') : undefined

      if (typeof profileHidden === 'boolean') {
        hidden = profileHidden
      }

      if (typeof text === 'string') {
        if (text.trim() === '') {
          bio = ''
        } else {
          waiting = text.trim()
        }
      }

      return json({ profileHidden: hidden, bio, waiting: waiting === null ? null : 5 })
    }

    return null
  })

  return {
    asked,
    stop,
    held: () => ({ hidden, bio, waiting }),
    /* A MODERATOR DECIDING THE ROW, which is another browser's act: approved, the words that waited
       are what stands; refused, nothing waits and what stood still stands. */
    decide: (approved) => {
      if (approved && waiting !== null) {
        bio = waiting
      }

      waiting = null
    },
  }
}

/** A refresh: nothing of the old screen survives, and neither does anything the visit had fetched. */
function refresh(): void {
  cleanup()
  clearResourceCache()
}

describe('the switch that hides a profile', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
    clearResourceCache()
    cleanup()
  })

  const theBox = async () =>
    inputElement(
      within(await screen.findByRole('region', { name: 'Privatnost' })).getByLabelText(
        'Sakrij moj profil od svakoga ko nije aktivan član ni administracija',
      ),
    )

  /**
   * <p><b>Both directions of the one switch.</b> Ticked, saved, refreshed: ticked. Unticked, saved,
   * refreshed: unticked. A screen that only ever remembered "on" passes the first and fails the
   * second, and the second is the one nobody would think to press.
   */
  it('stays as it was saved after a refresh, ticked and then unticked', async () => {
    const user = setupUser()

    clearResourceCache()

    const server = aServerThatKeepsTheProfile({ hidden: false, bio: '' })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', ME)

    await user.click(await theBox())
    await waitFor(() => {
      expect(server.held().hidden).toBe(true)
    })

    refresh()
    renderAt('/sr/podesavanja', 'competitor', ME)

    expect(await theBox()).toBeChecked()

    await user.click(await theBox())
    await waitFor(() => {
      expect(server.held().hidden).toBe(false)
    })

    refresh()
    renderAt('/sr/podesavanja', 'competitor', ME)

    expect(await theBox()).not.toBeChecked()
  }, SLOW)
})

describe('the words about himself', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
    clearResourceCache()
    cleanup()
  })

  const theBox = async () =>
    within(await screen.findByRole('region', { name: sr.bio.title })).findByRole('textbox', {
      name: new RegExp(sr.profile.bio),
    })

  const pressSend = async (user: ReturnType<typeof setupUser>) => {
    await user.click(
      await within(await screen.findByRole('region', { name: sr.bio.title })).findByRole('button', {
        name: sr.bio.send,
      }),
    )
  }

  /**
   * <p><b>Taking them down takes effect at once, so a refresh shows an empty box.</b> The owner's own
   * decision (PDL P11, 19.09.2026: an empty text is a removal that no moderator decides), and the words
   * that stood are the ones the box opened with, so "empty" cannot come from a box that never held them.
   */
  it('are gone after a refresh once he has removed them', async () => {
    const user = setupUser()

    clearResourceCache()

    const server = aServerThatKeepsTheProfile({ hidden: false, bio: 'Trčim dugo.' })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', ME)

    expect(await theBox()).toHaveValue('Trčim dugo.')

    await user.clear(await theBox())
    await pressSend(user)
    await waitFor(() => {
      expect(server.held().bio).toBe('')
    })

    refresh()
    renderAt('/sr/podesavanja', 'competitor', ME)

    expect(await theBox()).toHaveValue('')
    expect(screen.getByText(sr.bio.none)).toBeVisible()
  }, SLOW)

  /**
   * <p><b>A new text waits for a moderator, and a refresh shows it with the mark that it waits, while
   * the profile keeps what STANDS.</b> The box holds the words that wait (the member can correct them
   * before the decision), the sentence over it says they wait, and the profile list - which is what
   * everybody else reads - still carries the approved words. A decision then moves them: approved, the
   * next refresh shows them as what stands and nothing waits; refused, nothing waits and the old words
   * stand. Both decisions, because the mark that went on after either of them is the fault the other
   * would hide.
   */
  it.each([true, false])('are shown after a refresh as the words that wait, and as the words that stand once approved is %s', async (approved) => {
    const user = setupUser()

    clearResourceCache()

    const server = aServerThatKeepsTheProfile({ hidden: false, bio: 'Trčim dugo.' })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', ME)

    await user.clear(await theBox())
    await user.type(await theBox(), 'Nove reči.')
    await pressSend(user)
    await waitFor(() => {
      expect(server.held().waiting).toBe('Nove reči.')
    })

    refresh()
    renderAt('/sr/podesavanja', 'competitor', ME)

    expect(await theBox()).toHaveValue('Nove reči.')
    expect(screen.getByText(sr.bio.waitingNote)).toBeVisible()
    expect(server.held().bio, 'unapproved words reached the profile').toBe('Trčim dugo.')

    server.decide(approved)
    refresh()
    renderAt('/sr/podesavanja', 'competitor', ME)

    expect(await theBox()).toHaveValue(approved ? 'Nove reči.' : 'Trčim dugo.')
    expect(screen.queryByText(sr.bio.waitingNote), 'a text that was decided is still shown as waiting').toBeNull()
  }, SLOW)

  /**
   * <p><b>A correction made after a refresh overwrites, and the mark stays.</b> The refresh is the
   * point: the member comes back to words that wait, mends a sentence, and the server holds the mended
   * words as the ones that wait.
   */
  it('can be corrected after a refresh, and the corrected words are the ones that wait', async () => {
    const user = setupUser()

    clearResourceCache()

    const server = aServerThatKeepsTheProfile({ hidden: false, bio: 'Trčim dugo.' })

    stop = server.stop
    renderAt('/sr/podesavanja', 'competitor', ME)

    await user.clear(await theBox())
    await user.type(await theBox(), 'Prva verzija.')
    await pressSend(user)
    await waitFor(() => {
      expect(server.held().waiting).toBe('Prva verzija.')
    })

    refresh()
    renderAt('/sr/podesavanja', 'competitor', ME)

    await user.clear(await theBox())
    await user.type(await theBox(), 'Druga verzija.')
    await pressSend(user)
    await waitFor(() => {
      expect(server.held().waiting).toBe('Druga verzija.')
    })

    refresh()
    renderAt('/sr/podesavanja', 'competitor', ME)

    expect(await theBox()).toHaveValue('Druga verzija.')
    expect(screen.getByText(sr.bio.waitingNote)).toBeVisible()
  }, SLOW)
})
