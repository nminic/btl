import { EVENT_DELETED, eventWasDeleted } from './eventDeleted'

/**
 * WHAT THE CALENDAR TAKES OUT OF THE STATE OF ITS NAVIGATION (PDL, 25.10.2026): only the one word `eventDeleted` counts,
 * as `teamDeleted.test.ts` holds it for the list of teams.
 */
describe('the word that says an event was deleted from its own page', () => {
  it('is taken for what it is', () => {
    expect(eventWasDeleted(EVENT_DELETED)).toBe(true)
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['text', 'eventDeleted'],
    ['an object without it', {}],
    ['an object that says no', { eventDeleted: false }],
    ['an object that says something else', { eventDeleted: 'yes' }],
    ['the word of a team', { teamDeleted: true }],
  ])('is not taken for %s', (_, state) => {
    expect(eventWasDeleted(state)).toBe(false)
  })
})
