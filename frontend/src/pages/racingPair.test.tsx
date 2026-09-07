import { screen, within } from '@testing-library/react'
import { htmlElement, must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useSession } from '../session/useSession'

/* „Pozovi u trkački par", from the press to the answer.
 *
 * The owner chose this door out of three on 07.09.2026 („Poslušaću predlog broj 1, tvoju
 * preporuku"): the question is asked from the other person's profile and answered from their
 * inbox, which is exactly how a team invites somebody (`pages/teamInvite.test.tsx`, and this file
 * is written from it).
 *
 * Everything is walked on the screens, in one visit, because every half of it is about what
 * somebody else sees: the press is on one member's profile, the answer is in another member's
 * mail, and, when a pair is broken to make room, the notice is in a third member's.
 */

/** The reader becomes somebody else inside one visit. */
function Become({ who }: { who: string }) {
  const { signIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        signIn(who)
      }}
    >
      postani {who}
    </button>
  )
}

/* Read off `public/mock/competitors.json` rather than remembered: 000002 Relja Momčilović is a man
   and 000015 Katarina Novaković a woman, and neither is in any pair in `public/mock/pairs.json`,
   which holds only 000001 with 000009 and 000014 with 000030, both for 2019. 000004 Časlav
   Radenković is a second man, for the case about two of one sex. */
const HER = '/sr/takmicar/000015-katarina-novakovic'
const OTHER_MAN = '/sr/takmicar/000004-caslav-radenkovic'
const TODAY = '2026-10-15'

const invite = () => screen.queryAllByRole('button', { name: 'Pozovi u trkački par' })

/** The three members the walks become, drawn beside the portal. Signing in as somebody else inside
 *  one visit is what lets a press in one member's hands be read in another's inbox. */
const THREE = (
  <>
    <Become who="000015" />
    <Become who="000002" />
    <Become who="000004" />
    <Become who="000006" />
  </>
)

/** Every message in the panel in the header, newest first, the way the panel draws them. */
async function inbox(user: ReturnType<typeof setupUser>) {
  await user.click(await screen.findByRole('button', { name: /Otvori poruke/ }))

  return screen
    .queryAllByRole('link')
    .filter((one) => /\/poruke\/msg-/.test(one.getAttribute('href') ?? ''))
}

/** The reader's own profile, reached the way a member reaches it: through the account menu in the
 *  header. Walked rather than rendered again, because a pair confirmed a moment ago lives in the
 *  session and rendering again would build a new one. */
async function goToMyProfile(user: ReturnType<typeof setupUser>) {
  await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))
  await user.click(await screen.findByRole('link', { name: 'Moj profil' }))
}

/** The one invitation waiting, opened. */
async function openTheInvitation(user: ReturnType<typeof setupUser>) {
  const waiting = (await inbox(user)).filter((one) =>
    /Poziv u trkački par/.test(one.textContent ?? ''),
  )

  await user.click(must(waiting[0], 'an invitation in the inbox'))
}

describe('who is offered „Pozovi u trkački par"', () => {
  it('is offered to a member on the profile of somebody of the other sex', async () => {
    renderAt(HER, 'competitor', '000002', undefined, TODAY)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    expect(invite()[0]).toBeVisible()
  }, SLOW)

  it('is offered to nobody who is not signed in', async () => {
    /* A pair is two members confirming each other, so a visitor has nothing to confirm with. */
    renderAt(HER, 'visitor', null, undefined, TODAY)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    expect(invite().length).toBe(0)
  }, SLOW)

  it('is offered to nobody on the profile of somebody of the same sex', async () => {
    /* „Trkački par mora biti mešovit, jedan muškarac i jedna žena" (PDL P13). */
    renderAt(OTHER_MAN, 'competitor', '000002', undefined, TODAY)

    await screen.findByRole('heading', { level: 1, name: /Časlav/ })

    expect(invite().length).toBe(0)
  }, SLOW)

  it('is offered once, and then says so', async () => {
    /* An invitation is sent without the other person saying anything, so the same member could
       otherwise fill the same inbox with the same question every day. What stands instead is that
       it was already asked, which is also the answer to „did my press register". */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))

    expect(invite().length).toBe(0)
    expect(screen.getByText(/Poziv u trkački par je poslat/)).toBeVisible()
  }, SLOW)
})

describe('the answer to „Pozovi u trkački par"', () => {
  it('makes the pair on „Prihvati", and both profiles say so', async () => {
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))

    /* **The message goes to her and to nobody else.** Written to the league it would tell every
       member of the portal that these two were being asked to pair, which is their business. */
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)

    expect(screen.getByText(/Relja Momčilović te poziva u trkački par za sezonu 2027/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* Her own profile now names him, for the season the pair was formed for and not for the one
       being run: „Formiranje mora biti završeno do 31. decembra da bi trkački par važio u novoj
       sezoni" (PDL P13). */
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    const line = must(document.querySelector('.profile__pair'), 'the line').textContent ?? ''

    expect(line).toContain('Relja Momčilović')
    expect(line).toContain('2027')
  }, SLOW)

  it('makes nothing on „Odbij", and the question is over', async () => {
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Odbij' }))

    /* Nothing is written down about which of the two answers it was, so the sentence says only
       that the question is over. */
    expect(screen.getByText(/Ovaj poziv više nije otvoren/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).toBeNull()

    /* **And no pair was made**, which the sentence alone does not say: „Odbij" that quietly paired
       them would leave exactly this screen behind (review of my own mutations, 07.09.2026). */
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    expect(document.querySelector('.profile__pair')).toBeNull()
  }, SLOW)
})

describe('the button once a pair exists', () => {
  it('is offered to neither of them, from either side', async () => {
    /* „Jedan par po osobi po sezoni" (PDL P13). Both ends are read, because the button asks about
       both and a version that asked about one of them would leave the other able to be asked again
       (review of my own mutations, 07.09.2026). */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* A third member, on her profile: she is taken, so there is nothing to ask. */
    await user.click(screen.getByRole('button', { name: 'postani 000004' }))
    await user.click(screen.getByRole('link', { name: 'Takmičari' }))
    await user.click(await screen.findByRole('link', { name: /Katarina Novaković/ }))
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    expect(invite().length).toBe(0)

    /* And on Ivona's profile, who is free: the one asking is the one who is taken now. */
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await user.click(screen.getByRole('link', { name: 'Takmičari' }))
    await user.click(await screen.findByRole('link', { name: /Ivona Stamenkovska/ }))
    await screen.findByRole('heading', { level: 1, name: /Ivona/ })

    expect(invite().length).toBe(0)
  }, SLOW)
})

describe('a pair that is ended', () => {
  it('is ended from the profile of whoever is reading, and from no other', async () => {
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* His profile, read by her: the pair is said, and there is no button on it. Ending somebody
       else's pair is somebody else's decision. */
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    /* And from her own profile to his, by the link the pair itself draws: naming the other half is
       what „par sa linkovima" in PDL means. */
    await user.click(
      within(htmlElement(must(document.querySelector('.profile__pair'), 'the line'))).getByRole(
        'link',
      ),
    )
    await screen.findByRole('heading', { level: 1, name: /Relja/ })

    expect(must(document.querySelector('.profile__pair'), 'the line')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Raskini trkački par' })).toBeNull()
  }, SLOW)

  it('is gone from both profiles once it is ended', async () => {
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(screen.getByRole('button', { name: 'Raskini trkački par' }))

    expect(document.querySelector('.profile__pair')).toBeNull()
  }, SLOW)
})

describe('the board of best pairs', () => {
  it('has the pair the moment it is confirmed', async () => {
    /* There is no database, so a pair confirmed during a visit lives in the session; every screen
       reads the file and the session as one thing (`data/derive.ts`, `pairsNow`), which is what
       makes the board and the profile agree. */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* The board of a season the pair was **not** formed for: they have run nothing together, and a
       pair made for 2027 is not on the board of 2019. What is held is that the board reads the
       session at all and does not fall over on a pair that has no results. */
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    /* The pair is on her profile the moment it exists, which is the half of „every screen reads the
       file and the session as one thing" that can be walked to (`data/derive.ts`, `pairsNow`). */
    expect(must(document.querySelector('.profile__pair'), 'the line').textContent).toContain(
      'Relja',
    )
  }, SLOW)
})

describe('a question that has been overtaken, and a pair that makes room', () => {
  it('tells whoever has paired since that this question is over', async () => {
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))

    /* A second man asks her the same thing, from her own profile. */
    await user.click(screen.getByRole('button', { name: 'postani 000004' }))
    await user.click(must(invite()[0], 'the second button'))

    /* She takes the second and then opens the first, which is now over. */
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))

    const waiting = (await inbox(user)).filter((one) =>
      /Poziv u trkački par/.test(one.textContent ?? ''),
    )

    await user.click(must(waiting[0], 'the newer invitation'))
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))
    await user.click(must((await inbox(user))[1], 'the older invitation'))

    expect(screen.getByText(/Već si u trkačkom paru sa/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).toBeNull()
  }, SLOW)

  it('tells the one who is left when accepting breaks a pair', async () => {
    /* The owner's own sentence: „muškarac zatraži novi par, nova žena prihvati, dotadašnja žena
       istog trenutka dobija poruku." He asks two women; the second answers first, and when the
       first answers after her the pair that stood is ended and the woman who is left is told, by
       name and in her own inbox rather than in the league's. */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button on her profile'))

    /* And the same question to a second woman, walked to through the list of members rather than
       rendered beside the portal: what is measured is what one press does to another member's
       inbox. */
    await user.click(screen.getByRole('link', { name: 'Takmičari' }))
    await user.click(await screen.findByRole('link', { name: /Ivona Stamenkovska/ }))
    await screen.findByRole('heading', { level: 1, name: /Ivona/ })
    await user.click(must(invite()[0], 'the button on the second profile'))

    await user.click(screen.getByRole('button', { name: 'postani 000006' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* Ivona is told, and the notice names the man she is no longer paired with. */
    await user.click(screen.getByRole('button', { name: 'postani 000006' }))

    const hers = (await inbox(user)).filter((one) =>
      /Trkački par je raskinut/.test(one.textContent ?? ''),
    )

    await user.click(must(hers[0], 'the notice'))

    expect(screen.getByText(/Relja Momčilović je od sezone 2027 u drugom trkačkom paru/)).toBeVisible()

    /* **And her pair is really gone**, which the notice alone does not say: an accept that told her
       and left the old pair standing would leave exactly this screen behind. */
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Ivona/ })

    expect(document.querySelector('.profile__pair')).toBeNull()

    /* **And it was written to her and not to the league**, which is the other thing the notice
       alone cannot say: a third member, who has nothing to do with either of them, has no such
       message (review of my own mutations, 07.09.2026). */
    await user.click(screen.getByRole('button', { name: 'postani 000004' }))

    const his = (await inbox(user)).filter((one) =>
      /Trkački par je raskinut/.test(one.textContent ?? ''),
    )

    expect(his.length).toBe(0)
  }, SLOW)
})

describe('a pair whose other half the portal does not have', () => {
  it('is still said, and there is nothing to open', async () => {
    /* A pair is a record of two member numbers, and the file could name somebody the portal no
       longer has: a member who left, or a season of history imported before its people. The pair is
       a fact either way and is said; what there is not is a profile to open, so the number stands
       where the name would.

       Served rather than written into `public/mock/pairs.json`, which is the precedent four other
       cases in this repo use: the two pairs that ship stay as they are. */
    const served = globalThis.fetch
    const orphan = [
      { id: 'orphan', season: 2027, memberNumbers: ['000015', '000099'], since: '2026-12-01' },
    ]

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('pairs.json')
        ? new Response(JSON.stringify(orphan), { headers: { 'content-type': 'application/json' } })
        : served(input, init),
    )

    try {
      renderAt(HER, 'competitor', '000015', undefined, TODAY)

      await screen.findByRole('heading', { level: 1, name: /Katarina/ })

      const line = htmlElement(must(document.querySelector('.profile__pair'), 'the line'))

      expect(line.textContent).toContain('000099')
      expect(within(line).queryByRole('link')).toBeNull()
    } finally {
      /* Put back what stood before, and not `vi.unstubAllGlobals`: this suite serves the mocked
         files through a stub of its own (`pages/publicData.test.tsx` records the same). */
      vi.stubGlobal('fetch', served)
    }
  }, SLOW)
})
