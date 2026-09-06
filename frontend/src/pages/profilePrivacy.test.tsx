import { screen, waitFor } from '@testing-library/react'
import { must } from '../test/at'
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
    .getAllByRole('link')
    .map((one) => one.getAttribute('href') ?? '')
    .filter((href) => href.includes('/takmicar/'))

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
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007', undefined, undefined, <SignOut />)

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )
    await user.click(screen.getByRole('button', { name: 'odjavi se' }))

    for (const where of [
      '/sr/tabela',
      '/sr/top-liste',
      '/sr',
      '/sr/kalendar/novosadski-nocni-maraton-2014',
      '/sr/liga/brdska-2019/rezultati',
    ]) {
      await router.navigate(where)

      /* Waited on until the screen has drawn somebody, which is what makes the second half of
         the question worth asking. */
      await waitFor(() => {
        expect(waysIn().length, `${where}: nijedan profil se ne otvara odavde`).toBeGreaterThan(0)
      })

      expect(waysIn().filter((href) => href.includes('/takmicar/000007')), where).toEqual([])
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
