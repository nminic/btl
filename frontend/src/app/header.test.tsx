import { htmlElement, must } from '../test/at'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import { SessionContext, type Message, type SessionValue, type SignedIn } from '../session/context'
import { clearResourceCache } from '../data/client'
import { serverThat } from '../test/serverAnswers'
import { useSession } from '../session/useSession'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { monogramFor } from './monogram'
import { MailIcon } from './icons'
import { MessagesMenu } from './MessagesMenu'

/* The header: the mark, the groups that open, the inbox and the account
 * picture. Everything here is reached by role and by name, because that is how
 * it is reached with a keyboard and a screen reader too. */

/** The panel a trigger opens, found the way a screen reader finds it: through
 *  the aria-controls of the button. Several member screens repeat the same
 *  words, so the panel has to be looked in rather than the whole page. */
function panelOf(triggerName: string | RegExp) {
  const trigger = screen.getByRole('button', { name: triggerName })
  const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '')

  return within(htmlElement(panel))
}

describe('the brand', () => {
  it('says the whole name and the slogan, and leads home', async () => {
    const user = setupUser()
    renderAt('/sr/timovi')

    const brand = await screen.findByRole('link', { name: 'Naslovna strana' })
    expect(within(brand).getByText('Balkanska trkačka liga')).toBeVisible()
    // No full stop in the mark: as part of the brand it is a legend, not a
    // sentence (PDL P28a). The legal texts keep the one from P1.
    expect(within(brand).getByText('Svaka trka se broji')).toBeVisible()

    await user.click(brand)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Balkanska trkačka liga')
  })
})

describe('a panel that opens under a button', () => {
  /* Walked on the account menu. It was walked on a navigation group until
     04.08.2026, when the owner had the groups taken out of the header: "Više
     neće biti multinivo navigacije". The panel is the same one either way, and
     every one of these is about the panel rather than about what is in it. */
  const OPEN = 'Otvori nalog'

  it('opens and closes from its own button, and says which panel it controls', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    const button = await screen.findByRole('button', { name: OPEN })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', 'account-menu')
    expect(screen.queryByRole('link', { name: 'Podešavanja' })).not.toBeInTheDocument()

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Podešavanja' })).toBeVisible()

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Escape', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    const button = await screen.findByRole('button', { name: OPEN })
    await user.click(button)
    await user.keyboard('{Escape}')

    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('hands the focus back to its own button on Escape', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    const button = await screen.findByRole('button', { name: OPEN })
    await user.click(button)
    screen.getByRole('link', { name: 'Podešavanja' }).focus()

    await user.keyboard('{Escape}')

    // The panel the focus was in has just been hidden. Left alone the focus ends
    // up on the body, and the next Tab starts the page again from the skip link.
    expect(button).toHaveFocus()
  })

  it('says it opens a panel rather than a menu of commands', async () => {
    renderAt('/sr', 'competitor', '000007')

    const button = await screen.findByRole('button', { name: OPEN })

    // A disclosure over a list of links: aria-haspopup would announce a menu
    // widget, and with it the arrow keys a menu is expected to answer to.
    expect(button).not.toHaveAttribute('aria-haspopup')
    expect(button).toHaveAttribute('aria-controls', 'account-menu')
  })

  it('leaves a key it does not handle alone', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    const button = await screen.findByRole('button', { name: OPEN })
    await user.click(button)
    await user.keyboard('{ArrowDown}')

    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes when something outside it is clicked', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    const button = await screen.findByRole('button', { name: OPEN })
    await user.click(button)
    await user.click(screen.getByRole('main'))

    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays open while something inside it is clicked', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    const button = await screen.findByRole('button', { name: OPEN })
    await user.click(button)
    await user.click(await panelOf(OPEN).findByText('Strahinja Vukićević'))

    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('monogramFor', () => {
  /* **The case that asserted initials is gone with the branch that produced them**
     (27.09.2026). `monogramFor` took a `Competitor` and answered „SV" for „strahinja
     vukićević", which was the second home of the two letters `components/Portrait.tsx` takes
     out of the same two fields. The header now draws `Portrait` for a member (PDL P28f), so
     no screen could reach that branch any more and only this case kept it alive - a line
     covered by a test and reachable from nothing, which is the one shape a coverage threshold
     reports as healthy.

     What is left is the only question the function still answers, and the case that would
     have told us the branch was dead is `components/oneFace.test.ts`, which asks which modules
     reach the two that make a member's circle. */
  it('takes the end of whatever identifies an account, until a name is there', () => {
    expect(monogramFor('000007')).toBe('07')
    /* An account id rather than a member number, which is the other thing the header hands
       it: the two are different numbers and this function may not care which. */
    expect(monogramFor('41')).toBe('41')
  })
})

describe('the account menu', () => {
  it('offers a visitor the way in and nothing else', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('link', { name: 'Prijavi se' })).toHaveAttribute(
      'href',
      '/sr/prijava',
    )
  })

  it('shows the monogram and the name of whoever is signed in', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })
    expect(button).toHaveTextContent('SV')

    await user.click(button)
    expect(await panelOf('Otvori nalog').findByText('Strahinja Vukićević')).toBeVisible()
  })

  it('shows the approved photograph of whoever is signed in, and not the monogram', async () => {
    /* 000003 rather than the fixture's first member: a header that drew the first
       competitor's picture whoever was signed in would still show Vladan's square here,
       since 000007 above never exercises this branch at all (his photo is null). Written
       because a mutation survived: this call site had no case of its own for the picture
       arriving (`app/AccountMenu.tsx` is the one PDL P28f names by name), so a mutation
       that left the header drawing the monogram of a member who really has an approved
       portrait passed the whole suite. */
    renderAt('/sr', 'competitor', '000003')

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })

    expect(must(button.querySelector('img'), 'the portrait in the account button')).toHaveAttribute(
      'src',
      '/mock/photo/andjelija.svg',
    )
    expect(button).not.toHaveTextContent('AV')
  })

  it('falls back to the member number when there is no such member', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', 'M9999')

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })
    expect(button).toHaveTextContent('99')

    await user.click(button)
    expect(panelOf('Otvori nalog').getByText('M9999')).toBeVisible()
  })

  it('closes itself when one of its links is followed', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })
    await user.click(button)
    await user.click(screen.getByRole('link', { name: 'Moja članarina' }))

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(await screen.findByRole('heading', { level: 1, name: 'Moja članarina' })).toBeVisible()
  })

  it('signs out from the menu', async () => {
    const user = setupUser()
    renderAt('/sr/moj-profil', 'competitor', '000007')

    await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))
    await user.click(panelOf('Otvori nalog').getByRole('button', { name: 'Odjavi se' }))

    expect(screen.getByRole('heading', { name: 'Za ovo treba prijava' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Prijavi se' })).toBeVisible()
  })
})

/**
 * A MESSAGE THIS VISIT WROTE, put there by the one thing that still writes into the browser's
 * half of the inbox.
 *
 * <p><b>Both cases below wrote themselves until 28.09.2026 and neither of them knew it.</b> The
 * bundle seeded two broadcasts into every session (`data/seedMessages.ts`), so the held half
 * arrived free, one of them unread, and the counts and the order below were read off records
 * nobody had sent. The owner found them on QA - „Zasto su ove testne poruke i dalje tu??????
 * NECU MOCK PODATKE NIGDE" - and PDL 34 took them out of the shipped bundle.
 *
 * <p>What replaces them is the real road: `notify`, which nine screens call and which is the
 * only way a line lands in the browser's half now. Dated between the two rows the served
 * fixture holds, on purpose - see the case that reads the order.
 */
function WritesOneMessage() {
  const { notify } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        notify({
          from: 'Balkanska trkačka liga',
          /* To this member and not to the league, so the case cannot be satisfied by a
             message everybody would have got anyway. */
          to: '000007',
          subject: 'Profilna slika je vraćena',
          body: 'Pošalji sliku na kojoj ti se vidi lice.',
          date: '2026-08-15',
        })
      }}
    >
      napisi poruku ovom clanu
    </button>
  )
}

describe('the inbox in the header', () => {
  it('carries the number of unread messages in the name of the button', async () => {
    /* **THE CASE BRINGS THE UNREAD MESSAGE ITSELF (PDL 34, 28.09.2026).** It read „1" off a
       seeded record until that day, so the number came from the build rather than from
       anything a member had been sent. The served fixture the harness answers with holds two
       rows and both are read, so the one unread line here is the held one below and the count
       is a claim about both halves being counted. */
    renderInbox([
      {
        id: 'msg-1',
        from: 'Balkanska trkačka liga',
        to: '000007',
        subject: 'Profilna slika je vraćena',
        body: 'Pošalji sliku na kojoj ti se vidi lice.',
        date: '2026-08-15',
        read: false,
      },
    ])

    // The count is part of the name, not a counter nobody hears: an aria-label
    // replaces the contents of the button.
    expect(await screen.findByRole('button', { name: 'Otvori poruke, 1 nepročitana' })).toBeVisible()
  })

  it('lists what arrived, newest first, and opens one of them', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007', undefined, null, <WritesOneMessage />)

    await user.click(screen.getByRole('button', { name: 'napisi poruku ovom clanu' }))
    await user.click(await screen.findByRole('button', { name: /Otvori poruke/ }))

    /* **THE ORDER IS ASSERTED HERE, so the title above is a claim rather than a decoration.**
       The served half's own fixture (`test/mock/inbox.json`) sends one row dated after the
       message written above (2026-09-25) and one before it (2026-07-09), so the merged list
       only reads newest-first if both halves are sorted together - keeping either half's own
       order intact instead would pass with the served half first or the held half first, and
       neither is what „newest first" means. The date the button writes is chosen for exactly
       that, and it is the only thing about it that matters here.

       Each link's own text carries the date after the subject (`MessagesMenu.tsx` draws both
       inside the one link), so the expected strings below end in the day this panel shows -
       not a formatting choice made here, just what `textContent` already returns. */
    expect(
      screen.getAllByRole('link', { name: /Fotografija|Profilna|Prevoz/ }).map(
        (one) => one.textContent,
      ),
    ).toEqual([
      'Fotografija je prihvaćena25. 9. 2026.',
      'Profilna slika je vraćena15. 8. 2026.',
      'Prevoz do Jadovnika9. 7. 2026.',
    ])

    await user.click(screen.getByRole('link', { name: /Profilna slika je vraćena/ }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Profilna slika je vraćena' }),
    ).toBeVisible()
    // Reading it is what marks it read, so the header says nothing is waiting.
    expect(screen.getByRole('button', { name: 'Otvori poruke, 0 nepročitanih' })).toBeVisible()
  })

  it('leads to the whole inbox', async () => {
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007')

    await user.click(await screen.findByRole('button', { name: /Otvori poruke/ }))
    await user.click(screen.getByRole('link', { name: 'Sve poruke' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Poruke' })).toBeVisible()
  })

  /**
   * **NOTHING IN IT MEANS NOTHING ON EITHER SIDE, since 27.09.2026.**
   *
   * The panel read a list the session was holding until that day, so an empty session was the
   * whole of „empty". It reads `GET /api/inbox` now, and the fixture the harness serves has two
   * rows in it, so a case that emptied only the session would be asserting that the panel had
   * not finished loading.
   *
   * **And that is why the request is waited for rather than assumed.** `MessagesMenu` reads the
   * answer through `dataOr`, deliberately - a header that waited would hold up every screen
   * behind it - so „Nema poruka." is on the screen from the first paint whatever the server is
   * going to say. Asserted before the answer landed, this case would pass just as well against
   * a server that answered six messages.
   */
  it('says so when there is nothing in it, on either side', async () => {
    const user = setupUser()
    clearResourceCache()

    const { asked, stop } = serverThat((path) =>
      path === '/api/inbox'
        ? new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
        : null,
    )

    try {
      renderInbox([])

      await waitFor(() => {
        expect(asked.map((one) => one.path)).toContain('/api/inbox')
      })

      await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))

      expect(screen.getByText('Nema poruka.')).toBeVisible()
      expect(screen.getByRole('button', { name: 'Otvori poruke, 0 nepročitanih' })).toBeVisible()
    } finally {
      stop()
      clearResourceCache()
    }
  })

  /**
   * THE OTHER HALF OF THE CASE ABOVE, AND THE ONE THAT WOULD HAVE CAUGHT THE FAULT THE OWNER
   * MET.
   *
   * The session is empty here too, so everything on the screen came off `GET /api/inbox`. Take
   * the server read back out of `MessagesMenu` and this is what goes red: the panel that used to
   * be „empty" for exactly this session.
   */
  it('lists what the server kept, for a session holding nothing at all', async () => {
    const user = setupUser()
    renderInbox([])

    await user.click(
      await screen.findByRole('button', { name: 'Otvori poruke, 0 nepročitanih' }),
    )

    expect(await screen.findByRole('link', { name: /Fotografija je prihvaćena/ })).toBeVisible()
    expect(screen.getByRole('link', { name: /Prevoz do Jadovnika/ })).toBeVisible()
    expect(screen.queryByText('Nema poruka.')).not.toBeInTheDocument()
  })

  /**
   * AND THE ENVELOPE FOR AN ACCOUNT THAT RACES FOR NOBODY, which is a moderator and a
   * superadmin (PDL P21, owner 14.09.2026).
   *
   * `GET /api/inbox` answers such an account the way an address that is not there answers, so
   * the panel asks nothing at all and says there is nothing. **Measured as the ABSENCE of the
   * request and not only as an empty panel**, because an empty panel is what a refused request
   * would look like too, and the difference is a refusal spent on every moderator who signs in.
   */
  it('asks for no inbox at all for an account the league has given no number', async () => {
    const user = setupUser()
    clearResourceCache()

    const { asked, stop } = serverThat(() => null)

    try {
      renderInbox([], { as: 'account', account: 4 })

      await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))

      expect(screen.getByText('Nema poruka.')).toBeVisible()
      expect(asked.map((one) => one.path)).not.toContain('/api/inbox')
    } finally {
      stop()
      clearResourceCache()
    }
  })
})

describe('the icons', () => {
  it('draws the envelope as a picture that carries no name of its own', () => {
    const { container } = render(<MailIcon className="inbox__glyph" />)
    const drawing = container.firstElementChild

    expect(drawing?.tagName).toBe('svg')
    // The meaning is in the label of the control the icon sits in, never in the
    // icon, so assistive technology is told to skip it.
    expect(drawing).toHaveAttribute('aria-hidden', 'true')
  })
})

/* Who the panel is drawn for, as well as what it is holding. The second argument is here
   because the envelope is drawn for EVERY signed in account (`app/Shell.tsx`) while the inbox
   belongs only to somebody the league has given a number, and the two states of that are what
   decides whether anything is asked for at all. */
function renderInbox(inbox: Message[], who: SignedIn = { as: 'member', memberNumber: '000007' }) {
  const session: SessionValue = {
    /* Kept in step with the arm above rather than written out, because „an account that races
       for nobody" is exactly a session with no member number, and a helper that set one anyway
       would be building a state the provider cannot produce. */
    memberNumber: who.as === 'member' ? who.memberNumber : null,
    signIn: vi.fn(),
    account: null,
    theServerSignedMeIn: vi.fn(),
    myMembershipBasis: null,
    /* Null all three, because this session is built for a screen that reads none of
       them: what „Moja članarina" gets off `GET /api/me` since 25.09.2026 has no
       reader here. Named rather than left out because the type names them, which is the
       only thing that tells anybody a field was added to the answer. */
    myCountry: null,
    myFirstSeason: null,
    myTeamId: null,
    myReferralCode: null,
    myReferredCount: null,
    signedIn: who,
    signOut: vi.fn(),
    submissions: [],
    corrected: {},
    withdraw: vi.fn(),
    invitations: [],
    invite: vi.fn(),
    pairInvites: [],
    invitePair: vi.fn(),
    closePairInvite: vi.fn(),
    pairsMade: [],
    pairsBroken: [],
    makePair: vi.fn(),
    breakPair: vi.fn(),
    close: vi.fn(),
  amend: vi.fn(),
    submit: vi.fn(),
    resubmit: vi.fn(),
    decide: vi.fn(),
    inbox,
    applications: [],
    apply: vi.fn(),
    answer: vi.fn(),
    going: {},
    setGoing: vi.fn(),
    markRead: vi.fn(),
    notify: vi.fn(),
    edits: {},
    edit: vi.fn(),
    editRecord: vi.fn(),
    creations: {},
    create: vi.fn(),
    rights: {},
    setRight: vi.fn(),
    decisions: {},
    settle: vi.fn(),
    deletions: {},
    remove: vi.fn(),
    proposals: [],
    propose: vi.fn(),
    pictureSent: null,
    sendPicture: vi.fn(),
    published: [],
    publish: vi.fn(),
  }

  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>
        <SessionContext.Provider value={session}>
          <MessagesMenu />
        </SessionContext.Provider>
      </MemoryRouter>
    </I18nProvider>,
  )
}
