import { configure, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { must } from '../../test/at'
import { aNeverPaidRecord, neverPaidAsServed } from '../../test/neverPaid'
import { renderAt } from '../../test/render'
import { answeredWith, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { myOwnRecordFromMe } from '../../test/theAnswer'

/**
 * THE FOUR THAT A MEMBER SEES AND DOES NOT CHANGE, on the card „Podaci" of his own profile and on the
 * page „Moji podaci": the gender, the date of birth, the father's name and the number of his
 * identity document.
 *
 * <p>PDL, „Odgovori od 24.10.2026 (popodne)": the owner first said the number of the document stays
 * with the administration and then corrected himself - „clan ga vidi ali je disabled za menjanje. Moze
 * samo da trazi od admina" - and, chosen between offered outcomes with the recommendation, the same
 * holds for the gender, the date of birth and the father's name, with a sentence that the administration
 * changes them on his request. That overturns the reading of PR 643 that he does not see them even
 * held, and narrows the decision of 20.08.2026 that the document and the father's name are shown
 * nowhere: the administration, and now the member himself on his own card.
 *
 * <p><b>Held and not switched off</b>, the way the portal holds a locked box everywhere
 * (`forms/held.ts`): `readOnly` and `aria-disabled`, so a keyboard reaches each of them, a screen reader
 * reads the value and says it is held, and the number can be copied. The sentence is their description.
 *
 * <p><b>Every value is asked of its own box</b>, and the four in each case are four different texts, so
 * a box that took its value from another field of the same record (the father's name from the first
 * name, the document from the telephone) is told from the right one.
 *
 * <p>Every wait is given half of the time a case has.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

const SENTENCE =
  'Pol, datum rođenja, ime oca i broj ličnog dokumenta menja administracija na tvoj zahtev.'

/** The panel of his data, once the server has given it. */
async function thePanel(): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { level: 2, name: 'Lični podaci' })

  return must(heading.closest('section'), 'the panel')
}

function aBox(found: HTMLElement, label: string): HTMLInputElement {
  if (!(found instanceof HTMLInputElement)) {
    throw new Error(`${label} is not a box`)
  }

  return found
}

/**
 * The four held, by the words on their labels: three boxes and the gender, which is the registration's
 * pair of buttons (`registracija.form.json`, `choice`) since the panel took the registration's shape
 * (PDL 06.11.2026), each button a control of its own.
 */
function held(panel: HTMLElement): {
  birthDate: HTMLInputElement
  fatherName: HTMLInputElement
  idNumber: HTMLInputElement
  man: HTMLInputElement
  woman: HTMLInputElement
} {
  const gender = within(panel).getByRole('radiogroup', { name: 'Pol' })

  return {
    birthDate: aBox(within(panel).getByRole('textbox', { name: /^Datum rođenja/ }), 'the date'),
    fatherName: aBox(within(panel).getByRole('textbox', { name: /^Ime oca/ }), "the father's name"),
    idNumber: aBox(within(panel).getByRole('textbox', { name: /^Broj ličnog dokumenta/ }), 'the document'),
    man: aBox(within(gender).getByRole('radio', { name: 'Muški' }), 'a man'),
    woman: aBox(within(gender).getByRole('radio', { name: 'Ženski' }), 'a woman'),
  }
}

/** The ids a control is described by. */
function describedBy(control: HTMLElement): string[] {
  return (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
}

/** The one write of his data the server was asked for, as it was sent. */
function theWrite(asked: { path: string; init?: RequestInit }[]): unknown {
  const sent = must(
    asked.find((one) => one.path === '/api/me' && one.init?.method === 'PUT'),
    'the write',
  )

  return JSON.parse(String(sent.init?.body))
}

describe('on the page „Moji podaci" of somebody who has not paid', () => {
  it('shows the four held, each with its own value', async () => {
    stands(neverPaidAsServed())
    renderAt('/sr/moji-podaci', 'visitor', null)

    const boxes = held(await thePanel())

    expect(boxes.man).toBeChecked()
    expect(boxes.woman).not.toBeChecked()
    expect(boxes.birthDate).toHaveValue('23/11/1992')
    expect(boxes.fatherName).toHaveValue(aNeverPaidRecord.fatherName)
    expect(boxes.idNumber).toHaveValue(aNeverPaidRecord.idNumber)
  }, SLOW)

  /**
   * <p><b>Held, said to be held, and described by the sentence</b>, every one of the five controls; and
   * <b>the boxes he does change are described by nothing of it</b>, so a sentence hung on every field of
   * the form is told from one hung on the held ones (`fixedSaidBy`).
   */
  it('holds them: read only, said to be held, and described by the sentence that says who changes them', async () => {
    stands(neverPaidAsServed())
    renderAt('/sr/moji-podaci', 'visitor', null)

    const panel = await thePanel()
    const sentence = within(panel).getByText(SENTENCE)

    expect(sentence.id).not.toBe('')

    for (const [name, control] of Object.entries(held(panel))) {
      expect(control, name).toHaveAttribute('aria-disabled', 'true')
      expect(describedBy(control), name).toContain(sentence.id)
      expect(control, name).toHaveAccessibleDescription(expect.stringContaining(SENTENCE))

      if (control.type !== 'radio') {
        expect(control, name).toHaveAttribute('readonly')
      }
    }

    for (const name of [/^Ime$/, /^Prezime/, /^Adresa za slanje/, /^Telefon/]) {
      const free = within(panel).getByRole('textbox', { name })

      expect(free, String(name)).not.toHaveAttribute('readonly')
      expect(free, String(name)).not.toHaveAttribute('aria-disabled')
      expect(describedBy(free), String(name)).not.toContain(sentence.id)
    }
  }, SLOW)

  it('does not take what is typed into them, and sends nothing of them when something else is saved', async () => {
    const user = setupUser()

    stands(neverPaidAsServed())

    const kept = stands(
      serverThat((path, init) =>
        path === '/api/me' && init?.method === 'PUT' ? answeredWith(200) : null,
      ),
    )

    renderAt('/sr/moji-podaci', 'visitor', null)

    const panel = await thePanel()
    const boxes = held(panel)

    for (const box of [boxes.birthDate, boxes.fatherName, boxes.idNumber]) {
      await user.type(box, 'ABC')
    }

    await user.click(boxes.woman)

    expect(boxes.fatherName).toHaveValue(aNeverPaidRecord.fatherName)
    expect(boxes.idNumber).toHaveValue(aNeverPaidRecord.idNumber)
    expect(boxes.birthDate).toHaveValue('23/11/1992')
    expect(boxes.man).toBeChecked()

    /* Nothing was changed, so nothing is sent: the button is told off. */
    expect(within(panel).getByRole('button', { name: 'Sačuvaj' })).toHaveAttribute('aria-disabled', 'true')

    await user.clear(within(panel).getByLabelText(/^Adresa za slanje/))
    await user.type(within(panel).getByLabelText(/^Adresa za slanje/), 'Ulica Druga 5')
    await user.click(within(panel).getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText('Sačuvano.')).toBeVisible()
    expect(theWrite(kept.asked)).toEqual({ address: 'Ulica Druga 5' })
  }, SLOW)

  /**
   * <p><b>And it does not stop him saving the rest</b>: a box he cannot fill is not asked of him
   * (`hisOwnForm`), so it carries no star and the registration's rule that it be filled refuses
   * nothing. With the rule left on, the press is refused over the held box and nothing travels.
   */
  it('shows the number of the document as an empty box for somebody who gave none, and saves the rest', async () => {
    const user = setupUser()

    stands(neverPaidAsServed({ idNumber: undefined }))

    const kept = stands(
      serverThat((path, init) =>
        path === '/api/me' && init?.method === 'PUT' ? answeredWith(200) : null,
      ),
    )

    renderAt('/sr/moji-podaci', 'visitor', null)

    const panel = await thePanel()
    const boxes = held(panel)

    expect(boxes.idNumber).toHaveValue('')
    expect(boxes.idNumber).not.toHaveAttribute('aria-required')
    expect(boxes.fatherName).toHaveValue(aNeverPaidRecord.fatherName)

    await user.type(within(panel).getByRole('textbox', { name: /^Telefon/ }), '065 1234')
    await user.click(within(panel).getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText('Sačuvano.')).toBeVisible()
    expect(theWrite(kept.asked)).toEqual({ phone: '065 1234' })
  }, SLOW)

  /** <p>And a member who gave one is asked it the way the registration asks it, with its star. */
  it('asks the number of the document the way the registration does where he gave one', async () => {
    stands(neverPaidAsServed())
    renderAt('/sr/moji-podaci', 'visitor', null)

    expect(held(await thePanel()).idNumber).toHaveAttribute('aria-required', 'true')
  }, SLOW)

  it('shows the gender of a woman', async () => {
    stands(neverPaidAsServed({ gender: 'F' }))
    renderAt('/sr/moji-podaci', 'visitor', null)

    const boxes = held(await thePanel())

    expect(boxes.woman).toBeChecked()
    expect(boxes.man).not.toBeChecked()
  }, SLOW)
})

describe('on the card „Podaci" of a member whose fee stands', () => {
  it('shows the same four held, off his own record', async () => {
    renderAt('/sr/takmicar/000001/podaci', 'competitor', '000001')

    const panel = await thePanel()
    const boxes = held(panel)

    expect(boxes.man).toBeChecked()
    expect(boxes.birthDate).toHaveValue('02/04/1980')
    expect(boxes.fatherName).toHaveValue(myOwnRecordFromMe.fatherName)
    expect(boxes.idNumber).toHaveValue(myOwnRecordFromMe.idNumber)
    expect(within(panel).getByText(SENTENCE)).toBeVisible()

    for (const [name, control] of Object.entries(boxes)) {
      expect(control, name).toHaveAttribute('aria-disabled', 'true')
    }
  }, SLOW)

  it('shows them in English too', async () => {
    renderAt('/en/takmicar/000001/podaci', 'competitor', '000001')

    /* Asked by the sentence, which is the thing this adds: the card is headed in English and its
       panel is not found by the Serbian heading the cases above use. */
    expect(
      await screen.findByText(
        "The administration changes the gender, the date of birth, the father's name and the number of the document on your request.",
      ),
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: /^Father's name/ })).toHaveAttribute('readonly')
  }, SLOW)
})

function stands<T extends { stop: () => void }>(server: T): T {
  stops.push(server.stop)

  return server
}
