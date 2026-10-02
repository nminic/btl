import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Competitor } from '../../data/types'
import { at, inputElement, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import sr from '../../i18n/sr.json'
import { WHAT_THIS_SCREEN_SENDS, type Sent } from './myAccount'

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
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
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

/**
 * AND A MEMBER OF THE OTHER GENDER, because gender is an axis with two states and a screen
 * measured on one of them is measured on half of itself.
 *
 * <p>Taken out of the file rather than named, like the rest: the word beside „Pol" and the
 * letter the category starts with both come off this one field, so a screen that had it
 * written in would pass every case above and say „Muškarci" to every woman in the league.
 */
const HER = must(
  members.find((one) => one.gender === 'F'),
  'the seed still has a member whose gender is the other one',
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

  /**
   * TWO PRESSES WHILE THE FIRST IS STILL OUT ARE ONE REQUEST.
   *
   * <p>The answer is held open on purpose rather than raced for: a case that pressed twice
   * and hoped the second landed first would pass or fail by scheduling. Holding the promise
   * makes the second press certainly happen while the first is in flight, which is the only
   * state this guard is about.
   *
   * <p>Without the guard the member sends the same change twice and is told about the
   * SECOND one, which by then is a request that changes nothing.
   */
  it('sends one request for two presses while the first is still out', async () => {
    const user = setupUser()
    let release = (): void => {}
    const held = new Promise<Response>((resolve) => {
      release = () => resolve(answeredWith(200))
    })
    let asked: Asked[] = []
    ;({ stop, asked } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT' ? held : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await user.type(within(panel).getByRole('textbox', { name: /Telefon/ }), '065')
    const save = within(panel).getByRole('button', { name: sr.account.save })

    await user.click(save)
    await user.click(save)
    release()

    expect(await within(panel).findByText(sr.account.saved)).toBeInTheDocument()
    expect(
      asked.filter((one) => one.path === '/api/me' && one.init?.method === 'PUT'),
    ).toHaveLength(1)
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
   * <p><b>„Kept" must not outlive the thing it was said about.</b> Left standing over a box
   * being edited it says what is on the screen is what the server holds, which it is not: the
   * member would read his own unsaved typing as saved and leave.
   */
  it('takes back the confirmation the moment a box is edited again', async () => {
    const user = setupUser()
    ;({ stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT' ? answeredWith(200) : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await user.type(within(panel).getByRole('textbox', { name: /Telefon/ }), '065')
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))
    await within(panel).findByText(sr.account.saved)

    await user.type(within(panel).getByRole('textbox', { name: /Telefon/ }), '9')

    expect(within(panel).queryByText(sr.account.saved)).not.toBeInTheDocument()
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

/** Where the server's own source lives, spelled the way `myAccount.test.ts` spells it. */
const WEB = join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web')

/**
 * THE BOXES THE SERVER WILL NOT TAKE EMPTY, read off the Java that refuses them.
 *
 * <p>{@code MeWriteApi.NEVER_EMPTIED}, which V7 and V8 settle: the two names and the address are
 * refused when blank, while a blank telephone is a removal. It is read here and written nowhere
 * in this file, so what the screen asks for is held to the server's own list from the OUTSIDE: a
 * box added to it or taken off it moves the answer of every case below without anybody having to
 * remember them. That is the join between two layers, and it is the one a mutation of either side
 * alone has to break.
 */
function neverEmptiedByTheServer(): string[] {
  const java = readFileSync(join(WEB, 'MeWriteApi.java'), 'utf-8')
  const declared = must(
    /NEVER_EMPTIED\s*=\s*List\.of\(([^)]*)\)/.exec(java),
    'a NEVER_EMPTIED list in MeWriteApi.java',
  )

  return [...at(declared, 1).matchAll(/"([^"]+)"/g)].map((one) => at(one, 1))
}

/** The four boxes, by the name the portal sends each under, found by the words on their labels. */
function personalBoxes(panel: HTMLElement): { name: Sent; box: HTMLInputElement }[] {
  return WHAT_THIS_SCREEN_SENDS.map((name) => ({
    name,
    box: inputElement(
      within(panel).getByRole('textbox', { name: new RegExp(`^${sr.registration[name]}`) }),
    ),
  }))
}

function labelOf(box: HTMLInputElement): HTMLLabelElement {
  return at(box.labels ?? undefined, 0)
}

/** The star beside the name of a field that is asked for. It stands OUTSIDE the label
 *  (`forms/AskedLabel.tsx`), so it is the next thing after it. */
function hasTheStar(box: HTMLInputElement): boolean {
  return labelOf(box).nextElementSibling?.textContent === '*'
}

/** The word beside the name of a field that may be left empty. */
function saysOptional(box: HTMLInputElement): boolean {
  return (labelOf(box).textContent ?? '').includes(sr.form.optional)
}

/** The boxes the screen says it cannot see what stands in, read off the sentence that says so. */
function unseen(panel: HTMLElement, boxes: { name: Sent; box: HTMLInputElement }[]): Sent[] {
  const notes = within(panel).queryAllByText(sr.account.notShown)

  return boxes
    .filter(({ box }) => notes.some((note) => note.id === box.getAttribute('aria-describedby')))
    .map(({ name }) => name)
}

describe('which boxes of a member’s own data are asked for', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
  })

  /**
   * A BOX IS ASKED FOR WHEN THE SERVER WILL NOT TAKE IT EMPTY AND THE PORTAL KNOWS WHAT IT HOLDS.
   *
   * <p>PENDING 217.5. The address carried the star and `aria-required` while the sentence beside
   * it said „Ako ostaviš prazno, ništa se ne menja": a field marked as obligatory over a form that
   * is sent perfectly well without it, which is what a screen reader says out loud to the member
   * who cannot see the sentence. The star and the attribute read a hand-written list („every box
   * but the telephone") while the sentence read a different fact, whether the portal can see what
   * stands there; two facts, and the screen answered for one of them.
   *
   * <p><b>The three things a box says are asked of the DOM and held to two independent sources.</b>
   * What the server takes empty comes off the Java (`neverEmptiedByTheServer`), and what the portal
   * cannot see comes off the sentence on the screen. The star, `aria-required` and the word
   * „neobavezno" are all read, because the first two are one decision and neither works alone
   * (`forms/AskedLabel.tsx`), and the third is the label saying the opposite for the same box.
   */
  function expectEachBoxAsked(panel: HTMLElement): void {
    const boxes = personalBoxes(panel)
    const neverEmptied = neverEmptiedByTheServer()
    const cannotSee = unseen(panel, boxes)

    for (const { name, box } of boxes) {
      const asked = neverEmptied.includes(name) && !cannotSee.includes(name)

      expect(box.getAttribute('aria-required'), `aria-required on ${name}`).toBe(asked ? 'true' : null)
      expect(hasTheStar(box), `the star beside ${name}`).toBe(asked)
      expect(saysOptional(box), `the word „${sr.form.optional}" beside ${name}`).toBe(!asked)
    }
  }

  it('does not ask for the address while the portal cannot see what the server holds there', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()
    const boxes = personalBoxes(panel)
    const neverEmptied = neverEmptiedByTheServer()
    const cannotSee = unseen(panel, boxes)

    /* **THE TWO SOURCES ARE PULLED APART BEFORE ANYTHING IS ASKED OF THEM.** A box that is both
       „never taken empty" and „cannot be seen" is the whole case: without one, „asked for" and
       „seen" are the same fact and the loop below is satisfied by either reading. And one that
       cannot be seen and may be emptied (the telephone) is the other half, so „unseen" cannot pass
       for „optional". */
    expect(neverEmptied, 'the Java list names nothing, so this measures nothing').not.toEqual([])
    expect(cannotSee.filter((name) => neverEmptied.includes(name))).not.toEqual([])
    expect(cannotSee.filter((name) => !neverEmptied.includes(name))).not.toEqual([])

    expectEachBoxAsked(panel)
  })

  /**
   * <p><b>Typing is not knowing.</b> Something in the address box does not tell the portal what the
   * server holds there, so the sentence that says it cannot see stays until a save lands, and the box
   * stays one that may be left alone. Two sources of „is there something in the box": what was typed
   * and what the portal knows. A star that followed the first would come and go with every keystroke
   * over a sentence that said the opposite the whole time.
   */
  it('does not start asking for the address because something was typed into it', async () => {
    const user = setupUser()

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()
    const address = must(
      personalBoxes(panel).find(({ name }) => name === 'address'),
      'the address box',
    )

    await user.type(address.box, 'Ulica 1')

    /* Still unseen, and that is the fixture's own fact, asked rather than assumed. */
    expect(unseen(panel, personalBoxes(panel))).toEqual(['address', 'phone'])
    expectEachBoxAsked(panel)
  })

  /**
   * <p><b>The other state of the same axis, and the one that keeps „not asked" from being
   * hard-wired to the address.</b> Once the portal has written a box it knows what stands there,
   * and the server takes no empty address, so the star comes back; the telephone does not take it
   * even then, because it is known and still optional.
   */
  it('asks for the address once the portal has written one, and still not for the telephone', async () => {
    const user = setupUser()
    ;({ stop } = serverThat((path, init) =>
      path === '/api/me' && init?.method === 'PUT' ? answeredWith(200) : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await personalPanel()
    const typed: Record<Sent, string> = {
      firstName: 'x',
      lastName: 'x',
      address: 'Ulica 1',
      phone: '065 1234',
    }

    for (const { name, box } of personalBoxes(panel)) {
      await user.type(box, typed[name])
    }

    await user.click(within(panel).getByRole('button', { name: sr.account.save }))
    await within(panel).findByText(sr.account.saved)

    /* Every box is seen now, which is the fixture's own fact and is asked rather than assumed: a
       case that went on holding a box unseen would be measuring the state above again. */
    expect(unseen(panel, personalBoxes(panel))).toEqual([])
    expectEachBoxAsked(panel)
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

  /** The other state of the same axis, and both words come off the one field. */
  it('says the other gender, and the other category letter, to a member who is one', async () => {
    renderAt('/sr/podesavanja', 'competitor', HER.memberNumber)
    await screen.findByRole('heading', { level: 2, name: sr.account.lockedTitle })

    const panel = panelOf(sr.account.lockedTitle)

    expect(within(panel).getByText(sr.rankings.women)).toBeInTheDocument()
    expect(within(panel).getByText(`Ž${HER.ageBand}`)).toBeInTheDocument()
    expect(within(panel).queryByText(sr.rankings.men)).not.toBeInTheDocument()
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

  /** The same guard the panel above has, and for a password the cost of losing it is higher:
   *  two requests, and the reader answered about the second. */
  it('sends one request for two presses while the first is still out', async () => {
    const user = setupUser()
    let release = (): void => {}
    const held = new Promise<Response>((resolve) => {
      release = () => resolve(answeredWith(204))
    })
    let asked: Asked[] = []
    ;({ stop, asked } = serverThat((path, init) =>
      path === '/api/me/password' && init?.method === 'PUT' ? held : null,
    ))

    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    const panel = await passwordPanel()

    await user.type(within(panel).getByLabelText(/Trenutna lozinka/), 'the old one')
    await user.type(within(panel).getByLabelText(/^Nova lozinka/), 'a brand new one')
    await user.type(within(panel).getByLabelText(/Ponovi novu lozinku/), 'a brand new one')

    const button = within(panel).getByRole('button', { name: sr.account.passwordSubmit })

    await user.click(button)
    await user.click(button)
    release()

    expect(await within(panel).findByText(sr.account.passwordDone)).toBeInTheDocument()
    expect(asked.filter((one) => one.path === '/api/me/password')).toHaveLength(1)
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
