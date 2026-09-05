import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { Saved } from '../../test/saved'
import { setupUser } from '../../test/user'

/* A team put forward by a member, and the queue that has been waiting for one.
 *
 * The queue of new teams was written with the rest of the eight and nothing
 * could ever put anything in it: teams arrived one way only, entered by an
 * administrator (owner, 03.08.2026).
 */

/** A day inside the transfer window, 1 October to 31 December, which is when a team
 *  may be founded at all (PDL, increment 133, 05.09.2026). Every signed-in reading in
 *  this file is on it, so what each case measures is its own subject rather than the
 *  day it happened to run on. */
const DAY = '2026-10-15'

describe('the way to propose a team', () => {
  it('is offered to a member who is in no team, on the standing of the teams', async () => {
    /* Member 000002 runs alone: `teamId` is null on their record. Somebody with
       a team has nothing to do with this button, and what they can do is on their
       own team's page (owner, 04.09.2026). */
    renderAt('/sr/timovi', 'competitor', '000002', undefined, DAY)

    expect(await screen.findByRole('link', { name: 'Predloži tim' })).toBeVisible()
  })

  it('is not offered to a member who already has one', async () => {
    /* The half of the same decision that takes something away: 000007 is in Dunav,
       and until 04.09.2026 every signed-in member saw this. Named by the member and
       not by the count of teams, because a member joins and leaves a team through
       the season and the button has to follow that, not the table. */
    renderAt('/sr/timovi', 'competitor', '000007', undefined, DAY)

    await screen.findByRole('table', { name: 'Timovi' })
    expect(screen.queryByRole('link', { name: 'Predloži tim' })).toBeNull()
  })

  it('is not offered to somebody who is not signed in', async () => {
    renderAt('/sr/timovi')

    await screen.findByRole('table', { name: 'Timovi' })
    expect(screen.queryByRole('link', { name: 'Predloži tim' })).toBeNull()
  })

  it('sends a member who already has a team to the front page', async () => {
    /* A hidden button is not a rule. This address is in a member's history and in
       their bookmarks, and reached from either the form used to send a proposal
       that, approved, made them the organiser of a second team — against PDL P13,
       „član sme da bude samo u jednom timu istovremeno" (review, 04.09.2026).

       **Away rather than explained.** Owner, 05.09.2026: „Ako neko proba deeplink za
       pravljenje tima iako ima tim, treba da se preusmeri na homepage." A screen
       explaining the refusal stood here for one day. Asked of the address the router
       ends on and not only of what is drawn: the front page has a heading like every
       other page, so a heading alone would pass over a screen that never redirected. */
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000007', undefined, DAY)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(screen.queryByLabelText(/Naziv tima/)).toBeNull()
  })

  it('refuses a member whose team starts next season, and the standing agrees they are not in one yet', async () => {
    /* The boundary, in both directions and in one case. 000031 joined Dunav for
       2027 (`teamSince`), so on a day in 2026 the portal counts them out of the
       team: `inTeamIn` is what the member count and the roster read, and neither
       names them. The door still refuses them, because founding a team now would
       leave them in two of them on 1 January, which is what P13 forbids.

       So the two readings of „is in a team" are both right and answer different
       questions: the standing asks about a season, the door asks whether there is a
       team on the record at all. Measured here rather than argued, because a review
       measured that the portal can be made to say both (04.09.2026). */
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000031', undefined, DAY)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(screen.queryByLabelText(/Naziv tima/)).toBeNull()

    await router.navigate('/sr/timovi')
    await screen.findByRole('table', { name: 'Timovi' })

    expect(screen.queryByRole('link', { name: 'Predloži tim' })).toBeNull()
  })

  it('refuses them on a day two seasons before their team begins, too', async () => {
    /* The same member read a year earlier, and this is what pins the decision rather
       than merely stating it. Read as a season, the door has to choose **which**
       season, and „the season after this one" answers the case above exactly as the
       record does: 2027 is not after 2026. It parts company here — on a day in 2025
       the next season is 2026, that member is not in a team by that reading, and the
       form would open. Measured: `inTeamIn(me, thisYear + 1)` passes every other case
       in this file and fails only this one (review, 05.09.2026). */
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000031', undefined, '2025-10-15')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(screen.queryByLabelText(/Naziv tima/)).toBeNull()
  })

  it('is not offered outside the transfer window, and the address is not a page then either', async () => {
    /* A team is founded from 1 October to 31 December (owner, 05.09.2026), the same
       window every other change of team is asked in. Read on a day in September: the
       standing says when the window opens instead of offering the button, and the
       address itself sends the member to the front page, exactly as it does to a
       member who already has a team. Two halves of one rule, so neither can be the
       only thing holding it. */
    const { router } = renderAt('/sr/timovi', 'competitor', '000002', undefined, '2026-09-05')

    await screen.findByRole('table', { name: 'Timovi' })

    expect(screen.queryByRole('link', { name: 'Predloži tim' })).toBeNull()
    expect(screen.getByText(/od 1. oktobra do 31. decembra/)).toBeVisible()

    await router.navigate('/sr/novi-tim')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(screen.queryByLabelText(/Naziv tima/)).toBeNull()
  })

  it('says nothing about the window to a member who has a team', async () => {
    /* The sentence is where the button would be, so it is for the same reader: a
       member who could found a team once the window opens. Told to a member of Dunav
       it promises them something they can never do. Nothing held that until
       05.09.2026: regrouping the condition so both read the same test left the whole
       suite green (review). */
    renderAt('/sr/timovi', 'competitor', '000007', undefined, '2026-09-05')

    await screen.findByRole('table', { name: 'Timovi' })

    expect(screen.queryByText(/od 1. oktobra do 31. decembra/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Predloži tim' })).toBeNull()
  })

  it('offers the season that has not begun, where every team stands on nought', async () => {
    /* Owner, 05.09.2026: the standing of the teams is asked for the next year as well,
       „gde se već prijavljuju", and there every team has nought because nobody has run
       in it yet. Without it a member could found a team and then find it nowhere.
       Nothing held it: taking the next season back out of the list left the whole
       suite green (review, 05.09.2026). */
    const user = setupUser()

    renderAt('/sr/timovi', 'competitor', '000002', undefined, DAY)

    await screen.findByRole('table', { name: 'Timovi' })

    const seasons = screen.getByLabelText(/Sezona/)

    expect(within(seasons).getAllByRole('option').map((one) => one.textContent)).toContain('2027')
    /* And it opens on the season now running, never on the one that has not begun. */
    expect(seasons).toHaveValue('2026')

    await user.selectOptions(seasons, '2027')

    const table = within(await screen.findByRole('table', { name: 'Timovi' }))
    /* Read by role and by the place in the row rather than by a class name: the
       points are the last cell of a team's row, and `.table__points` is a name eight
       screens share (btl/CLAUDE.md, UI standards: role and label queries, not CSS
       selectors). */
    const points = table
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell').at(-1)?.textContent)

    expect(points.length).toBeGreaterThan(0)
    expect([...new Set(points)]).toEqual(['0,00'])
  })

  it('asks whoever reaches the address without signing in to sign in', async () => {
    renderAt('/sr/novi-tim')

    expect(await screen.findByRole('heading', { name: /prijav/i })).toBeVisible()
    expect(screen.queryByLabelText(/Naziv tima/)).toBeNull()
  })
})

describe('a proposal a member sends', () => {
  const fill = async (user: ReturnType<typeof setupUser>, name: string) => {
    await user.type(await screen.findByLabelText(/Naziv tima/), name)
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo zajedno već tri godine.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
  }

  it('says it is waiting on a moderator rather than that the team exists', async () => {
    const user = setupUser()
    renderAt('/sr/novi-tim', 'competitor', '000002', undefined, DAY)

    await fill(user, 'Trkači Morave')

    expect(await screen.findByRole('heading', { name: 'Predlog je poslat' })).toBeVisible()
    expect(screen.getByText(/„Trkači Morave" čeka odluku moderatora/)).toBeVisible()
  })

  it('carries the logo and the square of it the member chose, all the way to the team', async () => {
    /* Owner, 12.08.2026: cropping inside the site is for profile pictures and
       team pictures, and whoever approves „treba da vidi isto fokus na vidljiv
       deo slike i zatamnjen ali dovoljno vidljiv ostatak".

       So this walks the whole way: choose a picture, cut it, send it, read it on
       the moderator's card, approve, and find it on the team. Each half was
       written separately and each half passed alone; what nothing checked was
       that the same picture came out of the other end. */
    const user = setupUser()
    /* Signed in as somebody who may also decide, because this walks both
       ends of the flow and the administration is shut to a competitor. */
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002', undefined, DAY)

    await user.upload(
      await screen.findByLabelText(/Znak tima/),
      new File(['znak'], 'znak-tima.png', { type: 'image/png' }),
    )
    await measurePicture()

    const cutting = within(await screen.findByRole('group', { name: 'Isecanje slike' }))

    fireEvent.change(cutting.getByLabelText('Veličina isečka'), { target: { value: '0.5' } })
    fireEvent.change(cutting.getByLabelText('Pomeri gore i dole'), { target: { value: '0' } })

    await fill(user, 'Trkači Morave')
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Trkači Morave' })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    /* The moderator sees the picture, cut where the member cut it, with the rest
       still under the shade. */
    const shown = must(
      card.getByAltText(/Slika koju je poslao/).closest('.crop'),
      'the picture on the card',
    )

    expect(must(shown.querySelector('.crop__frame'), 'the lit square')).toHaveStyle({
      inlineSize: '50%',
      insetBlockStart: '0%',
    })

    await user.click(card.getByRole('button', { name: 'Odobri' }))
    await router.navigate('/sr/administracija/timovi')

    const list = within(await screen.findByRole('table', { name: 'Timovi' }))

    expect(list.getByText('Trkači Morave')).toBeVisible()
  })

  it('refuses to send without the three things it asks for', async () => {
    const user = setupUser()
    renderAt('/sr/novi-tim', 'competitor', '000002', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: 'Pošalji predlog' }))

    expect(screen.queryByRole('heading', { name: 'Predlog je poslat' })).toBeNull()
    expect(screen.getAllByText('Ovo polje je obavezno.')).toHaveLength(3)
  })
})

describe('a member who founds a team', () => {
  it('is in it from the next season the moment the proposal is approved', async () => {
    /* The high finding of the review of PR 186: an approval wrote the organiser onto
       the team and nothing onto the member, so the founder was in no team at all and
       could found a second one the same minute. Owner, 05.09.2026: „Odmah ulazi u
       tim... on ce biti prvi i jedini clan u tom trenutku", and the team scores from
       1 January, so the season written is the next one.

       Read off what the session was told rather than off a screen: no public screen
       reads the overlay this prototype keeps its changes in (`admin/entityForms.ts`),
       so the roster of a team made today is a thing the database will draw. What can
       be held now is that the record is written, and written with both fields. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002', undefined, DAY, <Saved />)

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Trkači Morave' })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))

    const saved = within(screen.getByRole('list', { name: 'session records' }))
    const written = must(
      saved
        .getAllByRole('listitem')
        .map((one) => one.textContent ?? '')
        .find((one) => one.startsWith('edit 000002 |')),
      'what the session was told about the member who founded it',
    )

    /* The team it names is the one that was just made, not a word from the file. */
    const made = must(
      saved
        .getAllByRole('listitem')
        .map((one) => /^new teams (\S+) \|/.exec(one.textContent ?? ''))
        .find((one) => one !== null),
      'the team the approval made',
    )

    expect(written).toContain(`teamId=${made[1]}`)
    expect(written).toContain('teamSince=2027')
  })
})

describe('a member who has founded one team', () => {
  const found = async (user: ReturnType<typeof setupUser>, name: string) => {
    await user.type(await screen.findByLabelText(/Naziv tima/), name)
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })
  }

  const approve = async (user: ReturnType<typeof setupUser>, name: string) => {
    const heading = await screen.findByRole('heading', { name })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))
  }

  it('cannot found a second one, by the button or by the address', async () => {
    /* Walked the whole way, because the two halves passed apart: the approval writes
       the team onto the member's record in the session, and the door read the file on
       the disc, which knows nothing of it. Read that way the founder walked back in
       and founded a second team the same minute — two teams, one organiser, measured
       in review on 05.09.2026. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002', undefined, DAY)

    await found(user, 'Trkači Morave')
    await router.navigate('/sr/administracija/verifikacija/timovi')
    await approve(user, 'Trkači Morave')

    await router.navigate('/sr/timovi')
    await screen.findByRole('table', { name: 'Timovi' })

    expect(screen.queryByRole('link', { name: 'Predloži tim' })).toBeNull()

    await router.navigate('/sr/novi-tim')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
  }, SLOW)

  it('cannot have a second one approved out of the queue either', async () => {
    /* The other road to the same place, and it survives the fix above: at the moment
       a second proposal is sent the member may really have no team, because the first
       is only waiting, so the door lets them through. What must refuse is the
       decision, and until 05.09.2026 nothing between two waiting proposals and two
       approved teams asked whose they were (review).

       Two proposals from one member wait in the file, so this is one press and not a
       second walk through the form: the sweep is where the answer has to be carried,
       since the session does not change while a loop runs. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { router } = renderAt(
      '/sr/administracija/verifikacija/timovi',
      'superadmin',
      '000002',
      undefined,
      DAY,
    )

    try {
      await screen.findByRole('list', { name: /Čeka/ })
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      await router.navigate('/sr/administracija/timovi')

      const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

      /* One of the two, not both: the first one settled puts its member into a team,
         and the second is refused by the same rule the door keeps. */
      expect(listed.getByText('Timočka trkačka družina')).toBeVisible()
      expect(listed.queryByText('Moravski maratonci')).toBeNull()
    } finally {
      confirm.mockRestore()
    }
  }, SLOW)

  it('is told why the second one cannot be taken', async () => {
    /* Said rather than merely done, which is the shape this queue already keeps for
       every other reason a proposal cannot be approved (`teamProposal.ts`). */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { router } = renderAt(
      '/sr/administracija/verifikacija/timovi',
      'superadmin',
      '000002',
      undefined,
      DAY,
    )

    try {
      await screen.findByRole('list', { name: /Čeka/ })
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      await router.navigate('/sr/administracija/verifikacija/timovi')

      const heading = await screen.findByRole('heading', { name: 'Moravski maratonci' })
      const card = within(must(heading.closest('li'), 'the card of the second proposal'))

      expect(card.getByText(/već u timu/)).toBeVisible()
    } finally {
      confirm.mockRestore()
    }
  }, SLOW)
})

describe('the queue of teams without the members', () => {
  /* The decision needs to know whether whoever sent a proposal already has a team,
     and that is read off the member list. Two states and not one, because `dataOr`
     answers the same for a file on its way and one that failed: told to wait for
     something that will never come, a moderator is refused the decision for good and
     reads a sentence that is not true. The queue of dates does the same over its own
     two files, and `AdminEvents` over the results. */
  const withMembers = async (
    /* Handed the real reader, because the stub is `globalThis.fetch` by the time this
       runs and a case that asks for it again asks itself. */
    answer: (input: RequestInfo | URL, served: typeof globalThis.fetch) => Promise<Response>,
  ) => {
    const served = globalThis.fetch

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('competitors') ? answer(input, served) : served(input, init),
    )

    return () => {
      vi.stubGlobal('fetch', served)
    }
  }

  it('refuses the second one even when the member record is gone', async () => {
    /* The other home of „this member already has a team": the team itself carries the
       number that made it (`organizerMemberNumber`). Read off the member's record
       alone, the two came apart the moment the record was not there to write to — a
       member deleted from the list, or simply absent from it — and „Odobri" pressed
       twice made two teams for one number, while the sweep survived only because it
       carries its own list along the walk (review, 05.09.2026).

       Served without that member rather than deleted through the administration: the
       state under test is „the record is not there", and the shorter road to it says
       so more plainly. */
    const back = await withMembers(async (input, served) => {
      const answer = await served(input)
      const members: { memberNumber: string }[] = await answer.json()

      return new Response(JSON.stringify(members.filter((one) => one.memberNumber !== '000004')), {
        headers: { 'content-type': 'application/json' },
      })
    })

    try {
      const user = setupUser()
      const { router } = renderAt(
        '/sr/administracija/verifikacija/timovi',
        'superadmin',
        '000002',
        undefined,
        DAY,
      )

      for (const name of ['Timočka trkačka družina', 'Moravski maratonci']) {
        const heading = await screen.findByRole('heading', { name })
        const card = within(must(heading.closest('li'), `the card of ${name}`))
        const decide = card.getByRole('button', { name: 'Odobri' })

        if (decide.getAttribute('aria-disabled') !== 'true') {
          await user.click(decide)
        }
      }

      await router.navigate('/sr/administracija/timovi')

      const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

      expect(listed.getByText('Timočka trkačka družina')).toBeVisible()
      expect(listed.queryByText('Moravski maratonci')).toBeNull()
    } finally {
      back()
    }
  }, SLOW)

  it('says it is waiting for them while they are still coming', async () => {
    const back = await withMembers(async () => new Promise<Response>(() => undefined))

    try {
      renderAt('/sr/administracija/verifikacija/timovi', 'superadmin', '000002', undefined, DAY)

      expect(await screen.findByText(/čeka spisak članova/)).toBeVisible()
      expect(screen.getAllByRole('button', { name: 'Odobri' })[0]).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    } finally {
      back()
    }
  }, SLOW)

  it('says the decision cannot be taken at all when they will not come', async () => {
    const back = await withMembers(async () => new Response('', { status: 500 }))

    try {
      renderAt('/sr/administracija/verifikacija/timovi', 'superadmin', '000002', undefined, DAY)

      expect(await screen.findByText(/ne može učitati/)).toBeVisible()
    } finally {
      back()
    }
  }, SLOW)
})

describe('a team the moment it is approved', () => {
  it('draws its own page with its founder in it, and says so in the count', async () => {
    /* PDL, 05.09.2026: the founder „je od tog trenutka prvi i jedini član i vidi se u
       sastavu tima". Read from two places at once, the page said both things: „Izmeni"
       for the founder, because that half read the session, and „0 članova" under it,
       because the roster read the file (review, 05.09.2026). */
    /* On a day inside the transfer window, like every other signed-in reading here.
       Read on the real day, the walk approves a team on a day the portal does not take
       one at all, and `seasonOnSale` then writes the **current** season into the
       founder's record, so the new team's page draws them in this season's standing
       with four races behind them. Both states pass these three assertions, so the
       day has to be pinned or the walk quietly changes what it measures on 1 October
       (review, 05.09.2026). */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/administracija/verifikacija/timovi',
      'superadmin',
      '000004',
      undefined,
      DAY,
    )

    const heading = await screen.findByRole('heading', { name: 'Timočka trkačka družina' })
    const card = within(must(heading.closest('li'), 'the card the heading stands in'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/tim/timocka-trkacka-druzina')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Timočka trkačka družina' }),
    ).toBeVisible()
    expect(screen.getByText(/1 član/)).toBeVisible()
    expect(screen.queryByText(/0 članova/)).toBeNull()
    /* And in **this** season the team has nobody, because a team founded in the
       window scores from 1 January: the count above is who is in the team, the table
       below is who was in it that season, and the two are different questions. */
    expect(screen.getByText(/te sezone nije imao članova/)).toBeVisible()
    /* And the founder is the one who may change it, which is the other half of the
       same answer and the reason the two must be read off one list. */
    expect(screen.getByRole('link', { name: 'Izmeni' })).toBeVisible()
  }, SLOW)
})

describe('who the queue of new teams says decides', () => {
  it('names both, because both may (PDL P13, P21)', () => {
    /* This is the text the queue's own page carries into its description, and it
       said "Svaki nov tim odobrava superadministrator" for as long as P13 did.
       Changing P13 and leaving it was how the decision and the screen went on
       disagreeing one file further along, and nothing was measuring it. */
    const said = sr.verification.fromTeams

    expect(said).toMatch(/[Ss]uperadmin/)
    expect(said).toMatch(/moderator/)
  })
})

describe('what the screen promises a member', () => {
  it('promises no answer, because none arrives', async () => {
    /* It used to say the answer comes to your messages. Nothing writes it there:
       the inbox is written to on one queue only, the pictures, so a decision on
       a proposal reaches nobody (PENDING R9).

       Checked by counting the inbox rather than by matching the old sentence,
       which any other wording of the same promise would have slipped past. */
    const user = setupUser()
    const { router } = renderAt('/sr/poruke', 'competitor', '000002', undefined, DAY)

    const before = within(await screen.findByRole('list')).getAllByRole('listitem').length

    await router.navigate('/sr/novi-tim')
    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/poruke')

    expect(within(await screen.findByRole('list')).getAllByRole('listitem')).toHaveLength(before)
  })

  it('promises no sight of it either, because there is no screen that shows one', async () => {
    /* A proposal lives in the session and is read in the administration alone,
       so "only you can see it" would have been the same kind of promise. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000002', undefined, DAY)

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/timovi')
    await screen.findByRole('table', { name: 'Timovi' })

    expect(screen.queryByText('Trkači Morave')).toBeNull()
  })
})

describe('a name a team in the league already answers to', () => {
  it('is refused at the door rather than a fortnight later', async () => {
    /* PDL: the name must not be taken by a team already approved. A member told
       at the door can change it; a member told a fortnight later by a refusal
       has to start again. */
    const user = setupUser()
    renderAt('/sr/novi-tim', 'competitor', '000002', undefined, DAY)

    /* In another case and without the diacritics, which is what the league
       already holds as "Dunavski trkači": the check is on the address the name
       makes, so neither of those two is a different team. */
    await user.type(await screen.findByLabelText(/Naziv tima/), 'dunavski TRKACI')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    /* Including the sentence that says why this counts as the same name. Told
       only that a team of that name exists, a member goes looking for it on the
       list of teams and does not find the name they typed. */
    expect(screen.getByText(/ne računaju kao razlika/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Predlog je poslat' })).toBeNull()
  })

  it('is refused when it is the same name written in the other script', async () => {
    /* The league is Balkan and written in both, so this is the team the league
       already has and not a second one. Before the address knew any Cyrillic
       this went through, and the team it made answered at `/tim/`. */
    const user = setupUser()
    renderAt('/sr/novi-tim', 'competitor', '000002', undefined, DAY)

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Дунавски тркачи')
    await user.type(screen.getByLabelText(/^Mesto/), 'Novi Sad')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    expect(screen.getByText(/ćirilica i latinica su isto pismo/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Predlog je poslat' })).toBeNull()
  })
})

describe('a name that makes no address at all', () => {
  it('is refused, because a team without an address is a team with no page', async () => {
    /* Not the same fault as a taken name, and it cannot be told as one: the
       first such team would answer at `/tim/`, and the next proposal would be
       refused as a name already taken though the two share nothing. */
    const user = setupUser()
    renderAt('/sr/novi-tim', 'competitor', '000002', undefined, DAY)

    await user.type(await screen.findByLabelText(/Naziv tima/), '???')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    expect(screen.getByText(/ne može napraviti adresa strane tima/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Predlog je poslat' })).toBeNull()
  })
})

describe('a proposal from somebody the member list does not hold', () => {
  it('goes through, with no name beside it rather than the word undefined', async () => {
    /* The member list is read to put a name on the proposal, and it can come
       back without one: a number handed out during this visit is not in the file
       the list is read from, and after the database arrives the two can be a
       moment apart for a hundred other reasons. What must not happen is that the
       proposal is refused, or that it goes to the moderator signed "undefined". */
    const user = setupUser()
    /* Signed in as the superadmin, so the queue can be opened at the end of it,
       but under a number the member list does not hold. */
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '999999', undefined, DAY)

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    expect(await screen.findByRole('heading', { name: 'Predlog je poslat' })).toBeVisible()

    await router.navigate('/sr/administracija/verifikacija/timovi')
    const waiting = await screen.findByRole('list', { name: /Čeka/ })

    expect(within(waiting).getByText('Trkači Morave')).toBeVisible()
    expect(within(waiting).queryByText(/undefined/)).toBeNull()
  })
})

describe('the queue of new teams', () => {
  it('holds what a member proposed, beside what was already in it', async () => {
    /* The whole point of the exercise: a moderator opening the queue cannot tell
       which of two waiting teams came from a file and which from a member,
       because once there is a database there is no such difference. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002', undefined, DAY)

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo zajedno već tri godine.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const items = within(waiting).getAllByRole('listitem')

    /* Beside the ones from the file, not instead of them. */
    expect(items.length).toBeGreaterThan(1)
    expect(within(waiting).getByText('Trkači Morave')).toBeVisible()
    /* Carrying who asked and what they said, which is what a moderator decides
       on: a name and a town with nobody attached is not a thing to judge. */
    expect(within(waiting).getByText(/Čačak, Srbija\. Trčimo zajedno već tri godine\./)).toBeVisible()
  })

  it('names a country from outside the region, not its code', async () => {
    /* The dictionary held five countries, the ones the league is run in, and the
       card asked it for whatever code the member picked. The select is filled
       from countries.json, which holds two hundred and fifty two, so a team from
       Slovenia reached the moderator as the words `country.SI` (countryName).

       Slovenia rather than Serbia on purpose: every other flow here picks RS,
       which the five happened to hold, so all of them passed either way. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002', undefined, DAY)

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Kranjski tekači')
    await user.type(screen.getByLabelText(/^Mesto/), 'Kranj')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'SI')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo Julijske Alpe.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const waiting = await screen.findByRole('list', { name: /Čeka/ })

    expect(within(waiting).getByText(/Kranj, Slovenija\./)).toBeVisible()
    expect(within(waiting).queryByText(/country\./)).toBeNull()
  })

  it('counts the proposal wherever the queue is counted, not only in the queue', async () => {
    /* Counted once, in one place, so the number beside the queue in the
       navigation and the queue itself cannot disagree (pending.ts). A moderator
       told nothing is waiting, on a screen about to show them something, stops
       believing the number. */
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/verifikacija/timovi', 'superadmin', '000002', undefined, DAY)

    const named = () =>
      must(
        screen
          .getAllByRole('link')
          .map((link) => /^Novi timovi(\d+)$/.exec(link.textContent ?? ''))
          .find((found) => found !== null),
        'veza ka redu novih timova sa brojem',
      )[1]

    await screen.findByRole('list', { name: /Čeka/ })
    const before = Number(named())

    await router.navigate('/sr/novi-tim')
    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/administracija/verifikacija/timovi')
    await screen.findByRole('list', { name: /Čeka/ })

    expect(Number(named())).toBe(before + 1)
  })
})

describe('a proposal a moderator accepts', () => {
  /* What approving does beyond writing down the decision (owner, 03.08.2026,
     PDL P13): the team is made, the member who proposed it is its organiser,
     and that member is told in the inbox. */
  const propose = async (user: ReturnType<typeof setupUser>, name: string) => {
    await user.type(await screen.findByLabelText(/Naziv tima/), name)
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })
  }

  it('writes to the member who asked for it, in the inbox', async () => {
    /* Not a message on a screen nobody is looking at: the decision may come
       days later. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002', undefined, DAY)

    await propose(user, 'Trkači Morave')

    await router.navigate('/sr/administracija/verifikacija/timovi')
    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const mine = must(
      within(waiting)
        .getAllByRole('listitem')
        .find((item) => /Trkači Morave/.test(item.textContent ?? '')),
      'predlog u redu čekanja',
    )

    await user.click(within(mine).getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/poruke')
    const inbox = within(await screen.findByRole('list'))

    expect(inbox.getByText(/Tim „Trkači Morave" je prihvaćen/)).toBeVisible()
  })

  it('makes the team, with the member who proposed it as its organiser', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002', undefined, DAY)

    await propose(user, 'Trkači Morave')

    await router.navigate('/sr/administracija/verifikacija/timovi')
    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const mine = must(
      within(waiting)
        .getAllByRole('listitem')
        .find((item) => /Trkači Morave/.test(item.textContent ?? '')),
      'predlog u redu čekanja',
    )

    await user.click(within(mine).getByRole('button', { name: 'Odobri' }))

    /* A record like any other from that moment: in the administration's list of
       teams, with the town it was proposed with. */
    await router.navigate('/sr/administracija/timovi')
    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
    const row = must(
      listed.getAllByRole('row').find((one) => /Trkači Morave/.test(one.textContent ?? '')),
      'red novog tima',
    )

    expect(within(row).getByText('Čačak')).toBeVisible()
  })

  it('leaves nothing behind when the proposal is turned down', async () => {
    /* The other half. A refusal makes no team and writes to nobody: the reason
       is written down, and this queue hands nothing back to a member. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002', undefined, DAY)

    await propose(user, 'Trkači Morave')

    await router.navigate('/sr/administracija/verifikacija/timovi')
    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const mine = must(
      within(waiting)
        .getAllByRole('listitem')
        .find((item) => /Trkači Morave/.test(item.textContent ?? '')),
      'predlog u redu čekanja',
    )

    await user.click(within(mine).getByRole('button', { name: 'Odbij' }))
    await user.type(screen.getByLabelText(/Razlog/), 'Već postoji tim tog imena u Čačku.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

    await router.navigate('/sr/administracija/timovi')
    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

    expect(listed.queryByText('Trkači Morave')).toBeNull()
  })
})

describe('what a moderator may do before accepting a proposal', () => {
  /* The owner asked for it in the same breath as the approval: whoever decides
     may or may not change the team's data, and if they accept, the member is
     told (PDL P13, 03.08.2026). The name, the town and the country arrive as the
     member typed them and the team carries them from then on. */
  const open = async () => {
    const rendered = renderAt('/sr/administracija/verifikacija/timovi', 'superadmin', '000002', undefined, DAY)
    await screen.findByRole('list', { name: /Čeka/ })

    return rendered
  }

  const card = (name: RegExp) =>
    must(
      within(screen.getByRole('list', { name: /Čeka/ }))
        .getAllByRole('listitem')
        .find((item) => name.test(item.textContent ?? '')),
      'kartica predloga',
    )

  it('offers the three things the team will be made of', async () => {
    await open()

    const mine = within(card(/Timočka/))

    expect(mine.getByLabelText('Naziv tima')).toHaveValue('Timočka trkačka družina')
    expect(mine.getByLabelText('Mesto')).toHaveValue('Zaječar')
    expect(mine.getByLabelText(/^Država/)).toHaveValue('RS')
  })

  it('makes the team out of what was corrected, not out of what arrived', async () => {
    const user = setupUser()
    const { router } = await open()

    const name = within(card(/Timočka/)).getByLabelText('Naziv tima')
    await user.clear(name)
    await user.type(name, 'Timočka družina')

    await user.click(within(card(/Timočka družina/)).getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/administracija/timovi')
    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

    expect(listed.getByText('Timočka družina')).toBeVisible()
    expect(listed.queryByText('Timočka trkačka družina')).toBeNull()
  })

  it('refuses a name a team in the league already answers to', async () => {
    /* PDL P13. The address is read off the name, so two teams under one name are
       two teams under one address. The moderator has the field to put it right,
       or the way back to whoever sent it. */
    const user = setupUser()
    const { router } = await open()

    await user.click(within(card(/dunavski trkači/)).getByRole('button', { name: 'Odobri' }))

    /* Still waiting: nothing was settled and nothing was made. */
    expect(card(/dunavski trkači/)).toBeVisible()

    await router.navigate('/sr/administracija/timovi')
    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

    expect(listed.queryByText('dunavski trkači')).toBeNull()
  })

  it('takes it once the name is put right', async () => {
    const user = setupUser()
    const { router } = await open()

    const name = within(card(/dunavski trkači/)).getByLabelText('Naziv tima')
    await user.clear(name)
    await user.type(name, 'Dunavski trkači Novi Sad')

    await user.click(within(card(/Dunavski trkači Novi Sad/)).getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/administracija/timovi')
    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

    expect(listed.getByText('Dunavski trkači Novi Sad')).toBeVisible()
  })

  it('refuses one that is missing something a team cannot be made without', async () => {
    const user = setupUser()
    const { router } = await open()

    const city = within(card(/Timočka/)).getByLabelText('Mesto')
    await user.clear(city)

    await user.click(within(card(/Timočka/)).getByRole('button', { name: 'Odobri' }))

    expect(card(/Timočka/)).toBeVisible()

    await router.navigate('/sr/administracija/timovi')
    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

    expect(listed.queryByText('Timočka trkačka družina')).toBeNull()
  })

  it('takes a country the moderator chooses instead of the one that arrived', async () => {
    /* The third of the three fields. A member can pick the wrong one out of two
       hundred and fifty, and the team carries it from then on. */
    const user = setupUser()
    const { router } = await open()

    await user.selectOptions(within(card(/Timočka/)).getByLabelText(/^Država/), 'BA')
    await user.click(within(card(/Timočka/)).getByRole('button', { name: 'Odobri' }))

    /* Read on the team's own form, because the list of teams has no column for
       a country: the record is what has to carry it. */
    await router.navigate('/sr/administracija/timovi')
    await screen.findByRole('table', { name: 'Timovi' })
    await user.click(screen.getByRole('button', { name: /^Otvori: Timočka/ }))

    expect(await screen.findByLabelText(/^Država/)).toHaveValue('BA')
  })

  it('makes the member who proposed it the organiser of the team', async () => {
    /* "Admin prava za svoj tim" out of the owner's decision, which P21 already
       calls being a team's organiser: not a new role but something a competitor
       carries. */
    const user = setupUser()
    const { router } = await open()

    await user.click(within(card(/Timočka/)).getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/administracija/timovi')
    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
    const row = must(
      listed.getAllByRole('row').find((one) => /Timočka/.test(one.textContent ?? '')),
      'red novog tima',
    )

    /* The member who sent that proposal in, by the name the portal knows them
       by, and not "Nema organizatora". The seeded proposal comes from a member with
       no team of their own since 05.09.2026: a proposal from somebody who already has
       one cannot be approved at all, which is the rule this walk would otherwise be
       measuring around. */
    expect(within(row).getByText('Časlav Radenković')).toBeVisible()
  })

  it('writes to the member who proposed it and to nobody else', async () => {
    /* An empty recipient means the whole league as far as the inbox is
       concerned (session/context.ts). Read from a different member's account
       than the one that proposed it, because approving as the proposer cannot
       tell a letter from an announcement. */
    const user = setupUser()
    const { router } = renderAt(
      '/sr/administracija/verifikacija/timovi',
      'superadmin',
      /* Not 000007, who sent both proposals in the file. */
      '000001',
    )

    await screen.findByRole('list', { name: /Čeka/ })
    await user.click(within(card(/Timočka/)).getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/poruke')
    const inbox = within(await screen.findByRole('list'))

    expect(inbox.queryByText(/Timočka trkačka družina.*prihvaćen|prihvaćen.*Timočka/)).toBeNull()
  })

  it('gives two teams approved in one sweep two identities', async () => {
    /* The fault a call per item walks into. What identity is free is read out of
       the session, and the session does not change while a loop runs, so forty
       approvals in one click were forty teams under one identity: the list draws
       them under one key, an edit to either reaches both, and deleting one
       deletes both. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      const { router } = await open()

      /* Renamed so both go through, since the second carries a name the league
         already has. */
      const name = within(card(/dunavski trkači/)).getByLabelText('Naziv tima')
      await user.clear(name)
      await user.type(name, 'Dunavski trkači Novi Sad')

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(screen.getByText(/^Rešen.* 2 stavk/)).toBeVisible()

      await router.navigate('/sr/administracija/timovi')
      const listed = () => within(screen.getByRole('table', { name: 'Timovi' }))
      await screen.findByRole('table', { name: 'Timovi' })

      /* Told apart by changing one and reading the other. The overlay of edits
         is keyed by identity, so under one identity a change to either reaches
         both: that is the fault, and it is the only thing that sees it. Deleting
         one does not, because two rows under one key leave a stale row behind
         and the screen looks right for the wrong reason. */
      await user.click(listed().getByRole('button', { name: /^Otvori: Timočka/ }))

      const city = await screen.findByLabelText(/^Mesto/)
      await user.clear(city)
      await user.type(city, 'Knjaževac')
      await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
      await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
      await screen.findByRole('table', { name: 'Timovi' })

      const rows = listed()
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent ?? '')

      expect(rows.filter((row) => /Knjaževac/.test(row))).toHaveLength(1)
      expect(rows.filter((row) => /Dunavski trkači Novi Sad/.test(row))).toHaveLength(1)
      /* And the one that was not touched did not take the change with it. Said
         of that row by name, so the count above cannot be what makes it pass. */
      expect(rows.find((row) => /Dunavski trkači Novi Sad/.test(row))).not.toMatch(/Knjaževac/)
    } finally {
      confirm.mockRestore()
    }
  })

  it('lets no two proposals of one name through in the same sweep', async () => {
    /* What a team may be called is read out of the same session, so the second
       item of a sweep could not see the team the first had just made. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      const { router } = await open()

      const name = within(card(/dunavski trkači/)).getByLabelText('Naziv tima')
      await user.clear(name)
      await user.type(name, 'Timočka trkačka družina')

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      /* One of the two, and the other left standing with the reason on it. */
      expect(screen.getByText(/^Rešen.* 1 stavk/)).toBeVisible()

      await router.navigate('/sr/administracija/timovi')
      const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

      expect(listed.getAllByText('Timočka trkačka družina')).toHaveLength(1)
    } finally {
      confirm.mockRestore()
    }
  })

  it('refuses a name that is spelt differently and answers at the same address', async () => {
    /* The address is read off the name and `slugify` is not one to one:
       "Dunavski trkači" and "Dunavski Trkaci" are two names and one address, so
       comparing names would let the second through to collide with the first. */
    const user = setupUser()
    const { router } = await open()

    const name = within(card(/dunavski trkači/)).getByLabelText('Naziv tima')
    await user.clear(name)
    await user.type(name, 'Dunavski Trkaci')

    expect(within(card(/Dunavski Trkaci/)).getByText(/istu adresu/)).toBeVisible()

    await user.click(within(card(/Dunavski Trkaci/)).getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/administracija/timovi')
    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

    expect(listed.queryByText('Dunavski Trkaci')).toBeNull()
  })

  it('says why it will not take one, rather than doing nothing when pressed', async () => {
    /* A control that quietly does nothing teaches a moderator that the screen is
       broken, which is the reasoning already written beside the way back on this
       same card (WCAG 2.2 SC 3.3.1). */
    const user = setupUser()
    await open()

    expect(within(card(/dunavski trkači/)).getByText(/već postoji u ligi/)).toBeVisible()

    const city = within(card(/Timočka/)).getByLabelText('Mesto')
    await user.clear(city)

    expect(within(card(/Timočka/)).getByText(/moraju biti popunjeni/)).toBeVisible()
  })

  it('says it out loud, and the button that cannot act points at the reason', async () => {
    /* Drawn is not said. The reason appears and disappears while a moderator
       types, which somebody reading the screen through a reader gets nothing of
       unless the line announces itself, and pressing a button that quietly does
       nothing tells them even less. So the line is a live region, and the button
       says it cannot act and names what explains it (WCAG 2.2 SC 3.3.1, 4.1.3).

       Not `disabled`: a control that leaves the row takes the keyboard with it,
       and this one is meant to be reachable so that its reason can be read. */
    const user = setupUser()
    await open()

    const blocked = within(card(/dunavski trkači/))
    const reason = blocked.getByRole('status')
    const approve = blocked.getByRole('button', { name: 'Odobri' })

    expect(reason).toHaveTextContent(/već postoji u ligi/)
    expect(approve).toHaveAttribute('aria-disabled', 'true')
    expect(approve.getAttribute('aria-describedby')).toBe(reason.id)

    /* And on a proposal with nothing wrong with it: the same line is standing
       there empty, because a live region that arrives with its words is one
       nobody is told about, and the button neither refuses nor points at it. */
    const fine = within(card(/Timočka/))

    expect(fine.getByRole('status')).toBeEmptyDOMElement()
    expect(fine.getByRole('button', { name: 'Odobri' })).toHaveAttribute('aria-disabled', 'false')
    expect(fine.getByRole('button', { name: 'Odobri' })).not.toHaveAttribute('aria-describedby')

    /* Said as it changes, over a line that was already standing: emptying the
       name fills it. Found by the town, since the name it was found by is what
       has just been cleared. */
    await user.clear(fine.getByLabelText('Naziv tima'))

    expect(within(card(/Zaječar/)).getByRole('status')).toHaveTextContent(/moraju biti popunjeni/)
  })

  it('makes the team under the name it was corrected to, not the one that arrived', async () => {
    /* The queue used to draw a table of what it had settled and this was read
       there; that table is gone (owner, 06.08.2026). The team itself is the
       better place in any case: what the moderator corrected is what the league
       now has, and the table was only a report of it. */
    const user = setupUser()
    const { router } = await open()

    const name = within(card(/Timočka/)).getByLabelText('Naziv tima')
    await user.clear(name)
    await user.type(name, 'Timočka družina')
    await user.click(within(card(/Timočka družina/)).getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/administracija/timovi')

    const teams = within(await screen.findByRole('table', { name: 'Timovi' }))

    expect(teams.getByText('Timočka družina')).toBeVisible()
    expect(teams.queryByText('Timočka trkačka družina')).toBeNull()
  })

  it('gives two teams approved one after the other two identities', async () => {
    /* The count of what has been made is read at each approval, so the second
       has to see the first. It used to be filed under an identity of its own
       shape, which moved the counter for everything entered by hand and let two
       records end up under one key. */
    const user = setupUser()
    const { router } = await open()

    await user.click(within(card(/Timočka/)).getByRole('button', { name: 'Odobri' }))

    const name = within(card(/dunavski trkači/)).getByLabelText('Naziv tima')
    await user.clear(name)
    await user.type(name, 'Dunavski trkači Novi Sad')
    await user.click(within(card(/Dunavski trkači Novi Sad/)).getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/administracija/timovi')
    const listed = () => within(screen.getByRole('table', { name: 'Timovi' }))
    await screen.findByRole('table', { name: 'Timovi' })

    /* Told apart the only way that sees it: by changing one and reading the
       other. Two rows under one identity are both drawn, so counting them
       proves nothing; but the overlay of edits is keyed by identity, so under
       one identity a change to either reaches both. */
    await user.click(listed().getByRole('button', { name: /^Otvori: Timočka/ }))

    const city = await screen.findByLabelText(/^Mesto/)
    await user.clear(city)
    await user.type(city, 'Knjaževac')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
    await screen.findByRole('table', { name: 'Timovi' })

    const rows = listed()
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent ?? '')

    expect(rows.filter((row) => /Knjaževac/.test(row))).toHaveLength(1)
    expect(rows.find((row) => /Dunavski trkači Novi Sad/.test(row))).not.toMatch(/Knjaževac/)
  })

  it('is a name the form a member proposes on knows about from that moment', async () => {
    /* Three gates ask the same question and one of them was reading the file
       rather than the visit: a team approved a minute ago was invisible to the
       form, which took the proposal and handed the queue something it was then
       bound to refuse. */
    const user = setupUser()
    const { router } = await open()

    await user.click(within(card(/Timočka/)).getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/novi-tim')
    await screen.findByRole('button', { name: 'Pošalji predlog' })
    await user.type(screen.getByLabelText(/Naziv tima/), 'Timočka trkačka družina')
    await user.type(screen.getByLabelText(/^Mesto/), 'Zaječar')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    expect(screen.getByText(/već postoji u ligi/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Predlog je poslat' })).toBeNull()
  })

  it('counts only what the sweep really settled', async () => {
    /* One of the two waiting proposals carries a name the league already has, so
       "approve all" leaves it standing. The line under the button has to say two
       when it settled one, or it says a number the queue disagrees with. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      await open()
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(screen.getByText(/^Rešen.* 1 stavk/)).toBeVisible()
      expect(card(/dunavski trkači/)).toBeVisible()
    } finally {
      confirm.mockRestore()
    }
  })
})
