import { act, screen, waitFor, within } from '@testing-library/react'
import { arrivedResource, loadResource } from '../../data/client'
import type { EventComment } from '../../data/types'
import { at, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, serverThat } from '../../test/serverAnswers'
import type { Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import sr from '../../i18n/sr.json'

/**
 * A MEMBER'S OWN RATING ON THE PAGE OF ITS EVENT: the pencil and the x beside it and beside nothing
 * else, the form the pencil opens filled with what he gave, and the deletion (owner, PDL P6,
 * 20.10.2026, „Član uvek sme da obriše svoju ocenu ili da je izmeni": „uz svoju ocenu na strani
 * događaja član vidi „Izmeni” i „Obriši”; brisanje je odmah, uz potvrdu „Obriši svoju ocenu?”, i briše
 * i onu koja čeka; izmena otvara formu sa starim zvezdicama i tekstom").
 *
 * <p><b>The comments are served here, and not read off the generated file</b>, so that every axis is
 * set up on purpose: his rating is never the first nor the last of the list, another member's rating of
 * the same event stands beside it with other marks, he has a rating of ANOTHER event with other marks
 * again, and an older rating of his of the same event is there too (an approval of the past could leave
 * a second). A source swapped for any of these gives another answer.
 *
 * <p>What the server does with the deletion is `CommentWriteApiTest`'s, in Java. Here it is what the
 * screen sends and what it draws after each answer.
 */

/** The event, run in 2010, on which the member below has a result. */
const EVENT = 'fruskogorski-maraton-2010'
const EVENT_ID = 1
/** Another event, of another name, on which he has a rating too. */
const OTHER_ID = 2
/** An active member, with a result on the event. */
const ME = '000021'
const MY_NAME = 'Ksenija Vasiljević'
/** Another active member. */
const SOMEBODY = '000007'

function rating(
  id: number,
  eventId: number,
  memberNumber: string,
  date: string,
  marks: [number, number, number],
  body: string,
): EventComment {
  return {
    id,
    eventId,
    memberNumber,
    who: memberNumber === ME ? MY_NAME : 'Strahinja Vukićević',
    date,
    rating: { organisation: marks[0], value: marks[1], ambience: marks[2] },
    body,
  }
}

/** His rating of the event, the one the page shows him: neither the newest nor the oldest. */
const HIS = rating(31, EVENT_ID, ME, '2010-05-20', [2, 3, 4], 'Moje mišljenje.')

/** The ratings the server holds, newest first as `CommentApi` answers them. */
function served(): EventComment[] {
  return [
    rating(41, EVENT_ID, SOMEBODY, '2010-06-01', [5, 5, 5], 'Tuđe, novije.'),
    rating(51, OTHER_ID, ME, '2010-05-31', [1, 1, 1], 'Moje, o drugom događaju.'),
    HIS,
    rating(21, EVENT_ID, ME, '2010-05-10', [5, 1, 5], 'Moje, starije.'),
    rating(11, EVENT_ID, SOMEBODY, '2010-05-09', [4, 4, 4], 'Tuđe, starije.'),
  ]
}

/**
 * A server holding the comments, which answers the deletion with `status` and, from then on, serves the
 * comments without what that deletion took: every rating of his of the event, as `CommentWriteApi` does.
 */
function holding(comments: EventComment[], status = 204): { asked: Asked[]; stop: () => void } {
  let now = comments

  return serverThat((path, init) => {
    if (path === '/api/comments' && (init?.method ?? 'GET') === 'GET') {
      return new Response(JSON.stringify(now), { status: 200 })
    }

    if (init?.method === 'DELETE' && path.startsWith('/api/comments/')) {
      const named = now.find((one) => `/api/comments/${String(one.id)}` === path)

      if (named !== undefined && (status === 204 || status === 404)) {
        now = now.filter((one) => !(one.memberNumber === named.memberNumber && one.eventId === named.eventId))
      }

      return answeredWith(status)
    }

    return null
  })
}

let server: { asked: Asked[]; stop: () => void } | null = null

afterEach(() => {
  server?.stop()
  server = null
})

async function theList(): Promise<HTMLElement> {
  return screen.findByRole('list', { name: 'Komentari' })
}

/** The card a control stands in. */
function cardOf(control: HTMLElement): HTMLElement {
  return must(control.closest('li'), 'the card the control stands in')
}

describe('the pencil and the x', () => {
  it('stand beside each of his ratings of the event and beside nobody else\'s', async () => {
    server = holding(served())
    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const list = await theList()
    const cards = within(list).getAllByRole('listitem')
    const pencils = await within(list).findAllByRole('link', { name: sr.event.editOwnRating })
    const xs = within(list).getAllByRole('button', { name: sr.event.deleteOwnRating })

    /* His two ratings of this event, and not the other member's two, and not his of the other event,
       which this page does not list at all. */
    expect(cards).toHaveLength(4)
    expect(pencils).toHaveLength(2)
    expect(xs).toHaveLength(2)

    for (const control of [...pencils, ...xs]) {
      expect(within(cardOf(control)).getByText(MY_NAME)).toBeInTheDocument()
    }

    /* Neither the first card nor the last: a rule that read „the first one" or „the last one" would
       put the controls somewhere else. */
    const his = cards.indexOf(cardOf(at(pencils, 0)))

    expect(his).toBeGreaterThan(0)
    expect(his).toBeLessThan(cards.length - 1)
  }, SLOW)

  it('stand nowhere for the administration, nor for a member whose fee has lapsed', async () => {
    /* A moderator who is the member whose fee lapsed reads the comments as the administration, and
       his number is on one of them: the server would refuse him the deletion (`CommentWriteApi`,
       derived from PDL P8), so the screen does not offer it. */
    const lapsed = '000032'

    server = holding([...served(), rating(61, EVENT_ID, lapsed, '2010-05-15', [3, 3, 3], 'Isteklo.')])
    renderAt(`/sr/kalendar/${EVENT}`, 'moderator', lapsed)

    const list = await theList()

    await within(list).findByText('Isteklo.')
    expect(within(list).queryAllByRole('link', { name: sr.event.editOwnRating })).toHaveLength(0)
    expect(within(list).queryAllByRole('button', { name: sr.event.deleteOwnRating })).toHaveLength(0)
  }, SLOW)

  it('lead, from a rating of an earlier running, to the form of THAT running', async () => {
    /* The 2027 race is a copy of the 2024 one (`copiedFrom`), so its page lists the 2024 ratings too;
       his was given for 2024, where his result is, and that is what it changes. */
    server = holding([rating(71, 1060, ME, '2024-01-20', [4, 4, 4], 'Prošle godine.')])
    renderAt('/sr/kalendar/sidski-novogodisnji-maraton-2027', 'competitor', ME, undefined, '2027-02-01')

    const pencil = await within(await theList()).findByRole('link', { name: sr.event.editOwnRating })

    expect(pencil).toHaveAttribute('href', '/sr/kalendar/sidski-novogodisnji-maraton-2024/ocena')
  }, SLOW)
})

describe('the form the pencil opens', () => {
  it('opens with the marks and the words of his newest rating of THAT event', async () => {
    server = holding(served())
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    for (const [name, mark] of [['Organizacija', 2], ['Vrednost za novac', 3], ['Ambijent', 4]] as const) {
      const group = await screen.findByRole('radiogroup', { name })

      expect(at(within(group).getAllByRole('radio'), mark - 1), `${name} is not his mark`).toBeChecked()
      expect(within(group).getAllByRole('radio').filter((one) => one instanceof HTMLInputElement && one.checked)).toHaveLength(1)
    }

    expect(screen.getByLabelText(/^Komentar/)).toHaveValue('Moje mišljenje.')
    /* Filled, so it sends at once: the marks are all there. */
    expect(screen.getByRole('button', { name: 'Pošalji' })).toHaveAttribute('aria-disabled', 'false')
  }, SLOW)

  it('opens empty where he has given this event no rating', async () => {
    server = holding(served().filter((one) => !(one.memberNumber === ME && one.eventId === EVENT_ID)))
    renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    const group = await screen.findByRole('radiogroup', { name: 'Organizacija' })

    expect(within(group).getAllByRole('radio').filter((one) => one instanceof HTMLInputElement && one.checked)).toHaveLength(0)
    expect(screen.getByLabelText(/^Komentar/)).toHaveValue('')
  }, SLOW)
})

describe('the deletion', () => {
  async function deleted(status: number) {
    server = holding(served(), status)

    const user = setupUser()

    renderAt(`/sr/kalendar/${EVENT}`, 'competitor', ME)

    const list = await theList()

    await within(list).findByText(HIS.body)
    /* The mark beside the name of the event, out of its four rated cards, before anything is deleted. */
    expect(await screen.findByText(/^iz 4 ocene/)).toBeInTheDocument()

    const card = cardOf(within(list).getByText(HIS.body))

    await user.click(within(card).getByRole('button', { name: sr.event.deleteOwnRating }))
    await user.click(within(card).getByRole('button', { name: sr.event.deleteOwnRatingSure }))

    return { list, user }
  }

  it('asks in the owner\'s words, sends the id of the rating it stands beside, and the rating is gone', async () => {
    /* The moderator's queue held, as the header of a member who is also a moderator holds it: the
       deletion took his rating that waited too, so what is held is no longer true. */
    await act(async () => {
      await loadResource('verification')
    })
    expect(arrivedResource('verification')).toBeDefined()

    const { list } = await deleted(204)

    await waitFor(() => {
      expect(within(list).queryByText(HIS.body)).toBeNull()
    })

    expect(
      (server?.asked ?? []).filter((one) => one.init?.method === 'DELETE').map((one) => one.path),
    ).toEqual([`/api/comments/${String(HIS.id)}`])
    /* Both of his ratings of the event went (the server takes them), and nobody else's. */
    expect(within(list).queryByText('Moje, starije.')).toBeNull()
    expect(within(list).getByText('Tuđe, novije.')).toBeInTheDocument()
    expect(within(list).getByText('Tuđe, starije.')).toBeInTheDocument()
    /* AND THE MARK BESIDE THE NAME, which is worked out of the same comments and „deli sudbinu" (PDL
       P6): out of the two that are left, and at once, not on the next visit. */
    expect(await screen.findByText(/^iz 2 ocene/)).toBeInTheDocument()
    expect(screen.queryByText(/^iz 4 ocene/)).toBeNull()
    /* The button that had the focus went with the card, so the focus is on the heading over the list
       and not on the document (WCAG 2.2 SC 2.4.3). */
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Komentari' })).toHaveFocus()
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(arrivedResource('verification'), 'the queue held from before the deletion is still held').toBeUndefined()
  }, SLOW)

  it('says nothing to a 404 and draws what the server now has', async () => {
    const { list } = await deleted(404)

    await waitFor(() => {
      expect(within(list).queryByText(HIS.body)).toBeNull()
    })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/Server je odgovorio brojem 404/)).toBeNull()
  }, SLOW)

  it('says any other answer beside his rating, which stays', async () => {
    const { list } = await deleted(500)

    expect(await screen.findByText(/Server je odgovorio brojem 500/)).toBeInTheDocument()
    expect(within(list).getByText(HIS.body)).toBeInTheDocument()
  }, SLOW)
})
