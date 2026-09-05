import { fireEvent, screen, within } from '@testing-library/react'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { measurePicture } from '../../test/picture'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'

/* A team put forward by a member, and the queue that has been waiting for one.
 *
 * The queue of new teams was written with the rest of the eight and nothing
 * could ever put anything in it: teams arrived one way only, entered by an
 * administrator (owner, 03.08.2026).
 */

describe('the way to propose a team', () => {
  it('is offered to a member who is in no team, on the standing of the teams', async () => {
    /* Member 000002 runs alone: `teamId` is null on their record. Somebody with
       a team has nothing to do with this button, and what they can do is on their
       own team's page (owner, 04.09.2026). */
    renderAt('/sr/timovi', 'competitor', '000002')

    expect(await screen.findByRole('link', { name: 'Predloži tim' })).toBeVisible()
  })

  it('is not offered to a member who already has one', async () => {
    /* The half of the same decision that takes something away: 000007 is in Dunav,
       and until 04.09.2026 every signed-in member saw this. Named by the member and
       not by the count of teams, because a member joins and leaves a team through
       the season and the button has to follow that, not the table. */
    renderAt('/sr/timovi', 'competitor', '000007')

    await screen.findByRole('table', { name: 'Timovi' })
    expect(screen.queryByRole('link', { name: 'Predloži tim' })).toBeNull()
  })

  it('is not offered to somebody who is not signed in', async () => {
    renderAt('/sr/timovi')

    await screen.findByRole('table', { name: 'Timovi' })
    expect(screen.queryByRole('link', { name: 'Predloži tim' })).toBeNull()
  })

  it('refuses a member who already has a team, at the address and not only on the button', async () => {
    /* A hidden button is not a rule. This address is in a member's history and in
       their bookmarks, and reached from either the form used to send a proposal
       that, approved, made them the organiser of a second team — against PDL P13,
       „član sme da bude samo u jednom timu istovremeno" (review, 04.09.2026). */
    renderAt('/sr/novi-tim', 'competitor', '000007')

    expect(await screen.findByRole('heading', { level: 1, name: 'Predlog tima' })).toBeVisible()
    expect(screen.getByText(/samo u jednom timu/)).toBeVisible()
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
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000031', undefined, '2026-09-05')

    expect(await screen.findByText(/samo u jednom timu/)).toBeVisible()
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
    renderAt('/sr/novi-tim', 'competitor', '000031', undefined, '2025-09-05')

    expect(await screen.findByText(/samo u jednom timu/)).toBeVisible()
    expect(screen.queryByLabelText(/Naziv tima/)).toBeNull()
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
    renderAt('/sr/novi-tim', 'competitor', '000002')

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
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002')

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
    renderAt('/sr/novi-tim', 'competitor', '000002')

    await user.click(await screen.findByRole('button', { name: 'Pošalji predlog' }))

    expect(screen.queryByRole('heading', { name: 'Predlog je poslat' })).toBeNull()
    expect(screen.getAllByText('Ovo polje je obavezno.')).toHaveLength(3)
  })
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
    const { router } = renderAt('/sr/poruke', 'competitor', '000002')

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
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000002')

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
    renderAt('/sr/novi-tim', 'competitor', '000002')

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
    renderAt('/sr/novi-tim', 'competitor', '000002')

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
    renderAt('/sr/novi-tim', 'competitor', '000002')

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
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '999999')

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
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002')

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
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002')

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
    const { router } = renderAt('/sr/administracija/verifikacija/timovi', 'superadmin', '000002')

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
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002')

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
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002')

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
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000002')

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
    const rendered = renderAt('/sr/administracija/verifikacija/timovi', 'superadmin', '000002')
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
       by, and not "Nema organizatora". */
    expect(within(row).getByText('Strahinja Vukićević')).toBeVisible()
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
