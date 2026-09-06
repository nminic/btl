import { useEffect, useRef } from 'react'
import { screen, within } from '@testing-library/react'
import { renderAt } from '../test/render'
import { Saved } from '../test/saved'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useSession } from '../session/useSession'

/* A member asking to be let into a team, and the team answering.
 *
 * Owner, 05.09.2026: „član vidi dugme 'Prijavi se u tim' na strani tima, samo tokom
 * prelaznog perioda", and on who answers: the application is decided by the administrator
 * of that team and by nobody else, because who is in whose team is not the league's
 * business.
 *
 * **An application is a record about the team, not a letter to a person**, and every case
 * here is about what follows from that. Written as a letter it went to whoever ran the
 * team at the moment it was sent: a founder who left went on deciding while the one who
 * really ran the team never saw it, and an application nobody could answer waited for ever
 * and kept the member out of every team on the portal (reviews, 05. and 06.09.2026).
 *
 * 000002 (Relja Momčilović) has no team, so he asks. Dunavski trkači is run by 000001.
 */

/** A day inside the transfer window, which is the only time any of this is offered. */
const DAY = '2026-10-15'
/** And one outside it. */
const SHUT = '2026-06-15'

const DUNAV = '/sr/tim/dunavski-trkaci'

describe('the way a member asks to be let into a team', () => {
  it('is offered inside the window to somebody with no team, and asked once', async () => {
    const user = setupUser()

    renderAt(DUNAV, 'competitor', '000002', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))

    /* Asked once, and the way to take it back stands where the way in stood. */
    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Povuci prijavu' })).toBeVisible()
  }, SLOW)

  it('is not offered on a second team while one application is waiting', async () => {
    /* A member is in one team (PDL P13), so they wait on one. Counted per team instead,
       one member stood before two teams at once and each answered without knowing of the
       other (review, 05.09.2026). */
    const user = setupUser()
    const { router } = renderAt(DUNAV, 'competitor', '000002', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await router.navigate('/sr/tim/vardarski-krug')

    await screen.findByRole('heading', { level: 1, name: 'Vardarski krug' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
    /* And the way back out is on the team it was sent to, not on this one. */
    expect(screen.queryByRole('button', { name: 'Povuci prijavu' })).toBeNull()
  }, SLOW)

  it('can be taken back by the member who sent it, which is how it always has an ending', async () => {
    /* The one ending that needs nobody else. Whatever happens to the team, the member is
       never left waiting on something that cannot be answered. */
    const user = setupUser()
    const { router } = renderAt(DUNAV, 'competitor', '000002', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'Povuci prijavu' }))

    expect(await screen.findByRole('button', { name: 'Prijavi se u tim' })).toBeVisible()

    /* And they are free on every other team again, which is what „waiting" was keeping
       them from. */
    await router.navigate('/sr/tim/vardarski-krug')

    expect(await screen.findByRole('button', { name: 'Prijavi se u tim' })).toBeVisible()
  }, SLOW)

  it('is not offered outside the transfer window', async () => {
    renderAt(DUNAV, 'competitor', '000002', undefined, SHUT)

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })

  it('is not offered to somebody who is already in a team', async () => {
    renderAt('/sr/tim/nisavski-maraton-klub', 'competitor', '000007', undefined, DAY)

    await screen.findByRole('heading', { level: 1, name: 'Nišavski maraton klub' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })

  it('is not offered on a team nobody is in, because there is nobody to answer', async () => {
    renderAt('/sr/tim/novoosnovani-tim', 'competitor', '000002', undefined, DAY)

    await screen.findByRole('heading', { level: 1, name: 'Novoosnovani tim' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })

  it('is not offered to a visitor, who has no record to be in a team at all', async () => {
    renderAt(DUNAV, 'visitor', null, undefined, DAY)

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })
})

/** A way to become somebody else inside one visit, because an application is answered by
 *  a different member than the one who sent it and both stand on the same page. */
function Become({ who }: { who: string }) {
  const { signIn } = useSession()

  return (
    <button type="button" onClick={() => { signIn(who) }}>
      postani {who}
    </button>
  )
}

/** A member who has moved to another team during this same visit, so the roster of the one
 *  they founded names somebody else. */
function Left({ who }: { who: string }) {
  const { editRecord } = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      editRecord(who, { teamId: 'team-vardar', teamSince: '2020' })
    }
  }, [editRecord, who])

  return null
}

/** A member administration has deleted during this same visit. */
function Erased({ who }: { who: string }) {
  const { remove } = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      remove('members', who)
    }
  }, [remove, who])

  return null
}

/** An application already open, filed the way the screen files one, so the answering side
 *  can be measured on a day when nobody could have sent it. */
function Applied({ who, team, day }: { who: string; team: string; day: string }) {
  const { apply } = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      apply({ teamId: team, memberNumber: who, date: day })
    }
  }, [apply, who, team, day])

  return null
}

describe('the answer the team gives', () => {
  it('is drawn for whoever runs the team, and for nobody else', async () => {
    /* The whole of why this is a record about the team: who may answer is worked out from
       the roster where it is drawn, every time. 000007 runs for Dunav and does not
       administer it, so nothing waiting is shown to them. */
    const user = setupUser()

    renderAt(DUNAV, 'competitor', '000002', undefined, DAY, <Become who="000007" />)

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000007' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })).toBeVisible()
    expect(screen.queryByText('Prijave koje čekaju')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
  }, SLOW)

  it('lets the member in from the next season, which is when a team scores', async () => {
    /* PDL, 05.09.2026: „obračun poena tima počinje tek od 1.1. naredne sezone", so the
       season written is the one being sold, exactly as an approval in the moderator's
       queue writes it, because it is the same fact by another road. */
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <>
        <Become who="000001" />
        <Saved />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000001' }))

    await user.click(await screen.findByRole('button', { name: 'Primi u tim' }))

    const written = within(screen.getByRole('list', { name: 'session records' }))

    expect(written.getByText(/000002.*team-dunav/)).toBeVisible()
    expect(written.getByText(/000002.*2027/)).toBeVisible()
    /* And the question is over: it is not waiting on this team any more. */
    expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
  }, SLOW)

  it('refuses without putting anybody in the team, and the question is over either way', async () => {
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <>
        <Become who="000001" />
        <Saved />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000001' }))
    await user.click(await screen.findByRole('button', { name: 'Odbij' }))

    const written = within(screen.getByRole('list', { name: 'session records' }))

    expect(written.queryByText(/000002.*team-dunav/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Odbij' })).toBeNull()
  }, SLOW)

  it('follows the team rather than the person, when the one who ran it leaves', async () => {
    /* **The fault the letter had, measured.** The application was sent while 000001 ran
       Dunav. 000001 then moves to another team, so the roster names somebody else, and it
       is that somebody who is asked. Sent as a letter, it stayed in the old
       administrator's inbox and the new one never saw it (review, 06.09.2026). */
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <>
        <Become who="000001" />
        <Left who="000001" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000001' }))

    /* 000001 is out of the team now, so they no longer answer for it. */
    expect(await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
  }, SLOW)

  it('is not asked about somebody administration has deleted since they asked', async () => {
    /* Nothing stops a member being deleted while their application waits. Drawn all the
       same, the team was asked about a person who is no longer in the league, and taking
       it wrote a team onto a record that is gone (review, 06.09.2026). */
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <>
        <Become who="000001" />
        <Erased who="000002" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000001' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
  }, SLOW)

  it('is not given outside the window, because the answer is what writes the season', () => {
    /* `seasonOnSale` gives the next season only inside the window; answered in June the
       same expression writes the running one, which would put the member into this year's
       team with every result they have already run this year (review, 05.09.2026). Outside
       it the application simply waits, which is what one window for every change of team
       means (owner, 05.09.2026). */
    renderAt(
      DUNAV,
      'competitor',
      '000001',
      undefined,
      SHUT,
      <Applied who="000002" team="team-dunav" day={DAY} />,
    )

    return screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' }).then(() => {
      expect(screen.queryByText('Prijave koje čekaju')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Primi u tim' })).toBeNull()
    })
  })
})
