import { screen, waitFor } from '@testing-library/react'
import { must } from '../test/at'
import { DAY, PUBLIC } from '../test/addresses'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useSession } from '../session/useSession'

/* What a member chooses to show, and to whom.
 *
 * The published privacy policy has promised both of these since it was written: hiding the
 * profile from readers who are not signed in, and showing the birthday only by choice. Nothing
 * in the code answered for either until 06.09.2026, when the owner asked for the controls
 * rather than for the sentences to go.
 *
 * **Both are measured on the screen that draws them and on the screen that reads them**, in one
 * visit, because the whole of the question is what somebody else sees.
 */

/** The reader becomes somebody else inside one visit, because what one member chose is read
 *  by another. */
function Become({ who }: { who: string }) {
  const { signIn } = useSession()

  return (
    <button type="button" onClick={() => { signIn(who) }}>
      postani {who}
    </button>
  )
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
    <button type="button" onClick={() => { editRecord(who, { profileHidden: 'true' }) }}>
      sakrij {who}
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

describe('hiding a profile from readers who are not signed in', () => {
  it('is offered in the settings and answered by the profile', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007', undefined, undefined, <SignOut />)

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )

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

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )
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

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )
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
    const hide = async () =>
      user.click(
        await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
      )

    await hide()

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
    await user.click(screen.getByRole('button', { name: 'postani 000001' }))
    await router.navigate('/sr/podesavanja')
    await hide()

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

  it('gives the way in back to a reader who is signed in', async () => {
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

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )

    /* Another member, not the one who is hiding: hiding is from readers who are not signed in and
       from nobody else, so a member reading somebody else's list sees the way in (P23). */
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await router.navigate('/sr/takmicari')

    expect((await screen.findByText('Strahinja Vukićević')).closest('a')).not.toBeNull()
  }, SLOW)

  it('leaves every other profile alone', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007', undefined, undefined, <SignOut />)

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )
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
       i od ostalih članova, jer bi time nestao smisao zajedničkog rangiranja." */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/podesavanja',
      'competitor',
      '000007',
      undefined,
      undefined,
      <Become who="000012" />,
    )

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )
    await user.click(screen.getByRole('button', { name: 'postani 000012' }))
    await router.navigate(HIM)

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    expect(lineUnderTheName('000007')).toMatch(/Banja Luka/)
    expect(screen.queryByText(/sakrio svoj profil/)).toBeNull()
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

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )
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

describe('a member entered in administration', () => {
  it('publishes no birthday, because nobody chose one', async () => {
    /* **A record made where no field asks the question.** The form in administration asks for
       nine things and none of them is the birthday or the hiding, so the record is made from
       `MEMBERS.blank`. A field missing there is `undefined`, and `undefined` is not `'none'`:
       read as „anything but none", the year of birth of somebody who never chose was published
       on a public page, and the profile threw before that on a biography that was not there
       (review, 06.09.2026).

       Walked through administration rather than written into the session, because that is the
       one road by which such a record comes to exist. */
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/clanovi', 'superadmin', '000001')

    await user.click(await screen.findByRole('button', { name: 'Novi član' }))

    await user.type(await screen.findByLabelText(/^Ime$/), 'Milica')
    await user.type(screen.getByLabelText(/^Prezime$/), 'Pavlović')
    await user.selectOptions(screen.getByLabelText(/^Pol$/), 'F')
    await user.type(screen.getByLabelText(/Godina rođenja/), '1991')
    await user.type(screen.getByLabelText(/^Mesto$/), 'Kraljevo')
    await user.selectOptions(screen.getByLabelText(/^Država$/), 'RS')
    await user.type(screen.getByLabelText(/U ligi od sezone/), '2027')
    await user.selectOptions(screen.getByLabelText(/Osnov članstva/), 'payment')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* Her public page draws at all, which it did not: it threw on a biography that was not
       there. And it says nothing she did not choose. */
    await router.navigate('/sr/takmicar/000033')

    expect(
      await screen.findByRole('heading', { level: 1, name: /Milica Pavlović/ }),
    ).toBeVisible()

    const line = lineUnderTheName('000033')

    expect(line).toMatch(/Kraljevo/)
    expect(line).not.toMatch(/1991/)
  }, SLOW)
})

describe('what the settings show back', () => {
  it('shows the choice that was made, not the one it started on', async () => {
    /* Measured only that the controls write, never that they read back: a member could choose
       „samo godinu", come back and find „ne prikazuj ništa" ticked while the profile published
       the year (review, 06.09.2026). */
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007')

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )
    await user.click(screen.getByLabelText('Prikaži samo godinu'))

    /* Away and back, so what is read is the record and not what the screen was holding. */
    await router.navigate(HIM)
    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })
    await router.navigate('/sr/podesavanja')

    expect(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    ).toBeChecked()
    expect(screen.getByLabelText('Prikaži samo godinu')).toBeChecked()
    expect(screen.getByLabelText('Ne prikazuj ništa')).not.toBeChecked()
  }, SLOW)
  it('can be unticked again, which a missing field would have made impossible', async () => {
    /* **The nastiest half of a field that is not on the blank.** `editRecord` writes text, and
       `like` puts it back into the shape the record holds it in by looking at the record. With
       no `profileHidden` there to look at, „false" comes back as the string „false", which is
       true: the member ticks once and can never untick, and the box shows ticked while the
       profile stays hidden to every stranger (review, 06.09.2026).

       Walked on a member entered in administration, because that is the only road to a record
       made from the blank. */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/administracija/clanovi',
      'superadmin',
      '000001',
      undefined,
      undefined,
      <>
        <Become who="000033" />
        <SignOut />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Novi član' }))
    await user.type(await screen.findByLabelText(/^Ime$/), 'Milica')
    await user.type(screen.getByLabelText(/^Prezime$/), 'Pavlović')
    await user.selectOptions(screen.getByLabelText(/^Pol$/), 'F')
    await user.type(screen.getByLabelText(/Godina rođenja/), '1991')
    await user.type(screen.getByLabelText(/^Mesto$/), 'Kraljevo')
    await user.selectOptions(screen.getByLabelText(/^Država$/), 'RS')
    await user.type(screen.getByLabelText(/U ligi od sezone/), '2027')
    await user.selectOptions(screen.getByLabelText(/Osnov članstva/), 'payment')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* She signs in, hides, and changes her mind. */
    await user.click(screen.getByRole('button', { name: 'postani 000033' }))

    /* **Whose screen this is, said out loud, because otherwise nothing says it.** Podešavanja
       draws no name and no number, and all thirty two served members answer „ne prikazuj ništa"
       and „profil nije skriven" exactly as a record made from the blank does. So every assertion
       below can be satisfied by the wrong member: put the session on 000001 and the case goes on
       passing while it has stopped saying anything about a blank (review, 06.09.2026).

       `moj-profil` is the one address that draws whoever is signed in, so the name under it is
       the identity itself rather than a second copy of it. */
    await router.navigate('/sr/moj-profil')

    expect(
      await screen.findByRole('heading', { level: 1, name: /Milica Pavlović/ }),
    ).toBeVisible()

    await router.navigate('/sr/podesavanja')

    const box = await screen.findByLabelText(
      'Sakrij moj profil od posetilaca koji nisu prijavljeni',
    )

    /* **What a member who has answered nothing starts with, and it is the answer the record
       has to arrive already holding.** The floor over the blank asks what shape a value is,
       and „full" is the same shape as „none": a record made in administration could open
       this screen with the whole birth date chosen by somebody who was never asked. The
       recorded rule is that nothing is shown until the member says otherwise (PDL, privatnost
       profila), so it is stated here as the three buttons answer it, not as a field name.

       All three, because the one that is taken is only half of it: the case has to fall on a
       blank that starts on „year" as much as on one that starts on „full". */
    expect(screen.getByLabelText('Ne prikazuj ništa')).toBeChecked()
    expect(screen.getByLabelText('Prikaži samo godinu')).not.toBeChecked()
    expect(screen.getByLabelText('Prikaži ceo datum')).not.toBeChecked()

    await user.click(box)

    /* That it was ever on. Both assertions below are the state a new record starts in, so
       without this the case passes just as well on a control that never hides (review,
       06.09.2026). */
    expect(box).toBeChecked()

    await user.click(box)

    expect(box).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'odjavi se' }))
    await router.navigate('/sr/takmicar/000033')

    expect(
      await screen.findByRole('heading', { level: 1, name: /Milica Pavlović/ }),
    ).toBeVisible()
    expect(screen.queryByText(/sakrio svoj profil/)).toBeNull()
  }, SLOW)

})

describe('the birthday a member chooses to show', () => {
  it('is nowhere until it is chosen', async () => {
    renderAt(HIM)

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    expect(lineUnderTheName('000007')).not.toMatch(/2007/)
  })

  it('stands between the category and the town once it is', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007')

    await user.click(await screen.findByLabelText('Prikaži samo godinu'))
    await router.navigate(HIM)

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    /* Read off the one line rather than off the page: „nakon kategorije, a pre grada" is an
       order, and a year found anywhere on a profile full of seasons says nothing about it. */
    expect(lineUnderTheName('000007')).toMatch(/M24-.*2007.*Banja Luka/)
  }, SLOW)

  it('shows the year for „ceo datum" too, because the record has no date yet', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007')

    await user.click(await screen.findByLabelText('Prikaži ceo datum'))
    await router.navigate(HIM)

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    expect(lineUnderTheName('000007')).toMatch(/M24-.*2007.*Banja Luka/)
  }, SLOW)

  it('says in the settings why the whole date is not there yet', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000007')

    expect(
      await screen.findByText(/pun datum još nigde ne čuva/),
    ).toBeVisible()
  })
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
 * ulogovani"). A screen that leads to a hidden profile only for a signed-in member is outside this
 * and outside the rule.
 */
describe('a hidden profile is reachable from nowhere', () => {
  it.each(PUBLIC)('is not reached from %s', async (where, asVisitor) => {
    const user = setupUser()

    /* The same day the other sweep over this table reads it on, and out of the same place as the
       table itself (`test/addresses.ts`). What a screen draws depends on the day: one of these
       addresses opens the registration, whose heading changes when it opens, and another is a
       profile whose owner has to be a member on it. Written out here, the day would part from the
       table it belongs to the moment somebody moved one of them. */
    renderAt(where, 'visitor', null, undefined, DAY, <Hide who="000007" />)

    await user.click(screen.getByRole('button', { name: 'sakrij 000007' }))

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
