import { screen, within } from '@testing-library/react'
import { htmlElement, must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useClock } from '../clock/useClock'
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

/** The day the portal is read as, moved inside one visit. A pair asked for on one day and confirmed
 *  on another is the whole of what „formiranje mora biti završeno do 31. decembra" is about. */
function Day({ on }: { on: string }) {
  const { simulate } = useClock()

  return (
    <button
      type="button"
      onClick={() => {
        simulate(on)
      }}
    >
      danas je {on}
    </button>
  )
}

/** The three members the walks become, drawn beside the portal. Signing in as somebody else inside
 *  one visit is what lets a press in one member's hands be read in another's inbox. */
const THREE = (
  <>
    <Become who="000015" />
    <Become who="000002" />
    <Become who="000004" />
    <Become who="000006" />
    <Day on="2027-01-02" />
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

/** The one notice about a pair that ended, opened. */
async function openTheNotice(user: ReturnType<typeof setupUser>) {
  const waiting = (await inbox(user)).filter((one) =>
    /Trkački par je raskinut/.test(one.textContent ?? ''),
  )

  await user.click(must(waiting[0], 'a notice in the inbox'))
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

    expect(screen.getByText(/Relja Momčilović te poziva u trkački par/)).toBeVisible()

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

    /* The line stays and says there is no pair, which is what a profile owes its own reader: an
       empty space answers nothing. */
    expect(must(document.querySelector('.profile__pair'), 'the line').textContent).toContain(
      'Nije u trkačkom paru',
    )
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

    /* And it names **his** other half, which is her: read off the reader instead of off the profile
       being drawn, a profile would tell everybody that the person they are looking at is paired
       with themselves (review, 07.09.2026). */
    expect(must(document.querySelector('.profile__pair'), 'the line').textContent).toContain(
      'Katarina Novaković',
    )
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

    /* The line stays and says there is no pair, which is what a profile owes its own reader: an
       empty space answers nothing. */
    expect(must(document.querySelector('.profile__pair'), 'the line').textContent).toContain(
      'Nije u trkačkom paru',
    )

    /* **And the other half is told**, by name and in his own inbox. Ending a pair is a change that
       hits somebody who is not pressing anything, and PDL says such a member is told at once; the
       same thing happens through „Prihvati", and a portal that told them one way and not the other
       would be a strange portal (review, 07.09.2026). A third member, who has nothing to do with
       either of them, has no such message: the notice is his, not the league's. */
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))

    const his = (await inbox(user)).filter((one) =>
      /Trkački par je raskinut/.test(one.textContent ?? ''),
    )

    expect(his.length).toBe(1)

    await user.click(must(his[0], 'the notice'))

    /* By name and **for the season the pair held**, not the season being read: the pair is for
       2027 and this is read in 2026, so a notice that named the running season would say 2026 and
       the case can tell the two apart. */
    expect(
      screen.getByText(/Trkački par sa Katarina Novaković za sezonu 2027 je raskinut/),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'postani 000004' }))

    expect(
      (await inbox(user)).filter((one) => /Trkački par je raskinut/.test(one.textContent ?? ''))
        .length,
    ).toBe(0)
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
  it('ends the reader’s own pair too, and tells the one she leaves', async () => {
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

    /* **And then the older one, which is still open and still may be taken.** Both halves are
       treated alike (07.09.2026): accepting ends whatever either of them is in and tells whoever is
       left. Refusing the reader while breaking the asker gave the same sentence of PDL two answers
       depending on which side the pair stood, and she could get round it anyway by ending her own
       pair without a word to anybody. */
    await user.click(must((await inbox(user))[1], 'the older invitation'))
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* And the question is closed by being taken: opened again it offers nothing. „Poziv postoji dok
       se ne odgovori; odgovor ga uklanja" (`session/context.ts`). */
    expect(screen.getByText(/Ovaj poziv više nije otvoren/)).toBeVisible()

    /* The man she left is told, by name and in his own inbox. */
    await user.click(screen.getByRole('button', { name: 'postani 000004' }))

    const left = (await inbox(user)).filter((one) =>
      /Trkački par je raskinut/.test(one.textContent ?? ''),
    )

    expect(left.length).toBe(1)
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

    /* The line stays and says there is no pair, which is what a profile owes its own reader: an
       empty space answers nothing. */
    expect(must(document.querySelector('.profile__pair'), 'the line').textContent).toContain(
      'Nije u trkačkom paru',
    )

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

describe('the last day of December', () => {
  it('is a deadline on finishing, so an answer in January makes a pair for the season after next', async () => {
    /* **PDL P13: „Formiranje mora biti završeno do 31. decembra da bi trkački par važio u novoj
       sezoni."** Forming ends when the second of the two confirms, so the season is worked out on
       the day of the answer and never on the day of the question.

       Asked on the last day of 2026 and answered two days later: read off the question this makes a
       pair for 2027, a season already being run, which is the deadline undone. Measured by a review
       on 07.09.2026 by walking exactly this, with the whole gate green. */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, '2026-12-31', THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))

    await user.click(screen.getByRole('button', { name: 'danas je 2027-01-02' }))
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    const line = must(document.querySelector('.profile__pair'), 'the line').textContent ?? ''

    /* The season, not the day: the day it was confirmed is 2. 1. 2027 and says so, which is exactly
       why the two are read apart. */
    expect(line).toContain('Za sezonu 2028')
    expect(line).not.toContain('Za sezonu 2027')
  }, SLOW)
})

describe('a question that is still standing', () => {
  it('stands on both profiles, said from each side', async () => {
    /* PDL asks a profile to carry „tekući trkački par sa linkom, **pozivi koji čekaju (i poslati i
       primljeni)**, i dugme Raskini". A review on 07.09.2026 found two of the three drawn: the one
       who asked could see nothing at all on their own page, and the one who was asked could see it
       only in the inbox.

       Both sides are read, because „poslat" and „primljen" are the same record seen from two ends
       and a version that drew one of them would look right from whichever end the case opened. */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))

    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Relja/ })

    expect(must(document.querySelector('.profile__pair'), 'his line').textContent).toContain(
      'Poslat poziv: Katarina Novaković',
    )

    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    expect(must(document.querySelector('.profile__pair'), 'her line').textContent).toContain(
      'Primljen poziv: Relja Momčilović',
    )

    /* **And she is not offered the same question back**, which is the other direction of one
       standing question: two of them in two inboxes would be two answers to one thing. Read on his
       profile, walked to through the list of members. */
    await user.click(screen.getByRole('link', { name: 'Takmičari' }))
    await user.click(await screen.findByRole('link', { name: /Relja Momčilović/ }))
    await screen.findByRole('heading', { level: 1, name: /Relja/ })

    expect(invite().length).toBe(0)
    expect(screen.getByText(/Poziv u trkački par je poslat/)).toBeVisible()

    /* **And his page says nothing at all about it**, which is his and hers and nobody else's: the
       questions still standing are drawn on the reader own page only, so on his page, read by her,
       there is no such line to read. */
    expect(document.querySelector('.profile__pair')).toBeNull()
  }, SLOW)

  it('stands on the page of somebody who already has a pair, because it can still end it', async () => {
    /* Drawn only inside „there is no pair", a member with a pair and an open question about another
       one saw nothing of it on their own page, and that question can still end the pair they have
       (review, 07.09.2026). */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'his question to her'))

    await user.click(screen.getByRole('link', { name: 'Takmičari' }))
    await user.click(await screen.findByRole('link', { name: /Ivona Stamenkovska/ }))
    await screen.findByRole('heading', { level: 1, name: /Ivona/ })
    await user.click(must(invite()[0], 'his question to Ivona'))
    await user.click(screen.getByRole('button', { name: 'postani 000006' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Relja/ })

    const line = must(document.querySelector('.profile__pair'), 'his line').textContent ?? ''

    expect(line).toContain('Ivona Stamenkovska')
    expect(line).toContain('Poslat poziv: Katarina Novaković')
  }, SLOW)

  it('is not listed on somebody else’s page, and neither is anybody else’s', async () => {
    /* Two things one case can hold, because they fail the same way: a reader who is shown questions
       that are not theirs, and a page that shows its own owner's questions to whoever opens it. */
    const user = setupUser()

    renderAt(HER, 'competitor', '000004', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'his question to her'))

    /* A third member opens her page: the question between the other two is not there. */
    await user.click(screen.getByRole('button', { name: 'postani 000006' }))
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    expect(document.querySelector('.profile__pair')).toBeNull()

    /* And her own page carries her own questions and nobody else's. */
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Ivona/ })

    const line = must(document.querySelector('.profile__pair'), 'her line').textContent ?? ''

    /* **Named after the one who sent it**, which is what makes this assertion able to fail: the
       question standing is Časlav's to Katarina, so a page that listed it would say „Primljen
       poziv: Časlav Radenković". Written against her name it could not fail either way (review,
       07.09.2026). */
    expect(line).toContain('Nije u trkačkom paru')
    expect(line).not.toContain('poziv')
    expect(line).not.toContain('Časlav')
  }, SLOW)
})

describe('a pair from a season that is over', () => {
  it('is not drawn as the pair somebody has now', async () => {
    /* `public/mock/pairs.json` pairs 000009 Milica Bogdanović with 000001 Vladan Đurišić for
       **2019**. Read without a floor under the season, her profile in 2026 says she is in that pair
       today, and the whole gate stays green: the argument the profile is read with is measured
       nowhere else (review, 07.09.2026). */
    renderAt('/sr/takmicar/000009-milica-bogdanovic', 'competitor', '000009', undefined, TODAY)

    await screen.findByRole('heading', { level: 1, name: /Milica/ })

    expect(must(document.querySelector('.profile__pair'), 'the line').textContent).toContain(
      'Nije u trkačkom paru',
    )
  }, SLOW)
})

describe('accepting when both of them are already paired', () => {
  it('ends both pairs, and each one who is left is told by name', async () => {
    /* The decision of 07.09.2026, both halves of it: „prihvatanje izvodi **oba** člana iz onoga u
       čemu su za tu sezonu" and „**svaki** ostavljeni partner dobija poruku". Every other walk has
       exactly one of the two sides paired, so „both" and „whichever one there is" draw the same
       screen and no case can tell them apart. Here both are.

       It is also the only walk in which the two notices must name **different** people: read off
       the question rather than off the pair that ended, the second one would name the man who
       asked, who has nothing to do with the pair that was ended. */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    /* He asks her, and that question stays open while everything else happens. */
    await user.click(must(invite()[0], 'his question to her'))

    /* He pairs with Ivona. */
    await user.click(screen.getByRole('link', { name: 'Takmičari' }))
    await user.click(await screen.findByRole('link', { name: /Ivona Stamenkovska/ }))
    await screen.findByRole('heading', { level: 1, name: /Ivona/ })
    await user.click(must(invite()[0], 'his question to Ivona'))
    await user.click(screen.getByRole('button', { name: 'postani 000006' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* And she pairs with Časlav. */
    await user.click(screen.getByRole('button', { name: 'postani 000004' }))
    await user.click(screen.getByRole('link', { name: 'Takmičari' }))
    await user.click(await screen.findByRole('link', { name: /Katarina Novaković/ }))
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'his question to her'))
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* Now she takes the older question, which is still open. Two pairs end at once. */
    const older = (await inbox(user)).filter((one) =>
      /Poziv u trkački par/.test(one.textContent ?? ''),
    )

    /* The **older** of the two, and the panel draws the newest first. */
    await user.click(must(older[older.length - 1], 'his older question'))
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* Ivona is told, and her notice names the man she is no longer paired with. */
    await user.click(screen.getByRole('button', { name: 'postani 000006' }))
    await openTheNotice(user)

    expect(
      screen.getByText(/Relja Momčilović je od sezone 2027 u drugom trkačkom paru/),
    ).toBeVisible()

    /* Časlav is told too, and his notice names **her**. */
    await user.click(screen.getByRole('button', { name: 'postani 000004' }))
    await openTheNotice(user)

    expect(
      screen.getByText(/Katarina Novaković je od sezone 2027 u drugom trkačkom paru/),
    ).toBeVisible()
  }, SLOW)
})

describe('the questions on a page that is not the reader\u2019s', () => {
  it('are the reader\u2019s own on their own page, and nobody\u2019s on anybody else\u2019s', async () => {
    /* Two leaks that fail the same way, so one walk holds both: a page that shows the reader's own
       questions on **somebody else's** profile, and a page that lists **other people's** questions
       on the reader's own. Both were open until 07.09.2026, and neither is visible unless the
       reader has a question of their own while looking at a page that has a pair on it. */
    const user = setupUser()

    renderAt(HER, 'competitor', '000004', undefined, TODAY, THREE)

    /* Časlav asks Katarina, so he has a question of his own standing. */
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'his question'))

    /* Relja and Ivona pair up, so there is a profile with a pair to read. */
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await user.click(screen.getByRole('link', { name: 'Takmičari' }))
    await user.click(await screen.findByRole('link', { name: /Ivona Stamenkovska/ }))
    await screen.findByRole('heading', { level: 1, name: /Ivona/ })
    await user.click(must(invite()[0], 'his question to Ivona'))
    await user.click(screen.getByRole('button', { name: 'postani 000006' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* Časlav reads Ivona's page: her pair is there, and his own question is not. */
    await user.click(screen.getByRole('button', { name: 'postani 000004' }))
    await user.click(screen.getByRole('link', { name: 'Takmičari' }))
    await user.click(await screen.findByRole('link', { name: /Ivona Stamenkovska/ }))
    await screen.findByRole('heading', { level: 1, name: /Ivona/ })

    const hers = must(document.querySelector('.profile__pair'), 'her line').textContent ?? ''

    expect(hers).toContain('Relja Momčilović')
    expect(hers).not.toContain('Poslat poziv')

    /* And Ivona's own page lists her own questions and nobody else's: Časlav's question to Katarina
       is not hers to see. */
    await user.click(screen.getByRole('button', { name: 'postani 000006' }))
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Ivona/ })

    const mine = must(document.querySelector('.profile__pair'), 'her own line').textContent ?? ''

    expect(mine).toContain('Relja Momčilović')
    /* Her own question was answered and closed, so there is none to list. Read without asking whose
       a question is, the one Časlav sent Katarina would stand here, on a page it has nothing to do
       with, and it would be named after **him** rather than after her, which is why the case names
       both. */
    expect(mine).not.toContain('poziv')
    expect(mine).not.toContain('Časlav')
  }, SLOW)
})

describe('a clock set before the league had a season', () => {
  it('never writes a pair for a season the league does not have', async () => {
    /* `FIRST_SEASON` is 2027, and „prva sezona koja još nije počela" is the portal's own question
       with the portal's own answer (`data/season.ts`, `transfersTakeEffect`), floored for exactly
       this reason on 06.09.2026 after a clock set to 2025 wrote a club membership for 2026.
       Written again by hand here, the same clock wrote a **pair** for 2026 (review, 07.09.2026). */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, '2025-10-15', THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    const line = must(document.querySelector('.profile__pair'), 'the line').textContent ?? ''

    expect(line).toContain('Za sezonu 2027')
    expect(line).not.toContain('Za sezonu 2026')
  }, SLOW)
})

describe('two questions waiting on one page', () => {
  it('are two sentences and not one', async () => {
    /* Two of them ran into each other with nothing between: „Nije u trkačkom paru.Primljen poziv:
       Relja Momčilović.Primljen poziv: Časlav Radenković." (review, 07.09.2026). No other walk has
       a member with two questions standing on their own page, so nothing could see it. */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'his question'))
    await user.click(screen.getByRole('button', { name: 'postani 000004' }))
    await user.click(must(invite()[0], 'the second question'))

    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    const line = must(document.querySelector('.profile__pair'), 'her line').textContent ?? ''

    expect(line).toContain('Momčilović. Primljen poziv')
  }, SLOW)
})

describe('the day a notice about a broken pair carries', () => {
  it('is the day it was written, and not any other', async () => {
    /* The notice is dated, and the date is drawn in the panel, in the list of messages and on the
       message itself. Written with any other day it would file itself among older mail and read as
       something that happened then (review, 07.09.2026).

       The day is moved between making the pair and ending it, so „the day it was written" and „the
       day the pair was made" are two different strings and the case can tell them apart. */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, TODAY, THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    await user.click(screen.getByRole('button', { name: 'danas je 2027-01-02' }))
    await goToMyProfile(user)
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(screen.getByRole('button', { name: 'Raskini trkački par' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await openTheNotice(user)

    /* Read off the opened message rather than off the panel, which draws the same date beside the
       subject: one of the two would answer for the other. */
    expect(must(document.querySelector('.messages__from'), 'the line under the subject').textContent)
      .toContain('2. 1. 2027')
  }, SLOW)
})

describe('the button on the profile of somebody already paired', () => {
  it('is gone on a clock the league had no season on', async () => {
    /* The other half of „one home for the season a change takes effect in" (review, 07.09.2026).
       The answer was measured on that clock and the **question** was not: written by hand, the
       button asks about 2026 while the pair it would duplicate was written for 2027, so it goes on
       standing beside a pair that already exists. */
    const user = setupUser()

    renderAt(HER, 'competitor', '000002', undefined, '2025-10-15', THREE)

    await screen.findByRole('heading', { level: 1, name: /Katarina/ })
    await user.click(must(invite()[0], 'the button'))
    await user.click(screen.getByRole('button', { name: 'postani 000015' }))
    await openTheInvitation(user)
    await user.click(screen.getByRole('button', { name: 'Prihvati' }))

    /* A third man opens her page: she is paired, so there is nothing to ask. */
    await user.click(screen.getByRole('button', { name: 'postani 000004' }))
    await user.click(screen.getByRole('link', { name: 'Takmičari' }))
    await user.click(await screen.findByRole('link', { name: /Katarina Novaković/ }))
    await screen.findByRole('heading', { level: 1, name: /Katarina/ })

    expect(invite().length).toBe(0)
  }, SLOW)
})
