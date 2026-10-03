import { screen, waitFor, within } from '@testing-library/react'
import { must } from '../test/at'
import { DAY, PUBLIC } from '../test/addresses'
import { renderAt } from '../test/render'
import { membersAsServed, serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import type { Role } from '../roles/context'
import { useRole } from '../roles/useRole'
import { useSession } from '../session/useSession'
import { recordKey } from '../session/context'
import { MEMBERS } from './admin/entityForms'

/* What a member chooses to show, and to whom.
 *
 * The published privacy policy has promised both of these since it was written: hiding the
 * profile from readers who are not signed in, and showing the birthday only by choice. (The words
 * are the policy's. Since 03.10.2026 the rule the portal keeps is wider than they say: a profile
 * is hidden from everybody who is neither an active member nor the administration, PDL P23,
 * 03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan član ni administracija,
 * nikad prema aktivnom članu"; the policy's
 * own text has not moved, and what to do about it is a question for the owner.) Nothing
 * in the code answered for either until 06.09.2026, when the owner asked for the controls
 * rather than for the sentences to go.
 *
 * **Both are measured on the screen that draws them and on the screen that reads them**, in one
 * visit, because the whole of the question is what somebody else sees.
 */

/** The reader becomes somebody else inside one visit, because what one member chose is read
 *  by another.
 *
 *  **And it says who the session is signed in as, so a case can ask whether the change really
 *  happened** (`becomes` below). Without that line this probe could stop working and nothing would
 *  notice: the reader would silently stay the member who is hiding, and every assertion a case
 *  makes about „somebody else" would be made about the owner instead (`btl-produkt/PENDING.md`,
 *  item 146). */
function Become({ who }: { who: string }) {
  const { signIn, memberNumber } = useSession()

  return (
    <>
      <button type="button" onClick={() => { signIn(who) }}>
        postani {who}
      </button>
      <p>čitalac: {memberNumber ?? 'niko'}</p>
    </>
  )
}

/** Presses the button of `Become` and WAITS FOR THE SESSION TO SAY IT WORKED, which is the whole of why
 *  this is a function and not a click: a case that pressed and went on would be reading the
 *  screens as whoever the session still was. */
async function becomes(user: ReturnType<typeof setupUser>, who: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: `postani ${who}` }))

  expect(await screen.findByText(`čitalac: ${who}`)).toBeVisible()
}

/**
 * Somebody is signed in, as the server's answer to `GET /api/me` says he is: a role and, for a
 * member, the number the league has given him. With NO number it is administration, which has no
 * competitor record at all (PDL P21), and anybody who has registered and is not a member yet; with
 * one it is a member, whose fee may or may not be standing.
 *
 * **Both writes `session/useTheServersSession.ts` makes with that answer, in one handler**
 * (`become` and `theServerSignedMeIn`), because since 03.10.2026 what a reader may read depends
 * on the ROLE as well as on the member number: the role names the administration and the number
 * is looked up on the list the server serves. A probe that wrote the account and left the role
 * where the visit started would sign in a reader the real portal cannot produce. Written the way
 * the four cases that sign somebody in during a visit write it
 * (`member/profileVisibility.test.tsx`).
 */
function SignInAs({
  role,
  memberNumber,
  label,
}: {
  role: Role
  memberNumber: string | null
  label: string
}) {
  const { theServerSignedMeIn } = useSession()
  const { become } = useRole()

  return (
    <button
      type="button"
      onClick={() => {
        become(role)
        theServerSignedMeIn({
          account: 2,
          memberNumber,
          country: null,
          firstSeason: null,
          teamId: null,
          membershipBasis: null,
          referralCode: null,
          referredCount: null,
        })
      }}
    >
      {label}
    </button>
  )
}

/**
 * THE ROUTE THAT TAKES THE CHOICE, IN FRONT OF THE DISC READER FOR EVERY CASE IN THIS FILE.
 *
 * <p><b>Why this file needs one at all, since 28.09.2026.</b> The box used to write into the
 * session overlay and stop there, so the whole of this file ran with no server. It sends
 * `PUT /api/me` now and writes the overlay only inside the arm the ANSWER authorised
 * (`member/ProfileVisibility.tsx`), and `test/setup.ts` answers every write 404 - so without
 * this, every case below would press a box that changed nothing and would fail for a reason
 * that has nothing to do with what it is about.
 *
 * <p><b>What it answers is read off the REQUEST, which is what makes these cases stronger
 * than they were.</b> `MeWriteApi.Changed` carries „the flag as the row now holds it", and
 * this route needs nobody's approval for that half, so the row really does end up holding what
 * arrived. A server that always answered `true` would let a panel that ignored the answer
 * pass; answering what was sent keeps the two honest, and `member/profileVisibility.test.tsx`
 * is where the two are deliberately made to DISAGREE.
 *
 * <p>Everything that is not this write goes on to the disc reader, exactly as before
 * (`test/serverAnswers.ts` says why replacing it outright empties every screen in the shell).
 */
beforeEach(() => {
  theRoute = serverThat((path, init) =>
    path === '/api/me' && init?.method === 'PUT'
      ? new Response(JSON.stringify({ profileHidden: hiddenIn(init), bio: null, waiting: null }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      : null,
  )
})

afterEach(() => {
  theRoute?.stop()
  theRoute = null
})

let theRoute: { stop: () => void } | null = null

/** What the panel asked for, off the body it really sent. */
function hiddenIn(init: RequestInit): boolean {
  const sent: unknown = JSON.parse(String(init.body))

  return typeof sent === 'object' && sent !== null && Reflect.get(sent, 'profileHidden') === true
}

/**
 * The box in the settings, pressed, and WAITED FOR UNTIL THE SERVER HAS AGREED.
 *
 * <p>The waiting is the whole of why this is a function. Nothing outside the panel moves until
 * the answer lands - that is the order the panel keeps on purpose - so a case that pressed and
 * navigated at once would be reading the screens before the choice existed anywhere but in the
 * request. „Sačuvano." is what the panel says when the answer has been read and the overlay
 * written, so it is the one signal that means both.
 */
async function hide(user: ReturnType<typeof setupUser>): Promise<void> {
  await user.click(
    await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
  )

  await within(screen.getByRole('region', { name: 'Privatnost' })).findByText('Sačuvano.')
}

/**
 * A member hides their profile, without walking the screen that offers the box.
 *
 * What it writes is exactly what the checkbox writes (`member/Settings.tsx`): the same key, the
 * same field, the same word. What it saves is the visit: the sweep below opens thirty addresses,
 * and paying for a trip to the settings on each of them is thirty renders of a screen the sweep is
 * not about. The case that measures the box itself is the first one in this file.
 */
function Hide({ who }: { who: string }) {
  const { editRecord } = useSession()

  return (
    <button type="button" onClick={() => { editRecord(recordKey(MEMBERS.id, who), { profileHidden: 'true' }) }}>
      sakrij {who}
    </button>
  )
}

/**
 * Two members are in a racing pair, without walking the three screens that make one.
 *
 * **Written for the sweep below, which could not see the pair line at all** (security review,
 * 08.09.2026). A profile draws only pairs of the season being run and later, and every pair in
 * `public/mock/pairs.json` is from 2019, so the line was never on the screen while the sweep read
 * it. The link it drew by hand to a hidden member therefore passed every gate.
 *
 * The two are of one sex, which no screen would allow (a pair is mixed, PDL P13). That rule belongs
 * to the screen that offers the question, and this is about where a name leads: the sweep needs the
 * hidden member paired with somebody whose profile it actually opens, and `000001` is the only
 * profile in the table.
 */
function Pair({ a, b, season }: { a: string; b: string; season: number }) {
  const { makePair } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        makePair({ season, memberNumbers: [a, b] })
      }}
    >
      upari {a} i {b}
    </button>
  )
}

/** The reader stops being signed in, without leaving the visit. */
function SignOut() {
  const { signOut } = useSession()

  return (
    <button type="button" onClick={() => { signOut() }}>
      odjavi se
    </button>
  )
}

/** The one line under the name, whole. The member number is drawn in a span of its own, so
 *  reading that span answers about the number and not about the line it stands in. */
function lineUnderTheName(number: string): string {
  const span = screen.getByText(new RegExp(`Članski broj ${number}`))

  return must(span.closest('p'), 'the line under the name').textContent ?? ''
}

/** Every way into a profile that is drawn on the screen right now, as addresses.
 *
 *  By the address and not by the words, because the question is where a press lands and the same
 *  member is drawn as a name on one screen, as a circle on another and as a bar on a third. */
const waysIn = (): string[] =>
  screen
    /* **Including what is out of the accessibility tree** (review, 07.09.2026). A link inside an
       `aria-hidden` subtree is left out of the default reading, and it is still a link: a pointer
       presses it and a search engine follows it. The board of ten is built of exactly that — the
       picture and the number of the place are both `aria-hidden`, and the name is what the link is
       called (`profile/ProfileLink.tsx`) — so moving that one attribute a level up would have left
       a visitor a clickable face of a member who had hidden themselves, with every gate green.
       Measured: with the attribute moved, this sweep passed 45 of 45; with `hidden: true`, 31 of
       them fail. */
    .getAllByRole('link', { hidden: true })
    .map((one) => one.getAttribute('href') ?? '')
    .filter((href) => href.includes('/takmicar/'))

/** What each of the two is called, so the walk can ask whether the screen draws them at all.
 *
 *  Written out rather than read off the file, because a name read from the same place the screen
 *  reads it from would agree with it however wrong both were.
 *
 *  Asked for with `must`, so a sixth row added to the walk without a name here fails saying which
 *  member is missing. Left to fall back on the number, it would quietly ask the page for „000012"
 *  and report „undefined nije ni nacrtan" (review, 07.09.2026). */
const NAMES: Record<string, string> = {
  '000001': 'Vladan Đurišić',
  '000007': 'Strahinja Vukićević',
}

/* 000007 is Strahinja Vukićević, born 2007, of Banja Luka, in Dunavski trkači.
   The year is read off the data rather than remembered: written from memory it was 1988, and
   the case then failed on a mechanism that worked. */
const HIM = '/sr/takmicar/000007-strahinja-vukicevic'

describe('hiding a profile from readers who may not read it', () => {
  it('is offered in the settings and answered by the profile', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007', undefined, undefined, <SignOut />)

    await hide(user)

    /* Still everything, to the member themselves. */
    await router.navigate(HIM)

    expect(
      await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ }),
    ).toBeVisible()
    expect(lineUnderTheName('000007')).toMatch(/Banja Luka/)

    /* **And to a reader who is not signed in, there is no page at all.** The owner, 06.09.2026:
       „do profilnih strana tog takmičara je nemoguće doći… javni posetilac se preusmerava na
       naslovnu stranu portala." Until then the address answered with a page of its own, which
       said the member was hiding; that told a visitor which numbers belong to members who hide,
       which is the thing being hidden. */
    await user.click(screen.getByRole('button', { name: 'odjavi se' }))

    /* Read off the address rather than off a heading: „Balkanska trkačka liga" is the name of the
       portal and is written on every screen, so a heading by that name is satisfied by the page
       the reader is leaving as much as by the one they arrive at. */
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })

    expect(screen.queryByText(/Članski broj 000007/)).toBeNull()
  }, SLOW)

  it('answers a deep link the same way whether the profile is hidden or was never there', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007', undefined, undefined, <SignOut />)

    await hide(user)
    await user.click(screen.getByRole('button', { name: 'odjavi se' }))

    /* **The two have to be one answer.** A „nije pronađen" for a number nobody has and a redirect
       for a number somebody is hiding behind lets a visitor read the difference off the screen and
       so learn exactly what was hidden. Owner, 06.09.2026: „Oba na naslovnu." */
    await router.navigate(HIM)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })

    await router.navigate('/sr/takmicar/000999-niko-nikic')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
  }, SLOW)

  it('leaves the name where it stood, as words instead of a way in', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007', undefined, undefined, <SignOut />)

    await hide(user)
    await user.click(screen.getByRole('button', { name: 'odjavi se' }))
    await router.navigate('/sr/takmicari')

    /* **Nothing is taken off the list.** Owner, 06.09.2026: „Meni je potpuno OK da u spisku
       takmičara stoje podaci kako jesu, samo opet nema linka ka skrivenim profilima ukoliko
       posetilac nije ulogovan." So the card keeps the name, the number and the town; what it
       loses is the way in.

       Read against a member who is **not** hiding on the same screen, because „there is no link"
       is also what a screen with no cards at all would say. */
    const him = await screen.findByText('Strahinja Vukićević')
    const her = screen.getByText('Ivona Stamenkovska')

    expect(him.closest('a')).toBeNull()
    expect(her.closest('a')).not.toBeNull()
    expect(screen.getByText('000007')).toBeVisible()
  }, SLOW)

  it('leaves the circle and the name in the main standing, with no way in from either', async () => {
    /* The circle there is a link of its own to the same profile as the name (`pages/Rankings.tsx`),
       so a hidden member has two ways in to take away and a reader who may not read a hidden
       profile must be left with neither: the sweep below asks every address the portal has whether any of them
       leads to the member, and says nothing about the screen going on to draw the person. A row
       that lost its circle with its link would satisfy that sweep exactly as well, and it would be
       the member's face taken off a table the owner asked it be on (PDL P23: hiding is about
       reaching the profile, not about what a list says). */
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007', undefined, undefined, <SignOut />)

    await hide(user)
    await user.click(screen.getByRole('button', { name: 'odjavi se' }))
    await router.navigate('/sr/tabela')

    const him = must((await screen.findByText('Strahinja Vukićević')).closest('tr'), 'his row')

    /* `hidden: true`, because the circle's link is out of the accessibility tree and a reading that
       left it out would count none for a row that still carried it. */
    expect(within(him).queryAllByRole('link', { hidden: true })).toEqual([])
    expect(him.querySelector('.portrait'), 'the circle is still there').not.toBeNull()
    expect(within(him).getByText('Strahinja Vukićević')).toBeVisible()

    /* A member who is not hiding, in the same table: with no ways in anywhere this half is what a
       screen that drew no links at all would also say. */
    const others = within(must(him.closest('table'), 'the standing'))
      .getAllByRole('row')
      .slice(1)
      .filter((row) => row !== him)

    expect(others.length).toBeGreaterThan(0)

    for (const row of others) {
      expect(within(row).getAllByRole('link', { hidden: true })).toHaveLength(2)
    }
  }, SLOW)

  /* **Every screen, and not the one that remembered** (review, 07.09.2026).
     Hiding is chosen during a visit and there is no database, so the only place it lives is the
     session. Eleven screens hand the rule whatever record they hold, and eleven of them hold the
     record as it came off the file; the list of competitors reads through the overlay and the
     rest did not, so a member who ticked the box and signed out was plain text there and a link
     on five other screens. Measured that day: the standing, the top boards, the front page, an
     event and a competition.

     **The fix is not on these five screens and the case must not be either.** It is in
     `profile/useProfileLink.ts`, which now lays this visit's own answer over whatever record it
     is handed, so a twelfth screen written tomorrow is right without being told. What this walk
     holds is that the door is really the one all of them go through.

     **A screen that drew nothing would say the same thing**, so each address is asked for both
     halves: there are ways into profiles here, and none of them is his. */
  it('is read by every screen that draws a name, not only by the one that remembered', async () => {
    const user = setupUser()
    const { router } = renderAt(
      '/sr/podesavanja',
      'competitor',
      '000007',
      undefined,
      undefined,
      <>
        <Become who="000001" />
        <SignOut />
      </>,
    )
    await hide(user)

    /* **Two members hidden in one visit, because one member is not on every screen** (review,
       07.09.2026). The walk hid `000007` alone and asked five screens about him, and on the fifth
       he simply is not drawn: the standing of a competition is of the members who raced it, and he
       raced none of `brdska-2019`. „No way in is his" was then answered by his absence rather than
       by the rule, and a review measured it: with hiding switched off in `profile/visible.ts`
       altogether, four of the five addresses fail and that one passes.

       Swapping the address does not mend it. Of the three competitions in the file, the other two
       draw no way into any profile at all, so nothing there could carry this question either.

       So each address names the member it can really answer about, and both are hidden before the
       walk starts. Both edits live in the same overlay, keyed by member number, so one visit is
       enough. */
    await becomes(user, '000001')
    await router.navigate('/sr/podesavanja')
    await hide(user)

    await user.click(screen.getByRole('button', { name: 'odjavi se' }))

    /* **Each screen waited for by its own heading, and then waited on until it stops drawing**
       (review, 07.09.2026). Neither half was there and both were needed.

       Read straight after `navigate`, the old screen is still in the document: measured that day,
       the front page reported the eighteen ways in that the standing before it had drawn, letter
       for letter, while the same screen visited alone reports twenty-nine; and a screen put second
       in the loop reported nought, so „no way in is his" passed over an empty document. Four of
       the five addresses were not measured at all.

       The heading says the new screen has mounted. The settling says it has finished: a screen
       arrives in waves, and a question asked at the first wave is asked of a third of the answers.
       Both are needed and neither is enough.

       The heading is written down beside the address, the way `pages/publicData.test.tsx` writes
       its own table, and it is floored by the two questions under it: a heading that stops
       matching fails on the wait, and an address that leads into no profile at all fails on the
       count. */
    const WALK: [address: string, heading: string, who: string][] = [
      ['/sr/tabela', 'BTL tabele', '000007'],
      ['/sr/top-liste', 'Top liste', '000007'],
      ['/sr', 'Balkanska trkačka liga', '000007'],
      ['/sr/kalendar/novosadski-nocni-maraton-2014', 'Novosadski noćni maraton', '000007'],
      /* The one screen `000007` is not on, and the one member the standing of this competition
         does draw. */
      ['/sr/liga/brdska-2019', 'Brdska liga 2019', '000001'],
    ]

    for (const [where, heading, who] of WALK) {
      await router.navigate(where)
      await screen.findByRole('heading', { level: 1, name: heading })

      /* Two readings alike and neither of them nought: the screen has drawn somebody and has
         stopped adding to them. Counted rather than compared against a number written here, or
         the day a competitor is added to the file this walk would fail on arithmetic. */
      let seen = -1

      await waitFor(() => {
        const now = waysIn().length
        const done = now > 0 && now === seen

        seen = now

        expect(done, `${where}: ekran se još crta`).toBe(true)
      })

      /* And he is really drawn here, which is the half that was missing: „none of these ways in
         is his" is also what a screen that never mentions him would say. His name stays whatever
         happens to the link (owner, 06.09.2026), so the name is what proves he is on the page.

         Asked of the text of the page rather than of one node, because these screens write a name
         in more than one shape: the boards write it over two lines, in two elements with a space
         between them, and on the front page his name reaches the text only
         through the plain-text branch of `ProfileLink`, out of the way of the eye. A query for one
         node finds neither, and the question here is only whether the screen mentions him at all.

         What that costs, said plainly: on the front page this half and the half above it are not
         independent, because both are answered by the same branch. It is not a false pass — it is
         a false alarm waiting to happen, if that branch ever stops writing the name. Measured on
         07.09.2026 by a review, and left as it is: the other four screens answer the two halves
         from different places. */
      expect(
        document.body.textContent?.includes(must(NAMES[who], `ime člana ${who}`)),
        `${where}: ${must(NAMES[who], who)} nije ni nacrtan`,
      ).toBe(true)
      expect(waysIn().filter((href) => href.includes(`/takmicar/${who}`)), where).toEqual([])
    }
  }, SLOW)

  it('gives the way in back to an active member', async () => {
    const user = setupUser()
    const { router } = renderAt(
      '/sr/podesavanja',
      'competitor',
      '000007',
      undefined,
      undefined,
      <>
        <SignOut />
        <Become who="000002" />
      </>,
    )

    await hide(user)

    /* Another member, not the one who is hiding: hiding is from readers who are neither active
       members nor the administration and from nobody else, so an active member reading somebody
       else's list sees the way in (P23, 03.10.2026). */
    await becomes(user, '000002')
    await router.navigate('/sr/takmicari')

    expect((await screen.findByText('Strahinja Vukićević')).closest('a')).not.toBeNull()
  }, SLOW)

  it('leaves every other profile alone', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007', undefined, undefined, <SignOut />)

    await hide(user)
    await user.click(screen.getByRole('button', { name: 'odjavi se' }))
    await router.navigate('/sr/takmicar/000002-relja-momcilovic')

    /* One member's choice is one member's: read as a switch on the screen rather than on the
       record, it would have hidden everybody at once. */
    expect(await screen.findByText(/Članski broj 000002/)).toBeVisible()
    expect(screen.queryByText(/sakrio svoj profil/)).toBeNull()
  }, SLOW)

  it('is not hiding from other members, which is the half the policy explains', async () => {
    /* Every case here read a member's own profile, so „signed in" and „it is me" were the same
       reader and the condition could be narrowed to the owner with nothing falling (review,
       06.09.2026). The policy gives the reason for the other half in the same sentence: „ali ne
       i od ostalih članova, jer bi time nestao smisao zajedničkog rangiranja." The other member
       is an ACTIVE one, since 03.10.2026 (`000012` is on the list the server serves): the case
       that turns a member whose fee has lapsed away is further down. */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/podesavanja',
      'competitor',
      '000007',
      undefined,
      undefined,
      <Become who="000012" />,
    )

    await hide(user)
    await becomes(user, '000012')
    await router.navigate(HIM)

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    expect(lineUnderTheName('000007')).toMatch(/Banja Luka/)
    expect(screen.queryByText(/sakrio svoj profil/)).toBeNull()

    /* **THE ONE ASSERTION HERE THAT ONLY A READER WHO IS NOT THE OWNER CAN PRODUCE** (`PENDING.md`,
       item 146). Everything above is what the owner sees as well, so a probe that silently left him
       signed in passed this case with the rule narrowed to „the reader is the owner" and without
       it: measured 02.10.2026, both ways, on the file as it stood.

       The button is the portal's own answer to a reader who is not the owner: `000007` is a man and
       `000012` a woman (`test/mock/competitors.json`), and `profile/InviteToPair.tsx` offers
       nothing where the two are of one sex, which is what the owner is to himself. So with the
       owner in the chair this line cannot be satisfied, and `becomes` above is the other half of
       the same guard: it fails at the moment the probe stops working, rather than here. */
    expect(await screen.findByRole('button', { name: 'Pozovi u trkački par' })).toBeVisible()
  }, SLOW)

  it('holds on the page of awards, which draws the same head', async () => {
    /* The check stood on the profile and not here, and this address is public and bookmarked:
       a reader refused the profile got the whole card one address further along, birthday and
       all (review, 06.09.2026). */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/podesavanja',
      'competitor',
      '000007',
      undefined,
      undefined,
      <SignOut />,
    )

    await hide(user)
    await user.click(screen.getByRole('button', { name: 'odjavi se' }))
    await router.navigate(`${HIM}/priznanja`)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })

    expect(screen.queryByText(/Članski broj 000007/)).toBeNull()
    /* And nothing of the trophies either: this address used to answer with a page of its own that
       carried the name, and since 06.09.2026 both addresses answer the same way as a profile that
       was never there. */
    expect(screen.queryByText(/Strahinja Vukićević/)).toBeNull()
  }, SLOW)
})

/**
 * THE ADMINISTRATION READS A HIDDEN PROFILE WHETHER OR NOT IT RACES.
 *
 * <p>PDL P23, 03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan član ni administracija,
 * nikad prema aktivnom članu":
 * moderators and the superadmin read it, and they have no member number at all (PDL P21). A screen
 * that asked only whether the reader is a MEMBER would send them to the front page while the server
 * served them a hidden member's biography and portrait. That is the fault this case was written for
 * on 02.10.2026, when the rule was „is anybody signed in" and the two answers parted for exactly this
 * reader; it is the same reader under a different sentence, which is why it stays.
 *
 * <p>**Each of the three screens that ask has a case of its own**, because the fault is one
 * expression on each and restoring it on one leaves the other two green: measured as three
 * separate mutations, one at each call site.
 *
 * <p>**Each case is one visit with the reader as the only thing that changes.** The same hidden
 * member, first for a reader nobody has signed in, who is turned away, and then for the account.
 * Read the other way round, the case would pass for a screen that lets everybody in, and the first
 * half of it passes for a screen that turns everybody away only until the second half is asked.
 */
describe('a hidden profile, read by the administration, which races for nobody', () => {
  /** The member is hidden and the reader is a visitor, in a visit that has not signed anybody in
   *  yet. What signs in is the moderator's account: the role is the moderator's and the session
   *  has no number, which is the state under test. */
  async function visit(where: string) {
    const user = setupUser()
    const { router } = renderAt(
      where,
      'visitor',
      null,
      undefined,
      DAY,
      <>
        <Hide who="000007" />
        <SignInAs role="moderator" memberNumber={null} label="prijavi nalog bez člana" />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'sakrij 000007' }))

    return { user, router }
  }

  it.each([
    ['opens the profile', HIM],
    ['opens the page of awards', `${HIM}/priznanja`],
  ])('%s', async (_what, where) => {
    const { user, router } = await visit('/sr')

    /* Turned away first, which is what the reader is until somebody signs in: the other state of
       the same axis, in the same visit, for the same member. */
    await router.navigate(where)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })

    await user.click(screen.getByRole('button', { name: 'prijavi nalog bez člana' }))
    await router.navigate(where)

    /* By their name and by the address, and not by „there is a heading": a refused reader is sent to
       the front page, which has a heading of its own (`data/theRealAnswer.test.tsx` writes out what
       reading one cost). */
    expect(
      await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe(where)
  }, SLOW)

  it('leaves a name on a list as a way in', async () => {
    const { user } = await visit('/sr/takmicari')

    /* Words while nobody is signed in, and a way in once somebody is. Both read off the same card,
       so a screen that never drew him cannot satisfy either half. */
    expect((await screen.findByText('Strahinja Vukićević')).closest('a')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'prijavi nalog bez člana' }))

    expect(screen.getByText('Strahinja Vukićević').closest('a')).not.toBeNull()
  }, SLOW)
})

/**
 * THE MEMBERS `/api/competitors` REALLY ANSWERS WITH, for every case of the `describe` that calls this.
 *
 * <p>Since 03.10.2026 a screen reads „is this reader an active member" off that list, and the file
 * `test/setup.ts` answers out of still carries members whose fee has lapsed, flagged `active:
 * false`, which the server never serves (`test/serverAnswers.ts`, `membersAsServed`). A case about a
 * member whose fee has lapsed that left the file as it is would be about a member the list names, so
 * it would be let in for the very reason it is meant to be turned away.
 *
 * @returns the numbers the answer leaves out, asked after the case has started
 */
function theServerAnswersWithItsMembers(): { lapsed: () => string[] } {
  let served: ReturnType<typeof membersAsServed> | null = null

  beforeEach(() => {
    served = membersAsServed()
  })

  afterEach(() => {
    served?.stop()
    served = null
  })

  return { lapsed: () => must(served, 'answer the server is giving').lapsed }
}

/**
 * A HIDDEN PROFILE IS NOT READ BY SOMEBODY SIGNED IN WHO IS NEITHER AN ACTIVE MEMBER NOR THE
 * ADMINISTRATION.
 *
 * <p>PDL P23, 03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan član ni administracija,
 * nikad prema aktivnom članu",
 * chosen between offered outcomes with its price shown: a free account and a member whose fee has
 * lapsed meet a hidden profile as a visitor does, and a member who does not renew stops seeing hidden
 * profiles until he pays. Until that day the screens, and the server, asked whether anybody was signed
 * in, and these two were let in.
 *
 * <p>**Two readers, because the two ways of not being let in are different facts.** An account with
 * no member behind it (somebody who registered and has not paid, or any account that is not the
 * administration) has no number the list could carry; a member WITH a number whose fee has run out is
 * simply not on the list the server serves (`test/mock/competitors.json`, 000032). A reader read by
 * `memberNumber !== null` lets the second one in.
 *
 * <p>**Each of the three screens that ask has a case of its own**, and each is one visit with the
 * reader as the only thing that changes: turned away as a visitor, signed in, and turned away still.
 * The mirror of this is the case above, where the SAME sign in is let in by the role: without it, a
 * screen that turned everybody away would pass here.
 */
describe.each([
  ['an account with no member behind it', 'competitor', null],
  ['a member whose fee has lapsed', 'competitor', '000032'],
] as const)('a hidden profile, read by %s', (_who, role, number) => {
  const served = theServerAnswersWithItsMembers()

  async function visit(where: string) {
    if (number !== null) {
      expect(served.lapsed(), 'the answer really leaves him out').toContain(number)
    }

    const user = setupUser()
    const { router } = renderAt(
      where,
      'visitor',
      null,
      undefined,
      DAY,
      <>
        <Hide who="000007" />
        <SignInAs role={role} memberNumber={number} label="prijavi čitaoca" />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'sakrij 000007' }))

    return { user, router }
  }

  it.each([
    ['the profile', HIM],
    ['the page of awards', `${HIM}/priznanja`],
  ])('does not open %s', async (_what, where) => {
    const { user, router } = await visit('/sr')

    await router.navigate(where)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })

    await user.click(screen.getByRole('button', { name: 'prijavi čitaoca' }))
    await router.navigate(where)

    /* Sent away still, and to the same place: the front page, read by the address, because a refused
       reader lands on a page with a heading of its own. */
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(screen.queryByRole('heading', { level: 1, name: /Strahinja Vukićević/ })).toBeNull()
  }, SLOW)

  it('leaves a name on a list as words', async () => {
    const { user } = await visit('/sr/takmicari')

    expect((await screen.findByText('Strahinja Vukićević')).closest('a')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'prijavi čitaoca' }))

    /* Read off the same card after the sign in, so a screen that stopped drawing him cannot satisfy
       this: he is drawn, and he is still not a way in. */
    expect(await screen.findByText('Strahinja Vukićević')).toBeVisible()
    expect(screen.getByText('Strahinja Vukićević').closest('a')).toBeNull()
  }, SLOW)
})

/**
 * TWO CASES ABOUT A FIELD THAT IS SIMPLY ABSENT STOOD HERE, AND THEIR SUBJECT WENT EXTINCT ON
 * 26.09.2026.
 *
 * <p>Both were about a record made from `MEMBERS.blank`, where a field nobody asks about is
 * `undefined` rather than a value. That is a nasty state and the cases were right to exist: read
 * as „anything but none", the year of birth of somebody who never chose was published on a public
 * page; and `editRecord` writes text, so with no `profileHidden` for `like` to shape against,
 * „false" came back as the string „false", which is true - a member could tick once and never
 * untick (reviews, 06.09.2026).
 *
 * <p><b>Both notes said they were walked through administration „because that is the one road by
 * which such a record comes to exist". That road is gone.</b> „Nov član" left
 * `admin/AdminMembers.tsx` because `POST /api/competitors` is the group entry that sends
 * invitations rather than a form for one record (PDL P8b, 25.09.2026).
 *
 * <p><b>And the obvious replacement was tried and REFUSED, which is why this note is long.</b>
 * Serving a row with those keys missing looks like a stronger subject and is not a subject at all:
 * all three fields are required of a served competitor - `data/types.ts:235` `profileHidden:
 * boolean`, `:266` `birthdayShown: BirthdayShown`, `:286` `bio: string` - and
 * `CompetitorApi.java:517` selects every one of them on every row. A fixture that left them out
 * was inventing a state the portal cannot meet, and it showed: the profile went straight to the
 * error boundary on the missing biography, which is a case failing for a reason that can never
 * happen in production.
 *
 * <p><b>What still has a floor, and it was checked before these were removed.</b> The mechanism -
 * a blank supplying fields no form asks for - is live for the entities that still have a form,
 * and `admin/entityForms.test.tsx` guards it over a team's logo in „carries every field the record
 * has, including the ones no field asks for". What a member CHOOSES is still measured above, in
 * „shows the choice that was made, not the one it started on". Only the absent state is gone, and
 * it is gone because nothing can produce it.
 *
 * <p><b>The day the group entry screen arrives, this question comes back</b> - and it comes back
 * against the SERVER, because `CompetitorWriteApi.Invited` carries neither `birthdayShown` nor
 * `profileHidden`, so whatever the route decides for them is what every invited member starts on.
 * That is a case about a route's defaults rather than about a blank, and it belongs to that
 * increment.
 */


describe('what the settings show back', () => {
  it('shows the choice that was made, not the one it started on', async () => {
    /* Measured only that the control writes, never that it reads back: a member could hide the
       profile, come back and find the box empty while the profile stayed hidden (review,
       06.09.2026). The birthday half of this case went with the exception itself on
       12.09.2026; what it held is now held by `profile.test.tsx`, against a record that asks
       for the whole date. */
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007')

    await hide(user)
    /* Away and back, so what is read is the record and not what the screen was holding. */
    await router.navigate(HIM)
    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })
    await router.navigate('/sr/podesavanja')

    expect(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    ).toBeChecked()
  }, SLOW)

})

/**
 * That **no address the portal has** leads a visitor to a profile that is hidden.
 *
 * **This is the fifth form of this question and the first that cannot be spelt around**
 * (07.09.2026). The four before it all asked the same thing about the source: which modules reach
 * the one that builds the address of a profile. Each was answered by reading the code, and each
 * missed one way of writing the same thing, one per round of review: a second exported name, a
 * double-quoted specifier, `export … from`, `import(…)`, a `.ts` extension, and finally
 * `export { profilePath }` written as a statement of its own beside the import it re-exports.
 *
 * **A guard that has been wrong five times about how something is written is asking the wrong
 * question.** What P23 actually forbids is not an import; it is a link. So this asks about the
 * link, on every address there is, and how the address was built stops mattering: a hand-written
 * one, one through a re-export, one through a module nobody thought of, all end in the same
 * `href` and all fail here, whether or not a screen reader would ever meet it.
 *
 * **Over the same table `pages/publicData.test.tsx` sweeps** (`test/addresses.ts`), which is held
 * against the route table itself, so an address added tomorrow is swept without anybody
 * remembering to add it. That is the floor this question needs and the one the module sweep never
 * had.
 *
 * **One member, and it has to be him.** The table sweeps `/sr/takmicar/000001` and its trophies,
 * so hiding `000001` would turn two of the addresses being swept into a redirect to the front
 * page — which is the right answer, and is measured by the first case in this file rather than
 * here. `000007` is drawn on the standing, the top boards, the front page, an event and the team,
 * and his own profile is not on the table, so he is the one who can be hidden while every address
 * still draws what it draws.
 *
 * The one screen he is not on is the standing of a competition, and that is what the walk above
 * covers, with the member that standing does draw.
 *
 * **What this cannot say**, written down rather than left to be found: it sweeps the addresses the
 * portal answers **outside administration**, as a visitor. Administration is behind a right and is
 * not a place a visitor reaches at all, which is what P23 is about („za sve posetioce koji nisu
 * ulogovani", read since 03.10.2026 as: for every reader who is neither an active member nor the
 * administration). A screen that leads to a hidden profile only for an active member or the
 * administration is outside this and outside the rule.
 */
describe('the partner named on a pair line', () => {
  it('is a way in until they hide, and words after', async () => {
    /* **The sweep below cannot say this, and that is why this case exists** (security review,
       08.09.2026). It asserts absence: no address on the page leads to the hidden member. A page
       that never drew the pair line at all satisfies that exactly as well, and for one commit that
       is what happened, because every pair in the mock is from 2019 and a profile draws only the
       season being run and later. The probe that fixed it can go the same way: change the season it
       makes the pair for and the sweep passes green over a live hole.
     *
       So the line is read here positively, and from both sides of the rule in one visit: while he
       is not hiding his name is the way in, and the moment he hides it is the same name as words.
       The same shape as `leaves the name where it stood` above, which reads a member who is hiding
       beside one who is not. */
    const user = setupUser()

    renderAt(
      '/sr/takmicar/000001',
      'visitor',
      null,
      undefined,
      DAY,
      <>
        <Hide who="000007" />
        <Pair a="000001" b="000007" season={Number(DAY.slice(0, 4)) + 1} />
      </>,
    )

    await screen.findByRole('heading', { level: 1, name: /Vladan/ })
    await user.click(screen.getByRole('button', { name: 'upari 000001 i 000007' }))

    expect((await screen.findByText('Strahinja Vukićević')).closest('a')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'sakrij 000007' }))

    expect(screen.getByText('Strahinja Vukićević').closest('a')).toBeNull()
  }, SLOW)
})

describe('a hidden profile is reachable from nowhere', () => {
  it.each(PUBLIC)('is not reached from %s', async (where, asVisitor) => {
    const user = setupUser()

    /* The same day the other sweep over this table reads it on, and out of the same place as the
       table itself (`test/addresses.ts`). What a screen draws can depend on the day: one of these
       addresses is a profile whose owner has to be a member on it. The registration screen used
       to be another, before its own ban on a date came off (PDL, „Zabrana registracije pre
       01.10.2026 se SKIDA", owner 27.09.2026). Written out here, the day would part from the
       table it belongs to the moment somebody moved one of them. */
    renderAt(
      where,
      'visitor',
      null,
      undefined,
      DAY,
      <>
        <Hide who="000007" />
        <Pair a="000001" b="000007" season={Number(DAY.slice(0, 4)) + 1} />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'sakrij 000007' }))
    /* So that the profile of 000001, which this table does open, draws a line about a pair with the
       member being hidden. Without it the line is not on any screen the sweep reads. */
    await user.click(screen.getByRole('button', { name: 'upari 000001 i 000007' }))

    /* The screen, and then the screen having stopped drawing. Nought is a legitimate answer here,
       unlike in the walk above: most of these addresses lead into no profile at all, and what is
       asked of them is that they lead into neither of these two. Which addresses do draw somebody
       is the walk's business, and it names five of them. */
    await screen.findByRole('heading', { level: 1, name: asVisitor })

    let seen = -1

    await waitFor(() => {
      const now = waysIn().length
      const done = now === seen

      seen = now

      expect(done, `${where}: ekran se još crta`).toBe(true)
    })

    expect(
      waysIn().filter((href) => href.includes('/takmicar/000007')),
      where,
    ).toEqual([])
  }, SLOW)
})

/**
 * AND IT IS REACHABLE FROM NOWHERE TO A MEMBER WHOSE FEE HAS LAPSED, WHO IS SIGNED IN.
 *
 * <p>The walk above reads every address as a visitor, and says so: a screen that leads to a hidden
 * profile only below a sign in is outside it. Since 03.10.2026 a member whose fee has lapsed is
 * signed in and is read as a visitor is (PDL P23, 03.10.2026, „Skrivanje deluje prema svakome ko
 * nije aktivan član ni administracija,
 * nikad prema aktivnom članu"), so the same table is walked as him, under the headings
 * the screens carry once somebody is signed in. What this holds is the property and not a reader
 * kind: one way in that stays on for a signed in reader, however it is written, is a way in.
 */
describe('a hidden profile is reachable from nowhere, not even to a member whose fee has lapsed', () => {
  const served = theServerAnswersWithItsMembers()

  /* THE TWO ADDRESSES THAT DRAW SOMETHING ELSE FOR HIM, named rather than skipped. The heading is
     only the signal that the screen has been drawn, and two screens are not the member's own for
     somebody the list does not carry: the page of ratings says who rates an event, and his own
     profile has no member to open, so it sends him to the front page (read off both on
     03.10.2026, with the list the server really serves). Both are still walked. */
  const WHAT_HE_MEETS_INSTEAD = new Map([
    ['/sr/kalendar/fruskogorski-maraton-2010/ocena', 'Ovaj događaj ocenjuju oni koji su ga istrčali'],
    ['/sr/moj-profil', 'Balkanska trkačka liga'],
  ])

  it.each(PUBLIC)('is not reached from %s', async (where, _asVisitor, asMember) => {
    expect(served.lapsed(), 'the answer really leaves him out').toContain('000032')

    const user = setupUser()

    renderAt(
      where,
      'competitor',
      '000032',
      undefined,
      DAY,
      <>
        <Hide who="000007" />
        <Pair a="000001" b="000007" season={Number(DAY.slice(0, 4)) + 1} />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'sakrij 000007' }))
    await user.click(screen.getByRole('button', { name: 'upari 000001 i 000007' }))

    await screen.findByRole('heading', { level: 1, name: WHAT_HE_MEETS_INSTEAD.get(where) ?? asMember })

    let seen = -1

    await waitFor(() => {
      const now = waysIn().length
      const done = now === seen

      seen = now

      expect(done, `${where}: ekran se još crta`).toBe(true)
    })

    expect(
      waysIn().filter((href) => href.includes('/takmicar/000007')),
      where,
    ).toEqual([])
  }, SLOW)
})
