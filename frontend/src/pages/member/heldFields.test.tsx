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

/** The four held boxes, by the words on their labels. */
function heldBoxes(panel: HTMLElement): Record<string, HTMLInputElement> {
  const find = (label: RegExp): HTMLInputElement => {
    const box = within(panel).getByLabelText(label)

    if (!(box instanceof HTMLInputElement)) {
      throw new Error(`${String(label)} is not a box`)
    }

    return box
  }

  return {
    gender: find(/^Pol$/),
    birthDate: find(/^Datum rođenja$/),
    fatherName: find(/^Ime oca$/),
    idNumber: find(/^Broj ličnog dokumenta$/),
  }
}

describe('on the page „Moji podaci" of somebody who has not paid', () => {
  it('shows the four held, each with its own value', async () => {
    stands(neverPaidAsServed())
    renderAt('/sr/moji-podaci', 'visitor', null)

    const boxes = heldBoxes(await thePanel())

    expect(boxes['gender']).toHaveValue('Muški')
    expect(boxes['birthDate']).toHaveValue('23. novembar 1992.')
    expect(boxes['fatherName']).toHaveValue(aNeverPaidRecord.fatherName)
    expect(boxes['idNumber']).toHaveValue(aNeverPaidRecord.idNumber)
  }, SLOW)

  it('holds them: read only, said to be held, and described by the sentence that says who changes them', async () => {
    stands(neverPaidAsServed())
    renderAt('/sr/moji-podaci', 'visitor', null)

    const panel = await thePanel()
    const sentence = within(panel).getByText(SENTENCE)

    for (const [name, box] of Object.entries(heldBoxes(panel))) {
      expect(box, name).toHaveAttribute('readonly')
      expect(box, name).toHaveAttribute('aria-disabled', 'true')
      expect(box, name).toHaveAccessibleDescription(SENTENCE)
      expect(box.getAttribute('aria-describedby'), name).toBe(sentence.id)
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
    const boxes = heldBoxes(panel)

    for (const box of Object.values(boxes)) {
      await user.type(box, 'ABC')
    }

    expect(boxes['fatherName']).toHaveValue(aNeverPaidRecord.fatherName)
    expect(boxes['idNumber']).toHaveValue(aNeverPaidRecord.idNumber)

    /* Nothing was changed, so nothing is sent: the button is told off. */
    expect(within(panel).getByRole('button', { name: 'Sačuvaj' })).toHaveAttribute('aria-disabled', 'true')

    await user.clear(within(panel).getByLabelText(/^Adresa za slanje/))
    await user.type(within(panel).getByLabelText(/^Adresa za slanje/), 'Ulica Druga 5')
    await user.click(within(panel).getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText('Sačuvano.')).toBeVisible()

    const sent = must(
      kept.asked.find((one) => one.path === '/api/me' && one.init?.method === 'PUT'),
      'the write',
    )

    expect(JSON.parse(String(sent.init?.body))).toEqual({ address: 'Ulica Druga 5' })
  }, SLOW)

  it('shows the number of the document as an empty box for somebody who gave none', async () => {
    stands(neverPaidAsServed({ idNumber: undefined }))
    renderAt('/sr/moji-podaci', 'visitor', null)

    const boxes = heldBoxes(await thePanel())

    expect(boxes['idNumber']).toHaveValue('')
    expect(boxes['fatherName']).toHaveValue(aNeverPaidRecord.fatherName)
  }, SLOW)

  it('shows the gender as a woman is called', async () => {
    stands(neverPaidAsServed({ gender: 'F' }))
    renderAt('/sr/moji-podaci', 'visitor', null)

    expect(heldBoxes(await thePanel())['gender']).toHaveValue('Ženski')
  }, SLOW)
})

describe('on the card „Podaci" of a member whose fee stands', () => {
  it('shows the same four held, off his own record', async () => {
    renderAt('/sr/takmicar/000001/podaci', 'competitor', '000001')

    const panel = await thePanel()
    const boxes = heldBoxes(panel)

    expect(boxes['gender']).toHaveValue('Muški')
    expect(boxes['birthDate']).toHaveValue('2. april 1980.')
    expect(boxes['fatherName']).toHaveValue(myOwnRecordFromMe.fatherName)
    expect(boxes['idNumber']).toHaveValue(myOwnRecordFromMe.idNumber)
    expect(within(panel).getByText(SENTENCE)).toBeVisible()

    for (const [name, box] of Object.entries(boxes)) {
      expect(box, name).toHaveAttribute('readonly')
      expect(box, name).toHaveAttribute('aria-disabled', 'true')
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
    expect(screen.getByLabelText("Father's name")).toHaveAttribute('readonly')
  }, SLOW)
})

function stands<T extends { stop: () => void }>(server: T): T {
  stops.push(server.stop)

  return server
}
