import { useEffect, useRef } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import { renderAt } from '../test/render'
import { Saved } from '../test/saved'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useSession } from '../session/useSession'

/* A member asking to be let into a team, and the answer coming back.
 *
 * Owner, 05.09.2026: „član vidi dugme 'Prijavi se u tim' na strani tima, samo tokom
 * prelaznog perioda", and on who answers it, the same day: the application is decided by
 * the administrator of that team, and it travels through the inbox the portal already
 * has, not through the moderator's queue. Who is in whose team is not the league's
 * business.
 *
 * 000002 (Relja Momčilović) has no team, so he is the one who asks. Dunavski trkači is
 * administered by 000001, so that is who answers. Novoosnovani tim has nobody in it at
 * all, which is the team an application cannot be made to.
 */

/** A day inside the transfer window, which is the only time this is offered. */
const DAY = '2026-10-15'
/** And one outside it. */
const SHUT = '2026-06-15'

/* Where an application lands, and how it is opened. The inbox starts with two messages,
   so the third written during a visit answers at this address. It is reached by going
   there once the letter exists: asked for straight away, the address answers with the
   page for a message nobody has, which is right and is not what is being measured here. */
const APPLICATION = '/sr/poruke/msg-3'

async function opened(router: { navigate: (to: string) => Promise<void> }) {
  /* The letter is drawn twice, in the panel of the header and in the inbox itself, so it
     is asked for as many rather than as one. */
  await screen.findAllByText(/se prijavljuje u tim/)
  await router.navigate(APPLICATION)
}

/** The teams these walks are about, by the name the letter carries. Anything else is an
 *  identity nothing answers to, which is its own case. */
const TEAMS: Record<string, string> = {
  'Dunavski trkači': 'team-dunav',
  'Novoosnovani tim': 'team-novi',
}

/** An application already sent, written by the portal's own road rather than by a click,
 *  so the answering side can be measured without two members in one visit. */
function Sent({ from, team, name }: { from: string; team: string; name: string }) {
  const { notify } = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      notify({
        from: 'Balkanska trkačka liga',
        to: '000001',
        subject: `${name} se prijavljuje u tim`,
        body: `${name} traži da uđe u tim „${team}".`,
        date: DAY,
        asks: {
          kind: 'teamJoin',
          teamId: TEAMS[team] ?? 'team-nema',
          teamName: team,
          memberNumber: from,
        },
      })
    }
  }, [notify, from, team, name])

  return null
}

describe('the way a member asks to be let into a team', () => {
  it('is offered on the team page, inside the transfer window, to somebody with no team', async () => {
    const user = setupUser()

    renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000002', undefined, DAY)

    const ask = await screen.findByRole('button', { name: 'Prijavi se u tim' })

    expect(ask).toBeVisible()

    await user.click(ask)

    /* And once, which is the whole of why the screen knows what has been asked: the
       application waits in somebody else's inbox, which the member who sent it cannot
       see, so without that the same letter would go again on every press. */
    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
    expect(screen.getByText('Prijava je poslata')).toBeVisible()
  }, SLOW)

  it('is not offered on a second team once one application is waiting', async () => {
    /* **One application at a time, and about the member rather than about the team.**
       Counted per team, one member stood in two inboxes at once and two administrators
       each answered without knowing of the other: the second answer pulled the member out
       of the team the first had just put them into, and neither team had been asked
       (review, 05.09.2026). */
    const user = setupUser()
    const { router } = renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000002', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await router.navigate('/sr/tim/vardarski-krug')

    await screen.findByRole('heading', { level: 1, name: 'Vardarski krug' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
    expect(screen.getByText('Prijava je poslata')).toBeVisible()
  }, SLOW)

  it('is not offered outside the transfer window', async () => {
    /* The same member and the same team, on a day in June. A team changes in one window
       and in no other (owner, 05.09.2026), which is the same rule that governs founding
       one. */
    renderAt('/sr/tim/dunavski-trkaci', 'competitor', '000002', undefined, SHUT)

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })

  it('is not offered to somebody who is already in a team', async () => {
    /* 000007 runs for Dunav. A member is in one team (PDL P13), so there is nothing for
       this button to do for them, on their own team or on anybody else's. */
    renderAt('/sr/tim/nisavski-maraton-klub', 'competitor', '000007', undefined, DAY)

    await screen.findByRole('heading', { level: 1, name: 'Nišavski maraton klub' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })

  it('is not offered on a team nobody is in, because there is nobody to answer', async () => {
    /* Novoosnovani tim has no members and no organiser, so `teamAdminOf` answers nobody.
       An application to it would be a letter with no recipient, and the portal would have
       to invent one. */
    renderAt('/sr/tim/novoosnovani-tim', 'competitor', '000002', undefined, DAY)

    await screen.findByRole('heading', { level: 1, name: 'Novoosnovani tim' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })

  it('is not offered to a visitor, who has no record to be in a team at all', async () => {
    renderAt('/sr/tim/dunavski-trkaci', 'visitor', null, undefined, DAY)

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })
})

/** A member who has taken a team during this same visit, written the way an approval in
 *  the queue writes it: into the session and nowhere else. */
function Joined({ who, team }: { who: string; team: string }) {
  const { editRecord } = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      editRecord(who, { teamId: team, teamSince: '2027' })
    }
  }, [editRecord, who, team])

  return null
}

/** A way to become somebody else inside one visit, for the cases that measure what the
 *  other side of a letter receives. */
function Become({ who }: { who: string }) {
  const { signIn } = useSession()

  return (
    <button type="button" onClick={() => { signIn(who) }}>
      postani {who}
    </button>
  )
}

describe('the answer the administrator of the team gives', () => {
  it('lets the member in, and from the next season, which is when a team scores', async () => {
    /* PDL, 05.09.2026: „obračun poena tima počinje tek od 1.1. naredne sezone." So the
       season written on the member is the one being sold, exactly as an approval in the
       moderator's queue writes it, because it is the same fact arriving by another road. */
    const user = setupUser()

    const { router } = renderAt(
      '/sr/poruke',
      'competitor',
      '000001',
      undefined,
      DAY,
      <>
        <Sent from="000002" team="Dunavski trkači" name="Relja Momčilović" />
        <Saved />
      </>,
    )

    await opened(router)
    await user.click(await screen.findByRole('button', { name: 'Primi u tim' }))

    const written = within(await screen.findByRole('list', { name: 'session records' }))

    expect(written.getByText(/000002.*team-dunav/)).toBeVisible()
    expect(written.getByText(/000002.*2027/)).toBeVisible()
  }, SLOW)

  it('is given once, and the message says so afterwards', async () => {
    const user = setupUser()

    const { router } = renderAt(
      '/sr/poruke',
      'competitor',
      '000001',
      undefined,
      DAY,
      <Sent from="000002" team="Dunavski trkači" name="Relja Momčilović" />,
    )

    await opened(router)
    await user.click(await screen.findByRole('button', { name: 'Primi u tim' }))

    /* Both controls go, because the question has an answer now, and the message says the
       answer was given rather than falling silent. */
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
    })

    expect(screen.queryByRole('button', { name: 'Odbij' })).toBeNull()
    expect(screen.getByText('Odgovoreno.')).toBeVisible()
  }, SLOW)

  it('refuses without putting anybody in the team', async () => {
    const user = setupUser()

    const { router } = renderAt(
      '/sr/poruke',
      'competitor',
      '000001',
      undefined,
      DAY,
      <>
        <Sent from="000002" team="Dunavski trkači" name="Relja Momčilović" />
        <Saved />
      </>,
    )

    await opened(router)
    await user.click(await screen.findByRole('button', { name: 'Odbij' }))

    await screen.findByText('Odgovoreno.')

    /* Nothing was written about anybody's team, which is the difference between the two
       answers and the only thing that separates them. */
    const written = within(screen.getByRole('list', { name: 'session records' }))

    expect(written.queryByText(/team-dunav/)).toBeNull()
  }, SLOW)

  it('says why instead of offering an answer, when the team is gone', async () => {
    /* The application waits in an inbox and the portal moves underneath it: deleting a
       team is free until the end of the year (owner, 05.09.2026), so an administrator can
       delete theirs and then open an application to it. Answered all the same, that put a
       member into an identity nothing answers to, and left them unable to join any team or
       found one (review, 05.09.2026). */
    const { router } = renderAt(
      '/sr/poruke',
      'competitor',
      '000001',
      undefined,
      DAY,
      <Sent from="000002" team="Tim kog nema" name="Relja Momčilović" />,
    )

    await opened(router)

    expect(await screen.findByText('Ovog tima više nema, pa se prijava ne može primiti.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Odbij' })).toBeNull()
  }, SLOW)

  it('says why, when the member took a team during this same visit', async () => {
    /* **This is what says the members are read through the session and not off the file.**
       Who is in a team is written into the session by an approval and nowhere else until
       there is a database, so read from the file the answer went on saying „they have no
       team" and pulled them out of the one they had just been given (review, 05.09.2026).
       Both readings pass every other case in this file, which is why this one exists. */
    const { router } = renderAt(
      '/sr/poruke',
      'competitor',
      '000001',
      undefined,
      DAY,
      <>
        <Sent from="000002" team="Dunavski trkači" name="Relja Momčilović" />
        <Joined who="000002" team="team-vardar" />
      </>,
    )

    await opened(router)

    expect(await screen.findByText('Ovaj član je u međuvremenu ušao u drugi tim.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
  }, SLOW)

  it('says why, when the administrator deleted the team while the letter waited', async () => {
    /* And this is what says the teams are read the same way: the team goes during this
       visit and nowhere else, so read off the file it is still there and the answer wrote
       an identity nothing answers to. Deleting is free until the end of the year (owner,
       05.09.2026), so this is a walk a member really takes. */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/tim/dunavski-trkaci',
      'competitor',
      '000001',
      undefined,
      DAY,
      <Sent from="000002" team="Dunavski trkači" name="Relja Momčilović" />,
    )

    await user.click(await screen.findByRole('button', { name: /^Obriši: Dunavski trkači/ }))
    await user.click(screen.getByRole('button', { name: /^Potvrdi brisanje: Dunavski trkači/ }))

    await router.navigate(APPLICATION)

    expect(
      await screen.findByText('Ovog tima više nema, pa se prijava ne može primiti.'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
  }, SLOW)

  it('keeps the letter readable while the teams it asks about are on their way', async () => {
    /* The letter is drawn above the two sources this screen reads to know whether the
       question may still be answered. Written without `inline`, the loader is a sheet over
       the whole page: it dims the letter a reader is already reading and lets nothing be
       pressed, which is meant for a page with nothing on it yet (review, 06.09.2026). The
       same measurement three other screens carry (`resourceScope.test.tsx`). */
    const real = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL) =>
      String(input).endsWith('/competitors.json')
        ? new Promise<Response>(() => {})
        : real(input)

    try {
      const { router } = renderAt(
        '/sr/poruke',
        'competitor',
        '000001',
        undefined,
        DAY,
        <Sent from="000002" team="Dunavski trkači" name="Relja Momčilović" />,
      )

      await opened(router)

      expect(await screen.findByRole('heading', { level: 1, name: /se prijavljuje/ })).toBeVisible()
      expect(document.querySelector('.loader:not(.loader--inline)')).toBeNull()
    } finally {
      globalThis.fetch = real
    }
  }, SLOW)

  it('can be closed when it can no longer be taken, so nobody stays locked out', async () => {
    /* **A question with no answer never ends.** „Waiting" is read off the decisions, and an
       application that cannot be taken had no road to one: it counted for ever, and the
       member who sent it was refused the way in on every team on the portal (review,
       06.09.2026). Closing it is a refusal like any other, and the member is free to ask
       again. */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/poruke',
      'competitor',
      '000001',
      undefined,
      DAY,
      <>
        <Sent from="000002" team="Dunavski trkači" name="Relja Momčilović" />
        <Joined who="000002" team="team-vardar" />
        <Become who="000002" />
      </>,
    )

    await opened(router)
    await user.click(await screen.findByRole('button', { name: 'Zatvori prijavu' }))

    expect(await screen.findByText('Odgovoreno.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Zatvori prijavu' })).toBeNull()

    /* **And the member is told, in words the team did not say.** The team never saw this
       application, so „nije prihvatio tvoju prijavu" would put a refusal in its mouth; what
       is true is that nobody could answer it (review, 06.09.2026). Read from the other side
       of the letter, which is the only place it can be read. */
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))

    /* The letter is in the panel of the header the moment it is theirs, which is where a
       member meets one; the words of it are on its own page. */
    expect(await screen.findAllByText(/Prijava u tim .* je zatvorena/)).not.toHaveLength(0)

    await router.navigate('/sr/poruke/msg-4')

    expect(await screen.findByText(/nije imao ko da odluči/)).toBeVisible()
  }, SLOW)

  it('is not offered while the reason is only that the window has shut', async () => {
    /* The window opens again on 1 October and the application is answered then. A control
       that ended it here would turn nine weeks of waiting into a refusal nobody meant. */
    const { router } = renderAt(
      '/sr/poruke',
      'competitor',
      '000001',
      undefined,
      SHUT,
      <Sent from="000002" team="Dunavski trkači" name="Relja Momčilović" />,
    )

    await opened(router)

    expect(await screen.findByText(/Prelazni rok je zatvoren/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Zatvori prijavu' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
  }, SLOW)

  it('lets the member ask again once the application has been closed', async () => {
    /* The whole point of an ending: „waiting" is read off the decisions, so an application
       that could not be answered kept the member out of every team on the portal until it
       was settled. Measured on the screen the member actually presses. */
    /* **Asked of a member who still has no team**, or nothing would be measured: with a
       team of their own the way in is not drawn for that reason and the sentence about a
       waiting application never appears either. So the application here is one nobody can
       answer for another reason: it is addressed about a team nobody is in. */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/poruke',
      'competitor',
      '000001',
      undefined,
      DAY,
      <>
        <Sent from="000002" team="Novoosnovani tim" name="Relja Momčilović" />
        <Become who="000002" />
      </>,
    )

    await opened(router)
    await user.click(await screen.findByRole('button', { name: 'Zatvori prijavu' }))
    await screen.findByText('Odgovoreno.')
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))

    await router.navigate('/sr/tim/dunavski-trkaci')

    expect(await screen.findByRole('button', { name: 'Prijavi se u tim' })).toBeVisible()
    expect(screen.queryByText('Prijava je poslata')).toBeNull()
  }, SLOW)

  it('is not offered on a message that only tells', async () => {
    /* Most messages tell. The two the inbox starts with carry no question, so nothing on
       them may be pressed, and the words that answer one must not appear. */
    renderAt('/sr/poruke/msg-1', 'competitor', '000001', undefined, DAY)


    expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
    expect(screen.queryByText('Odgovoreno.')).toBeNull()
  })
})
