import { screen, within } from '@testing-library/react'
import { loadResource } from '../../data/client'
import type { BtlEvent, Race } from '../../data/types'
import { first, htmlElement, inputElement, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'

/**
 * The form a result is entered on from a profile, away from the calendar.
 *
 * What is held here is the part of it the owner asked for on 23.08.2026: the
 * list of races under the name of an event, what choosing one does to the fields
 * under it, what editing the name afterwards undoes, and the way out of a picture
 * that was attached by mistake.
 */

const ME = '000007'
const NEW = '/sr/rezultat/novi'
/** A day inside the data, so what the list offers is the same list every time
 *  this runs rather than the same list until the calendar catches up. */
const TODAY = '2026-08-23'

/** The box the name of the event is typed into. */
function eventName(): HTMLElement {
  return screen.getByLabelText(/Naziv događaja/)
}

/** What the list under it offers, in the order it offers it. */
function offered(): string[] {
  const list = screen.queryByRole('list', { name: '' })

  return list === null
    ? []
    : within(list)
        .getAllByRole('button')
        .map((one) => one.textContent ?? '')
}

/** The four the calendar fills in, by the name each is asked under. */
const FILLED = [/^Datum/, /^Dužina/, /^Uspon/, /^Spust/] as const

describe('the list of races under the name of an event', () => {
  it('says nothing until two letters have been typed', async () => {
    /* Owner, 23.08.2026: „posle dva slova treba da krene autocomplete". Both
       sides of the boundary, because a list that opens on the first letter is a
       list of everything the league has ever run. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/Naziv događaja/), 'b')

    expect(offered()).toEqual([])

    await user.type(eventName(), 'e')

    expect(offered().length).toBeGreaterThan(0)
  })

  it('writes each race as its event, its day and its length', async () => {
    /* „Beogradski maraton – 19.04.2026. – 42.2" (owner). The day is the one
       numeric date shape on the portal, and it is here because he named it
       twice; the length is written the way every other screen writes one. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/Naziv događaja/), 'beogradski maraton')

    for (const row of offered()) {
      expect(row, 'a row of the list is not written the way the owner asked').toMatch(
        /^.+ – \d{2}\.\d{2}\.\d{4}\. – \d+,\d km$/,
      )
    }

    expect(offered().length).toBeGreaterThan(0)
  })

  it('offers what has been run, newest first, and never what is still to come', async () => {
    /* Owner: „U autocomplete se navode samo događaji koji su u prošlosti ili na
       taj dan, ne ubuduće", „sortiranih po datumu od poslednje prema ranijim".

       Read against the data rather than against a written list, so the day the
       calendar changes this says what the screen says. The day itself counts as
       past, which is the boundary the whole portal keeps (PDL P9). */
    const races = await loadResource<Race[]>('races')
    const events = await loadResource<BtlEvent[]>('events')
    const named = new Map(events.map((one) => [one.id, one.name]))
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/Naziv događaja/), 'trka')

    const rows = offered()
    const days = rows.map((row) => must(/(\d{2})\.(\d{2})\.(\d{4})\./.exec(row), 'the day in a row'))
    const asIso = days.map((found) => `${found[3] ?? ''}-${found[2] ?? ''}-${found[1] ?? ''}`)

    expect(rows.length).toBeGreaterThan(1)
    expect([...asIso].sort().reverse(), 'the list is not newest first').toEqual(asIso)
    for (const day of asIso) {
      expect(day <= TODAY, `${day} has not been run yet`).toBe(true)
    }

    /* And every row is a race this league has, rather than a row built out of
       whatever was typed. */
    const matching = races.filter(
      (race) => race.date <= TODAY && (named.get(race.eventId) ?? '').toLocaleLowerCase().includes('trka'),
    )

    expect(matching.length).toBeGreaterThan(rows.length)
  })

  it('offers no more than eight at once', async () => {
    /* Every row is a stop on the way through the form with a keyboard
       (forms/Suggesting.tsx). Held with a search that matches far more than
       eight, so this is a cap and not a coincidence. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/Naziv događaja/), 'ka')

    expect(offered()).toHaveLength(8)
  })

  it('says out loud that the list opened, and how long it is', async () => {
    /* For a reader who cannot see it appear under the box. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/Naziv događaja/), 'ka')

    /* One of the live regions on the screen and not the only one: a form has its
       own and so does every list that grows. What is held is that this sentence
       is said in one of them. */
    expect(screen.getAllByRole('status').map((one) => one.textContent)).toContain(
      '8 trka iz kalendara odgovara',
    )
  })

  it('closes on Escape and opens again on the next letter', async () => {
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/Naziv događaja/), 'ka')

    expect(offered().length).toBeGreaterThan(0)

    await user.keyboard('{Escape}')

    expect(offered()).toEqual([])

    await user.type(eventName(), 'l')

    expect(offered().length).toBeGreaterThan(0)
  })
})

describe('a race chosen out of that list', () => {
  /** Types two letters and presses the first row, which is what a member does. */
  async function choose(user: ReturnType<typeof setupUser>, said = 'beogradski maraton') {
    renderAt(NEW, 'competitor', ME, undefined, TODAY)
    await user.type(await screen.findByLabelText(/Naziv događaja/), said)

    const list = screen.getByRole('list', { name: '' })
    const row = first(within(list).getAllByRole('button'))
    const words = row.textContent ?? ''

    await user.click(row)

    return words
  }

  it('writes only the name of the event, and fills the four the race carries', async () => {
    /* Owner: „u polje Naziv događaja se upisuje samo naziv (Beogradski maraton),
       a sva ostala naredna polja (Datum, Dužina, Uspon, Spust) se popune i
       naprave disabled". */
    const user = setupUser()
    const words = await choose(user)

    expect(eventName()).toHaveValue(must(words.split(' – ')[0], 'the name in the row'))

    for (const asked of FILLED) {
      const box = screen.getByLabelText(asked)

      expect(box, `${String(asked)} was not filled from the race`).not.toHaveValue('')
      expect(box, `${String(asked)} is not locked`).toBeDisabled()
    }

    /* The time is still the member's to type: it is the one thing the calendar
       does not know. */
    expect(screen.getByLabelText(/^Sati/)).toBeEnabled()
    expect(offered(), 'the list stayed open over the fields it had just filled').toEqual([])
  })

  it('locks the calendar beside the date as well as the box itself', async () => {
    /* A date that cannot be typed and can still be pressed out of a calendar is
       a locked field with a way round it. */
    const user = setupUser()

    await choose(user)

    const field = htmlElement(
      must(screen.getByLabelText(/^Datum/).closest('.field'), 'the date field'),
    )

    expect(within(field).getByRole('button', { name: 'Otvori kalendar' })).toBeDisabled()
  })

  it('hands all four back, empty, the moment the name is edited', async () => {
    /* Owner: „Naziv događaja mogu da editujem, ali onda puca konekcija sa ostalim
       poljima". Emptied and not merely unlocked, which is what he chose when
       asked: a name typed freely must not stand over somebody else's date and
       distance. */
    const user = setupUser()

    await choose(user)
    await user.type(eventName(), ' i po')

    for (const asked of FILLED) {
      const box = screen.getByLabelText(asked)

      /* Read off the box rather than through `toHaveValue`, which answers `null`
         for an empty number and `''` for an empty text box, and these four are
         both kinds. */
      expect(inputElement(box).value, `${String(asked)} kept what the race had`).toBe('')
      expect(box, `${String(asked)} is still locked`).toBeEnabled()
    }
  })
})

describe('a picture attached to a result', () => {
  /** The row the picture is asked for in. */
  function photoField(): HTMLElement {
    return htmlElement(
      must(screen.getByLabelText(/Slika kao dokaz/).closest('.field'), 'the picture field'),
    )
  }

  it('offers no way out while there is nothing to undo', async () => {
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    await screen.findByLabelText(/Naziv događaja/)

    expect(within(photoField()).queryByRole('button', { name: 'Obriši' })).toBeNull()
  })

  it('is taken back off again, from the browser as well as from the form', async () => {
    /* Owner, 23.08.2026: „jer trenutno ne mogu da odustanem od slanja slike".
       Both halves, because a file box holds its own copy of what was chosen and
       nothing but the browser may write to it: emptying our value alone leaves
       the name of the file standing beside a field that thinks it is empty. */
    const user = setupUser()

    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const box = await screen.findByLabelText(/Slika kao dokaz/)

    await user.upload(box, new File(['proba'], 'dokaz.jpg', { type: 'image/jpeg' }))

    const gone = within(photoField()).getByRole('button', { name: 'Obriši' })

    expect(inputElement(box).files).toHaveLength(1)

    await user.click(gone)

    const after = screen.getByLabelText(/Slika kao dokaz/)

    expect(inputElement(after).files).toHaveLength(0)
    expect(within(photoField()).queryByRole('button', { name: 'Obriši' })).toBeNull()
  })
})

describe('the foot of the form', () => {
  it('asks for the link, then the picture, then the comment', async () => {
    /* Owner, 23.08.2026: „Slika kao dokaz treba da se nađe iznad komentara, a
       ispod linka ka zvaničnim rezultatima". The picture is the reason the
       comment becomes obligatory (Član 37), so it stands before it. */
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    await screen.findByLabelText(/Naziv događaja/)

    const asked = [...document.querySelectorAll('.field__label')].map(
      (one) => one.textContent ?? '',
    )
    const foot = asked.slice(-3).map((one) => one.replace(/\s*\(neobavezno\)\s*$/, '').trim())

    expect(foot).toEqual(['Link ka zvaničnim rezultatima', 'Slika kao dokaz', 'Komentar'])
  })
})
