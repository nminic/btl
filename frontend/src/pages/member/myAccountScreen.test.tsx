import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Competitor } from '../../data/types'
import { at, inputElement, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { myOwnRecordFromMe } from '../../test/theAnswer'
import { setupUser } from '../../test/user'
import en from '../../i18n/en.json'
import sr from '../../i18n/sr.json'
import { TYPED_BOXES, type TypedBox } from './myAccount'

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

/** The panel a case is talking about, so a query cannot wander into the one below it. */
/**
 * WHERE A MEMBER'S OWN DATA ARE, since 23.10.2026: the card „Podaci" of his own profile (PDL 22.10.2026,
 * „Profil dobija karticu „Podaci""), and no longer the screen of the settings, which the cases of the
 * password below still open.
 */
const HIS_CARD = `/sr/takmicar/${ME.memberNumber}/podaci`

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

/**
 * A BOX THAT ALREADY HOLDS SOMETHING IS TYPED OVER, NOT TYPED INTO.
 *
 * <p>The postal address and the telephone open holding what the server holds (18.10.2026), so
 * `user.type` appends to it. A case that means to change the telephone replaces it, as a member
 * does by selecting the box and typing.
 */
async function typeOver(
  user: ReturnType<typeof setupUser>,
  box: HTMLElement,
  text: string,
): Promise<void> {
  await user.clear(box)
  await user.type(box, text)
}

function theBox(panel: HTMLElement, label: RegExp): HTMLInputElement {
  return inputElement(within(panel).getByRole('textbox', { name: label }))
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** A field of a body that came off the wire, as text, or nothing where it was not named. */
function textIn(body: unknown, name: string): string | undefined {
  const said: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, name) : undefined

  return typeof said === 'string' ? said : undefined
}

/**
 * `GET /api/me` AS THE SERVER ANSWERS THE MEMBER THESE CASES SIGN IN AS, with the two private
 * columns he holds.
 *
 * <p>The telephone is left out for a member who has none, which is how the server says it
 * (`MeApi.MyOwnRecord`, `@JsonInclude(NON_NULL)`). Everything else is the sample's own, with the
 * member's name and category over it, so the session and the panel agree about who is reading.
 */
function hisRecord(held: { address: string; phone?: string }): Record<string, unknown> {
  const withoutTheTelephone = Object.fromEntries(
    Object.entries(myOwnRecordFromMe).filter(([name]) => name !== 'phone'),
  )

  return {
    ...withoutTheTelephone,
    memberNumber: ME.memberNumber,
    firstName: ME.firstName,
    lastName: ME.lastName,
    gender: ME.gender,
    city: ME.city,
    ageBand: ME.ageBand,
    firstSeason2027: ME.firstSeason2027,
    address: held.address,
    ...(held.phone === undefined ? {} : { phone: held.phone }),
  }
}

/**
 * A SERVER THAT KEEPS WHAT IT IS TOLD, which is the thing the fault of 18.10.2026 could not be
 * seen without: one that answers a `PUT` and a later `GET` out of the same place.
 *
 * <p>It stores what it is sent the way the route does - stripped of the spaces around it, and a
 * blank telephone as none (V8: "no phone is NULL") - so what it answers afterwards is NOT what the
 * screen typed. A screen that drew the box from its own memory of what it had just sent would show
 * the typed spaces; one that draws it from the server shows the stripped value, and the case tells
 * them apart on that.
 *
 * @param opening what the server holds before the visit
 * @returns what was asked, how to put the disc reader back, and what is held now
 */
function aServerThatKeepsWhatItIsTold(opening: { address: string; phone?: string }): {
  asked: Asked[]
  stop: () => void
  held: () => { address: string; phone?: string }
} {
  const held = { ...opening }

  const { asked, stop } = serverThat((path, init) => {
    if (path !== '/api/me') {
      return null
    }

    if (init?.method === 'PUT') {
      const body: unknown = JSON.parse(String(init.body))
      const address = textIn(body, 'address')
      const phone = textIn(body, 'phone')

      if (address !== undefined) {
        held.address = address.trim()
      }

      if (phone !== undefined) {
        if (phone.trim() === '') {
          delete held.phone
        } else {
          held.phone = phone.trim()
        }
      }

      return jsonResponse({ address: held.address })
    }

    return jsonResponse({ role: 'competitor', account: 1, member: hisRecord(held), mailLanguage: 'sr' })
  })

  return { asked, stop, held: () => ({ ...held }) }
}

describe('a member’s own data', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
  })

  it('opens with what the portal really holds about him, and not with somebody else’s', async () => {
    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    expect(typedBox(panel, /^Ime/)).toHaveValue(ME.firstName)
    expect(within(panel).getByRole('textbox', { name: /Prezime/ })).toHaveValue(ME.lastName)
    expect(within(panel).queryByDisplayValue(SOMEBODY_ELSE.firstName)).not.toBeInTheDocument()
  })

  /**
   * <p><b>The two boxes open holding what the server holds</b>, and this is the half of the fault
   * of 18.10.2026 that is about OPENING. The owner saved a postal address and a telephone, refreshed,
   * and found both boxes empty, because nothing served them and the screen drew an empty box with a
   * sentence beside it. The values come from a server that holds a pair of its own, which the
   * sample and the other members do not carry, so a box drawn from anything but the server's own
   * answer holds a different string.
   */
  it('opens with the postal address and the telephone the server holds', async () => {
    ;({ stop } = aServerThatKeepsWhatItIsTold({
      address: 'Vojvode Stepa 5',
      phone: '+381 11 765 432',
    }))

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    expect(theBox(panel, /Adresa za slanje/)).toHaveValue('Vojvode Stepa 5')
    expect(theBox(panel, /Telefon/)).toHaveValue('+381 11 765 432')
  })

  /** The other state of the telephone: a member who has none is handed no key, and his box is empty. */
  it('opens with an empty telephone for a member who has none, and his address beside it', async () => {
    ;({ stop } = aServerThatKeepsWhatItIsTold({ address: 'Vojvode Stepa 5' }))

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    expect(theBox(panel, /Telefon/)).toHaveValue('')
    expect(theBox(panel, /Adresa za slanje/)).toHaveValue('Vojvode Stepa 5')
  })

  /**
   * <p><b>The button is told off while nothing has changed, and it says nothing about why</b> (PDL P11,
   * owner, 18.10.2026, "Strana Podešavanja, sa snimaka": the sentence "Izmeni nešto da bi imao šta da
   * sačuvaš." is gone and the buttons stay told off). So it is reachable and pressing it sends nothing,
   * and it points at no sentence: an `aria-describedby` left naming an element that is not there is a
   * description a screen reader announces as nothing.
   */
  it('has nothing to save until something is changed, and says nothing about it', async () => {
    const user = setupUser()
    const { asked, stop: put } = serverThat(() => null)

    stop = put
    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()
    const save = within(panel).getByRole('button', { name: sr.account.save })

    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(save).not.toHaveAttribute('aria-describedby')
    expect(panel.querySelector('[role="status"]'), 'a sentence about the button stands on the panel').toBeNull()

    await user.click(save)

    expect(asked.filter((one) => one.init?.method === 'PUT')).toEqual([])
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

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await typeOver(user, within(panel).getByRole('textbox', { name: /Telefon/ }), '065 1234')
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

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

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

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await typeOver(user, within(panel).getByRole('textbox', { name: /Telefon/ }), '065')
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

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await typeOver(user, within(panel).getByRole('textbox', { name: /Telefon/ }), '065')
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

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await typeOver(user, within(panel).getByRole('textbox', { name: /Telefon/ }), '065')
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))
    await within(panel).findByText(sr.account.saved)

    await user.type(within(panel).getByRole('textbox', { name: /Telefon/ }), '9')

    expect(within(panel).queryByText(sr.account.saved)).not.toBeInTheDocument()
  })

  /**
   * <p>What the server holds after a save is what the screen compares with next, so pressing Save
   * again sends nothing: the button is told off. Without this, a screen that went on comparing with
   * what the box held when it OPENED would offer the same change again after every save.
   */
  it('has nothing left to save once it has been saved', async () => {
    const user = setupUser()
    ;({ stop } = aServerThatKeepsWhatItIsTold({ address: 'Vojvode Stepa 5' }))

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await typeOver(user, theBox(panel, /Telefon/), '065 1234')
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))
    await within(panel).findByText(sr.account.saved)

    expect(within(panel).getByRole('button', { name: sr.account.save })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  /**
   * THE ROUND TRIP, WHICH IS THE CASE THE FAULT OF 18.10.2026 WAS INVISIBLE WITHOUT.
   *
   * <p>The owner typed a postal address and a telephone on QA, pressed Save, read „Sačuvano",
   * refreshed the page and found both boxes empty. Every case above asks what was SENT and what was
   * SAID; none asked what the next visit is drawn from. The screen is torn down and drawn again
   * (`cleanup`, which is a refresh: nothing of the old screen survives but the server), and the boxes
   * must hold what the SERVER kept.
   *
   * <p><b>Two sources of one value, and the case separates them.</b> The box could be filled from the
   * answer the server gives on the second visit, or from anything the screen remembered of the first
   * one. The server keeps the value stripped of the spaces the member typed around it, so the two
   * are different strings and only one of them is in the box when the screen is drawn from the
   * server. The telephone and the address are asked together, because a screen that read one of the
   * two from the right place and the other from nowhere would pass either alone.
   */
  it('shows after a refresh what the server kept, and not what was typed', async () => {
    const user = setupUser()
    const kept = aServerThatKeepsWhatItIsTold({ address: 'Vojvode Stepa 5' })
    stop = kept.stop

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await typeOver(user, theBox(panel, /Adresa za slanje/), '  Bulevar oslobođenja 12  ')
    await typeOver(user, theBox(panel, /Telefon/), '  065 1234  ')
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))
    await within(panel).findByText(sr.account.saved)

    expect(kept.held(), 'the server was not told what the member typed').toEqual({
      address: 'Bulevar oslobođenja 12',
      phone: '065 1234',
    })

    cleanup()
    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const again = await personalPanel()

    expect(theBox(again, /Adresa za slanje/)).toHaveValue('Bulevar oslobođenja 12')
    expect(theBox(again, /Telefon/)).toHaveValue('065 1234')
  })

  /**
   * AND THE OTHER DIRECTION OF THE SAME ROUND TRIP: A TELEPHONE REMOVED STAYS REMOVED.
   *
   * <p>Emptying the box is how a member removes the number, and it must reach the server as the
   * blank the route reads as a removal. The case above is satisfied by a screen that only ever
   * sends non-empty values; this one is not, and the address beside it must not move.
   */
  it('shows no telephone after a refresh once he has removed it, and the address still stands', async () => {
    const user = setupUser()
    const kept = aServerThatKeepsWhatItIsTold({
      address: 'Vojvode Stepa 5',
      phone: '+381 11 765 432',
    })
    stop = kept.stop

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await user.clear(theBox(panel, /Telefon/))
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))
    await within(panel).findByText(sr.account.saved)

    const sent = must(
      kept.asked.find((one) => one.path === '/api/me' && one.init?.method === 'PUT'),
      'the screen asked the server to remove the telephone',
    )

    expect(JSON.parse(String(sent.init?.body)), 'the request named something besides the telephone').toEqual({
      phone: '',
    })
    expect(kept.held()).toEqual({ address: 'Vojvode Stepa 5' })

    cleanup()
    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const again = await personalPanel()

    expect(theBox(again, /Telefon/)).toHaveValue('')
    expect(theBox(again, /Adresa za slanje/)).toHaveValue('Vojvode Stepa 5')
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

/**
 * THE ONE BOX A MEMBER TYPES INTO that goes by these words, the held ones not counted: the box of his
 * father's name is drawn beside „Ime" since 24.10.2026 and begins with the same word, but it is held
 * (`readOnly`, PDL 24.10.2026) and nothing he does moves it.
 */
function typedBox(panel: HTMLElement, name: RegExp): HTMLElement {
  const typed = within(panel)
    .getAllByRole('textbox', { name })
    .filter((one) => !one.hasAttribute('readonly'))

  expect(typed, `exactly one box he types into goes by ${String(name)}`).toHaveLength(1)

  return at(typed, 0)
}

/** The four boxes, by the name the portal sends each under, found by the words on their labels. */
function personalBoxes(panel: HTMLElement): { name: TypedBox; box: HTMLInputElement }[] {
  return TYPED_BOXES.map((name) => ({
    name,
    box: inputElement(typedBox(panel, new RegExp(`^${sr.registration[name]}`))),
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

describe('which boxes of a member’s own data are asked for', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
  })

  /**
   * A BOX IS ASKED FOR WHEN THE SERVER WILL NOT TAKE IT EMPTY.
   *
   * <p>PENDING 217.5 asked for it only where the portal could also see what the server held, because
   * an address it could not see was a box a member could leave alone. It sees all four since
   * 18.10.2026, so the server's own list is the whole answer and the second half is gone. What the
   * server takes empty comes off the Java (`neverEmptiedByTheServer`), and the three things a box says
   * about itself - the star, `aria-required` and the word „neobavezno" - are all read, because the
   * first two are one decision and neither works alone (`forms/AskedLabel.tsx`), and the third is the
   * label saying the opposite for the same box.
   */
  function expectEachBoxAsked(panel: HTMLElement): void {
    const neverEmptied = neverEmptiedByTheServer()

    for (const { name, box } of personalBoxes(panel)) {
      const asked = neverEmptied.includes(name)

      expect(box.getAttribute('aria-required'), `aria-required on ${name}`).toBe(asked ? 'true' : null)
      expect(hasTheStar(box), `the star beside ${name}`).toBe(asked)
      expect(saysOptional(box), `the word „${sr.form.optional}" beside ${name}`).toBe(!asked)
    }
  }

  it('asks for the address and not for the telephone, as the server takes them', async () => {
    ;({ stop } = aServerThatKeepsWhatItIsTold({ address: 'Vojvode Stepa 5' }))

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()
    const neverEmptied = neverEmptiedByTheServer()

    /* **THE TWO SOURCES ARE PULLED APART BEFORE ANYTHING IS ASKED OF THEM.** The telephone is empty
       here and the address is not, so „asked for" and „holds something" are two different facts and
       the loop below cannot be satisfied by reading either one: a box asked for because it is full
       would star the address and miss the name, and one asked for because it is empty would star the
       telephone. */
    expect(neverEmptied, 'the Java list names nothing, so this measures nothing').not.toEqual([])
    expect(neverEmptied).toContain('address')
    expect(neverEmptied).not.toContain('phone')
    expect(theBox(panel, /Telefon/)).toHaveValue('')

    expectEachBoxAsked(panel)
  })

  /**
   * <p><b>The same answer with the telephone FULL</b>, so a box starred because it is empty is told
   * apart from one starred because the server takes no empty one: the telephone holds a number here
   * and is still not asked for, and the address is.
   */
  it('still does not ask for the telephone when it holds a number', async () => {
    ;({ stop } = aServerThatKeepsWhatItIsTold({
      address: 'Vojvode Stepa 5',
      phone: '+381 11 765 432',
    }))

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    expect(theBox(panel, /Telefon/)).toHaveValue('+381 11 765 432')
    expectEachBoxAsked(panel)
  })

  /**
   * <p><b>Typing is not what decides it.</b> Emptying the address does not stop it being asked for,
   * and typing a telephone does not start it: the star follows the server's list and not the box.
   */
  it('does not change what it asks for because of what is typed', async () => {
    const user = setupUser()
    ;({ stop } = aServerThatKeepsWhatItIsTold({ address: 'Vojvode Stepa 5' }))

    renderAt(HIS_CARD, 'competitor', ME.memberNumber)

    const panel = await personalPanel()

    await user.clear(theBox(panel, /Adresa za slanje/))
    await user.type(theBox(panel, /Telefon/), '065 1234')

    expectEachBoxAsked(panel)
  })
})

/**
 * WHAT THE OWNER TOOK OFF THE SCREEN, ASKED OF THE SCREEN AND OF THE DICTIONARIES (PDL P11, owner,
 * 18.10.2026, "Strana Podešavanja, sa snimaka").
 *
 * <p>The words below are the sentences of that entry, copied from it and not read from the dictionary,
 * because the keys that carried them are gone: a case that read `sr.account.lockedTitle` could not
 * fail on the day somebody wrote the sentence back under another name. Each is asked of the drawn
 * panel AND of both dictionaries, because a sentence put back as a new key on a screen that did not draw
 * it yet would pass the first and be a sentence the next screen draws.
 */
const WHAT_THE_OWNER_TOOK_OFF = [
  'Izmena ovde stupa odmah, bez odobrenja.',
  'Izmeni nešto da bi imao šta da sačuvaš.',
  'Pomeri krug ili izaberi novu sliku da bi mogao da pošalješ.',
  'Napiši nešto da bi mogao da pošalješ.',
  'Mejlovi koje ti portal šalje stižu na jeziku koji ovde izabereš.',
  /* Under the box of what he may not change: its three explanations and the field for the address
     of post with its reason. */
  'Pol i datum rođenja menja samo administracija, jer se iz njih izvode',
  'Datum rođenja se ovde ne prikazuje',
  'Mesto se bira iz šifarnika naselja',
  'Adresu elektronske pošte menjaš sam, ali novu moraš da potvrdiš',
] as const

/** Every string a dictionary holds, however deep. */
function everyWordOf(node: unknown): string[] {
  if (typeof node === 'string') {
    return [node]
  }

  if (typeof node === 'object' && node !== null) {
    return Object.values(node).flatMap(everyWordOf)
  }

  return []
}

describe('what the owner took off the settings screen', () => {
  it.each(WHAT_THE_OWNER_TOOK_OFF)('is not a sentence of either dictionary: %s', (sentence) => {
    expect(everyWordOf(sr).filter((one) => one.includes(sentence))).toEqual([])
    expect(everyWordOf(en).filter((one) => one.includes(sentence))).toEqual([])
  })

  it('is not on the screen of a member whose fee stands, and the box of what he may not change is gone', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    await screen.findByRole('region', { name: sr.settings.mail })

    /* AND NEITHER ARE HIS DATA, since 23.10.2026: they are on the card „Podaci" of his profile. */
    expect(screen.queryByRole('heading', { name: sr.account.personalTitle })).toBeNull()

    for (const sentence of WHAT_THE_OWNER_TOOK_OFF) {
      expect(screen.queryByText(new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))), sentence).toBeNull()
    }

    expect(screen.queryByRole('heading', { name: 'Podaci koji se ne menjaju ovde' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: /Adresa elektronske pošte/ })).toBeNull()
    expect(screen.queryByText(`M ${ME.ageBand}`), 'the category of the box that is gone').toBeNull()
  })

  it('leaves no control of the screen naming a sentence that is not there', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME.memberNumber)

    await screen.findByRole('region', { name: sr.settings.mail })

    for (const one of document.querySelectorAll('[aria-describedby]')) {
      for (const id of (one.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)) {
        expect(document.getElementById(id), `${id} is named by a control and is not on the page`).not.toBeNull()
      }
    }
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
