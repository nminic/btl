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
const VARDAR = '/sr/tim/vardarski-krug'

/* What the two controls are called, now that each carries the name of whoever it answers
   about. 000002 is Relja Momčilović. */
const TAKE = 'Primi u tim: Relja Momčilović'
const REFUSE = 'Odbij: Relja Momčilović'

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
    await router.navigate(VARDAR)

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
    await router.navigate(VARDAR)

    expect(await screen.findByRole('button', { name: 'Prijavi se u tim' })).toBeVisible()
  }, SLOW)

  it('can still be taken back once the member has a team by another road', async () => {
    /* **The way out shared its conditions with the way in, so it vanished whenever they
       changed** (review, 06.09.2026). Here a team arrives by another road while the
       application waits, which administration and the moderator's queue both do. Ending
       what you started may not depend on whether you could start it again. */
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <Given who="000002" team="team-vardar" />,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'daj tim 000002' }))

    expect(await screen.findByRole('button', { name: 'Povuci prijavu' })).toBeVisible()
  }, SLOW)

  it('can still be taken back after the window has shut', async () => {
    /* Outside the window an application simply waits, which is what one door for every
       change of team means. Waiting is not being stuck: drawn inside the window check, in
       June the member had an application and nothing that could end it. */
    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      SHUT,
      <Applied who="000002" team="team-dunav" day={DAY} />,
    )

    return screen.findByRole('button', { name: 'Povuci prijavu' }).then((one) => {
      expect(one).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
    })
  })

  it('stops counting when the team it was sent to is deleted, so the member is free', async () => {
    /* **The worst of the three.** The team is deleted by the control 133c put on this very
       page. Written as it was, the application stayed open, no other team offered a way in
       because the member was waiting, and no page offered a way out because the team was
       gone: 000002 was outside every team on the portal for good (review, 06.09.2026). An
       application about a team that is not there is about nothing. */
    const user = setupUser()
    const { router } = renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <Folded team="team-dunav" />,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'obriši team-dunav' }))
    await router.navigate(VARDAR)

    expect(await screen.findByRole('button', { name: 'Prijavi se u tim' })).toBeVisible()
  }, SLOW)

  it('keeps its own identity when an earlier one has been taken back', async () => {
    /* **Two applications answered to one identity** while the id was counted from how many
       there are, and `answer` shortens that very list (review, 06.09.2026). Add, add, take
       one back, add again: the fourth is handed the number the second holds, and taking
       either back takes both. The team the other was sent to never saw it go.

       000002 asks Dunav, 000004 asks Vardar, 000002 takes theirs back and asks again, then
       000004 takes theirs back. If the two share an id, 000002 is left with nothing. */
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <>
        <Also who="000004" team="team-vardar" day={DAY} />
        <Answered who="000004" />
      </>,
    )

    /* Add, add, take the first back, add again: the fourth is handed the number the second
       holds while the count is read off the length. All of it on one page, because six
       steps through three addresses did not reach the end and the case then measured
       something else (measured 06.09.2026). */
    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'prijavi 000004' }))
    await user.click(await screen.findByRole('button', { name: 'Povuci prijavu' }))
    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))

    /* Vardar answers the one it was sent. If the two share an identity, this takes 000002's
       with it and leaves them with nothing they ever asked to end. */
    await user.click(screen.getByRole('button', { name: 'odgovori 000004' }))

    expect(await screen.findByRole('button', { name: 'Povuci prijavu' })).toBeVisible()
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

/** A member who has come by a team some other way while their application waited. The
 *  moderator approving a team they proposed writes exactly this
 *  (`admin/PendingQueue.tsx`), and so does administration editing their record. */
function Given({ who, team }: { who: string; team: string }) {
  const { editRecord } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        editRecord(who, { teamId: team, teamSince: '2027' })
      }}
    >
      daj tim {who}
    </button>
  )
}

/** A second application, filed the way the screen files one, on behalf of somebody who is
 *  not the member reading this page. */
function Also({ who, team, day }: { who: string; team: string; day: string }) {
  const { apply } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        apply({ teamId: team, memberNumber: who, date: day })
      }}
    >
      prijavi {who}
    </button>
  )
}

/** That other application answered, the way the team answers one: by the identity it
 *  carries. */
function Answered({ who }: { who: string }) {
  const { applications, answer } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        applications
          .filter((one) => one.memberNumber === who)
          .forEach((one) => {
            answer(one.id)
          })
      }}
    >
      odgovori {who}
    </button>
  )
}

/** A team deleted during this same visit, which the control 133c put on this very page
 *  does. On a button and not on mounting, because the application has to exist before the
 *  team stops doing so. */
function Folded({ team }: { team: string }) {
  const { remove } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        remove('teams', team)
      }}
    >
      obriši {team}
    </button>
  )
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
    expect(screen.queryByRole('button', { name: TAKE })).toBeNull()
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

    await user.click(await screen.findByRole('button', { name: TAKE }))

    const written = within(screen.getByRole('list', { name: 'session records' }))

    expect(written.getByText(/000002.*team-dunav/)).toBeVisible()
    expect(written.getByText(/000002.*2027/)).toBeVisible()
    /* And the question is over: it is not waiting on this team any more. */
    expect(screen.queryByRole('button', { name: TAKE })).toBeNull()
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
    await user.click(await screen.findByRole('button', { name: REFUSE }))

    const written = within(screen.getByRole('list', { name: 'session records' }))

    expect(written.queryByText(/000002.*team-dunav/)).toBeNull()
    expect(screen.queryByRole('button', { name: REFUSE })).toBeNull()
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
    expect(screen.queryByRole('button', { name: TAKE })).toBeNull()
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
    expect(screen.queryByRole('button', { name: TAKE })).toBeNull()
    /* And no heading over an empty list: it announced applications that were not
       there (review, 06.09.2026). */
    expect(screen.queryByText('Prijave koje čekaju')).toBeNull()
    /* And no heading over an empty list: it announced applications that were not there
       (review, 06.09.2026). */
    expect(screen.queryByText('Prijave koje čekaju')).toBeNull()
  }, SLOW)

  it('is not asked about somebody who has come by a team since they asked', async () => {
    /* An application waits, and in the meantime the member is in a team by another road:
       administration edits their record, or the moderator approves the team they proposed
       (`admin/PendingQueue.tsx` writes the same field). Drawn all the same, taking it moves
       them out of that team without that team ever being asked, which is the one thing
       P13 makes impossible everywhere else. */
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <>
        <Given who="000002" team="team-vardar" />
        <Become who="000001" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'daj tim 000002' }))
    await user.click(screen.getByRole('button', { name: 'postani 000001' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })).toBeVisible()
    expect(screen.queryByRole('button', { name: TAKE })).toBeNull()
    /* And no heading over an empty list: it announced applications that were not
       there (review, 06.09.2026). */
    expect(screen.queryByText('Prijave koje čekaju')).toBeNull()
  }, SLOW)

  it('reaches whoever runs the team now, not merely away from whoever ran it before', async () => {
    /* The other half of „follows the team rather than the person", and the half no case
       measured (review, 06.09.2026): that the **new** administrator is asked. Without it
       `runs === memberNumber` could be narrowed back to the founder and the application
       would wait for ever with nobody able to answer, and the package stayed green.
       000001 founded Dunav and leaves; 000007 is then its longest serving member. */
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <>
        <Become who="000007" />
        <Left who="000001" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000007' }))

    expect(await screen.findByRole('button', { name: TAKE })).toBeVisible()
  }, SLOW)

  it('is asked of the team it was sent to and of no other', async () => {
    /* The filter by team had no case that fell when it was taken away: without it the
       administrator of one team answered about somebody who had asked another, and taking
       them wrote the wrong team onto their record (review, 06.09.2026). 000003 runs
       Vardar; this application went to Dunav. */
    const user = setupUser()
    const { router } = renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <Become who="000003" />,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))
    await router.navigate(VARDAR)

    await screen.findByRole('heading', { level: 1, name: 'Vardarski krug' })

    expect(screen.queryByText('Prijave koje čekaju')).toBeNull()
    expect(screen.queryByRole('button', { name: TAKE })).toBeNull()
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
      expect(screen.queryByRole('button', { name: TAKE })).toBeNull()
    })
  })
})
