import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Competitor } from '../../data/types'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import sr from '../../i18n/sr.json'

/**
 * THE SCREEN A MEMBER CHANGES HIS OWN ACCOUNT FROM.
 *
 * <p>Owner, 24.09.2026: „Trenutno ne mogu cak ni svojim profilom da se igram, podesavam."
 * These are the two panels that answer that, and the sentences beside the things he may not
 * move.
 *
 * <p><b>Every case waits for the panel's own heading before it asserts anything at all</b>,
 * and that is not ceremony. This screen hangs off `/api/competitors`, which arrives after the
 * first render, so a claim about something being ABSENT - no box for the gender, no
 * confirmation yet - is true of every screen that has not arrived and measures nothing. The
 * heading is the thing this panel HAS, so waiting for it is what makes the absence mean
 * something.
 */

const members: Competitor[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/competitors.json'), 'utf-8'),
)

/**
 * The member every case below signs in as, taken out of the file rather than written here.
 *
 * <p><b>Deliberately NOT the first on the list</b>, which is the shape `CLAUDE.md` asks for:
 * a screen that drew `competitors[0]` instead of the member the session names would pass every
 * case in this file if the two were the same row. He is the seventh.
 */
const ME = must(
  members.find((one) => one.memberNumber === '000007'),
  'the seed still has member 000007',
)

/** And somebody else entirely, so „it showed HIS name" is a claim with a way to be false. */
const SOMEBODY_ELSE = must(
  members.find((one) => one.memberNumber !== ME.memberNumber && one.firstName !== ME.firstName),
  'the seed still has a second member with another name',
)

/** The panel a case is talking about, so a query cannot wander into the one below it. */
function panelOf(heading: string): HTMLElement {
  return must(
    screen.getByRole('heading', { level: 2, name: heading }).closest('section'),
    `the panel headed ${heading}`,
  )
}

async function personalPanel(): Promise<HTMLElement> {
  await screen.findByRole('heading', { level: 2, name: sr.account.personalTitle })

  return panelOf(sr.account.personalTitle)
}

describe('a member’s own data', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
  })

  it('opens with what the portal really holds about him, and not with somebody else’s', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    expect(within(panel).getByRole('textbox', { name: /Ime/ })).toHaveValue(ME.firstName)
    expect(within(panel).getByRole('textbox', { name: /Prezime/ })).toHaveValue(ME.lastName)
    expect(within(panel).queryByDisplayValue(SOMEBODY_ELSE.firstName)).not.toBeInTheDocument()
  })

  /**
   * <p><b>The two boxes nothing serves open EMPTY and say so.</b> An empty box with no
   * sentence beside it reads as „you have given none", which is a different and untrue thing.
   */
  it('says plainly that it cannot show the address and the telephone it holds', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    expect(within(panel).getByRole('textbox', { name: /Adresa za slanje/ })).toHaveValue('')
    expect(within(panel).getByRole('textbox', { name: /Telefon/ })).toHaveValue('')
    expect(within(panel).getAllByText(sr.account.notShown)).toHaveLength(2)
  })

  it('has nothing to save until something is changed', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    expect(within(panel).getByRole('button', { name: sr.account.save })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(within(panel).getByText(sr.account.changeFirst)).toBeInTheDocument()
  })

  /**
   * THE ERRAND ITSELF, and what is measured is WHAT WAS SENT rather than only that a
   * confirmation appeared.
   *
   * <p>Measured against the mutation named in `myAccount.test.ts`: a screen that sent every
   * box on it would still show this confirmation and would still have sent the right
   * telephone. What it would also have sent is the name and the surname, rewritten.
   */
  it('sends only the field that moved, and says it was kept', async () => {
    const user = setupUser()
    let asked: Asked[] = []
    ;({ stop, asked } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT' ? answeredWith(200) : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await user.type(within(panel).getByRole('textbox', { name: /Telefon/ }), '065 1234')
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    expect(await within(panel).findByText(sr.account.saved)).toBeInTheDocument()

    const sent = must(
      asked.find((one) => one.path === '/api/me' && one.init?.method === 'PUT'),
      'the screen asked the server to change something',
    )

    expect(JSON.parse(String(sent.init?.body))).toEqual({ phone: '065 1234' })
  })

  /**
   * <p><b>The confirmation is not a thing the screen says on its own.</b> The mutation this
   * answers is „show it as soon as the button is pressed": that passes the case above, because
   * there the server did say yes.
   */
  it('does not say anything was kept when the server refused it', async () => {
    const user = setupUser()
    ;({ stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT' ? refused('aFieldIsBlank') : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await user.clear(within(panel).getByRole('textbox', { name: /Prezime/ }))
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    expect(await within(panel).findByText(sr.account.fieldIsBlank)).toBeInTheDocument()
    expect(within(panel).queryByText(sr.account.saved)).not.toBeInTheDocument()
  })

  /** A refusal nobody named is still said out loud, number and all, rather than folded away. */
  it('says the number of an answer it cannot read', async () => {
    const user = setupUser()
    ;({ stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT' ? answeredWith(500) : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await user.type(within(panel).getByRole('textbox', { name: /Telefon/ }), '065')
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    expect(await within(panel).findByText(/500/)).toBeInTheDocument()
  })

  /**
   * <p>After a save the portal DOES know what is in the box, because it put it there, so the
   * sentence about not knowing goes - and pressing Save again sends nothing.
   */
  it('stops saying it cannot see a field once it has written one', async () => {
    const user = setupUser()
    ;({ stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT' ? answeredWith(200) : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await user.type(within(panel).getByRole('textbox', { name: /Telefon/ }), '065 1234')
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))
    await within(panel).findByText(sr.account.saved)

    expect(within(panel).getAllByText(sr.account.notShown)).toHaveLength(1)
    expect(within(panel).getByRole('button', { name: sr.account.save })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})

describe('the things a member may not change himself', () => {
  it('shows the gender and the category, and offers no box for either', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)
    await screen.findByRole('heading', { level: 2, name: sr.account.lockedTitle })

    const panel = panelOf(sr.account.lockedTitle)

    expect(within(panel).getByText(sr.rankings.men)).toBeInTheDocument()
    expect(within(panel).getByText(`M${ME.ageBand}`)).toBeInTheDocument()
    expect(within(panel).queryByRole('textbox', { name: /Pol/ })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('textbox', { name: /Datum rođenja/ })).not.toBeInTheDocument()
    expect(within(panel).getByText(sr.account.lockedNote)).toBeInTheDocument()
  })

  /**
   * <p>The date of birth is not on this screen at all and the sentence says why: the portal
   * does not hold it beside the public record, and the Statute asks that it never be shown.
   * What IS shown is the category it produces, which is the owner's own reason for locking it.
   */
  it('explains where the date of birth went rather than drawing an empty row for it', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)
    await screen.findByRole('heading', { level: 2, name: sr.account.lockedTitle })

    expect(within(panelOf(sr.account.lockedTitle)).getByText(sr.account.birthDateNote)).toBeInTheDocument()
  })

  /**
   * THE ONE CONTROL ON THIS SCREEN THAT IS SWITCHED OFF ON PURPOSE.
   *
   * <p>The owner decided a member changes this himself and must confirm the new one, because
   * the address is also how he signs in. Nothing confirms one, so the screen does not invent
   * it: the box stands, disabled, and names the sentence that says why.
   */
  it('leaves the address of electronic post switched off, with its reason attached', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)
    await screen.findByRole('heading', { level: 2, name: sr.account.lockedTitle })

    const box = within(panelOf(sr.account.lockedTitle)).getByRole('textbox', {
      name: /Adresa elektronske pošte/,
    })

    expect(box).toBeDisabled()
    expect(box).toHaveAccessibleDescription(sr.account.emailNote)
  })
})

describe('changing a password from inside', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
  })

  async function passwordPanel(): Promise<HTMLElement> {
    await screen.findByRole('heading', { level: 2, name: sr.account.passwordTitle })

    return panelOf(sr.account.passwordTitle)
  }

  /**
   * THE OWNER'S OWN EMPHASIS, MEASURED AS AN ORDER IN THE DOCUMENT.
   *
   * <p>PDL P28b, 5, 24.09.2026: the other devices being signed out „se kaze coveku PRE nego
   * sto potvrdi, ne posle". So it is not enough that the sentence is somewhere on the screen.
   *
   * <p><b>`compareDocumentPosition` is asked with `contains` beside it</b>, because it sets
   * `FOLLOWING` for a descendant as well as for a sibling: without that the warning would
   * „precede" the button simply by containing it, and the case would pass over markup that
   * put it inside.
   */
  it('warns that the other devices go BEFORE there is anything to press', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await passwordPanel()
    const warning = within(panel).getByText(sr.account.passwordSignsOthersOut)
    const button = within(panel).getByRole('button', { name: sr.account.passwordSubmit })

    expect(warning.contains(button)).toBe(false)
    expect(warning.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    /* And it is part of the button for somebody who never sees the page, rather than a
       paragraph he would have to go looking for. */
    expect(button).toHaveAccessibleDescription(new RegExp(sr.account.passwordSignsOthersOut))
  })

  it('has nothing to press until all three boxes are filled', async () => {
    const user = setupUser()

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await passwordPanel()

    await user.type(within(panel).getByLabelText(/Trenutna lozinka/), 'the old one')

    expect(within(panel).getByRole('button', { name: sr.account.passwordSubmit })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  /**
   * <p><b>The repeat is sent as itself and never as the new one twice.</b> That is the
   * replacement of the source this case is built around: sending `password` into both would
   * make every mismatch a success, and the server would never see the disagreement it is the
   * one to judge.
   */
  it('sends all three as they were typed, and says the other devices are gone', async () => {
    const user = setupUser()
    let asked: Asked[] = []
    ;({ stop, asked } = serverThat((path, init) =>
      path === '/api/me/password' && init?.method === 'PUT' ? answeredWith(204) : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await passwordPanel()

    await user.type(within(panel).getByLabelText(/Trenutna lozinka/), 'the old one')
    await user.type(within(panel).getByLabelText(/^Nova lozinka/), 'a brand new one')
    await user.type(within(panel).getByLabelText(/Ponovi novu lozinku/), 'typed again')
    await user.click(within(panel).getByRole('button', { name: sr.account.passwordSubmit }))

    expect(await within(panel).findByText(sr.account.passwordDone)).toBeInTheDocument()

    const sent = must(
      asked.find((one) => one.path === '/api/me/password'),
      'the screen asked the server to change the password',
    )

    expect(JSON.parse(String(sent.init?.body))).toEqual({
      oldPassword: 'the old one',
      password: 'a brand new one',
      passwordRepeat: 'typed again',
    })
  })

  it('says so when the current password was wrong, and keeps the form', async () => {
    const user = setupUser()
    ;({ stop } = serverThat((path, init) =>
      path === '/api/me/password' && init?.method === 'PUT'
        ? refused('theOldPasswordIsWrong')
        : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await passwordPanel()

    await user.type(within(panel).getByLabelText(/Trenutna lozinka/), 'not the old one')
    await user.type(within(panel).getByLabelText(/^Nova lozinka/), 'a brand new one')
    await user.type(within(panel).getByLabelText(/Ponovi novu lozinku/), 'a brand new one')
    await user.click(within(panel).getByRole('button', { name: sr.account.passwordSubmit }))

    expect(await within(panel).findByText(sr.account.oldPasswordIsWrong)).toBeInTheDocument()
    expect(within(panel).queryByText(sr.account.passwordDone)).not.toBeInTheDocument()
    expect(within(panel).getByLabelText(/Trenutna lozinka/)).toBeInTheDocument()
  })

  /** The sentence about a form that is not complete carries the one number this portal has
   *  for the length of a password, rather than telling somebody to guess again. */
  it('names how long a password must be when the server refuses it for being short', async () => {
    const user = setupUser()
    ;({ stop } = serverThat((path, init) =>
      path === '/api/me/password' && init?.method === 'PUT'
        ? refused('theFormIsNotComplete')
        : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await passwordPanel()

    await user.type(within(panel).getByLabelText(/Trenutna lozinka/), 'the old one')
    await user.type(within(panel).getByLabelText(/^Nova lozinka/), 'short')
    await user.type(within(panel).getByLabelText(/Ponovi novu lozinku/), 'short')
    await user.click(within(panel).getByRole('button', { name: sr.account.passwordSubmit }))

    expect(await within(panel).findByText(/12/)).toBeInTheDocument()
  })

  it('says so when the portal could not be reached at all', async () => {
    const user = setupUser()
    ;({ stop } = serverThat((path, init) => {
      if (path === '/api/me/password' && init?.method === 'PUT') {
        throw new Error('no connection')
      }

      return null
    }))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await passwordPanel()

    await user.type(within(panel).getByLabelText(/Trenutna lozinka/), 'the old one')
    await user.type(within(panel).getByLabelText(/^Nova lozinka/), 'a brand new one')
    await user.type(within(panel).getByLabelText(/Ponovi novu lozinku/), 'a brand new one')
    await user.click(within(panel).getByRole('button', { name: sr.account.passwordSubmit }))

    expect(await within(panel).findByText(sr.server.nothing)).toBeInTheDocument()
  })
})
