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
        asks: { kind: 'teamJoin', teamId: team === 'Dunavski trkači' ? 'team-dunav' : '', teamName: team, memberNumber: from },
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

  it('is not offered on a message that only tells', async () => {
    /* Most messages tell. The two the inbox starts with carry no question, so nothing on
       them may be pressed, and the words that answer one must not appear. */
    renderAt('/sr/poruke/msg-1', 'competitor', '000001', undefined, DAY)


    expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
    expect(screen.queryByText('Odgovoreno.')).toBeNull()
  })
})
