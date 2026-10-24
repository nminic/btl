import { TEAM_DELETED, teamWasDeleted } from './teamDeleted'

/**
 * WHAT THE LIST OF TEAMS TAKES OUT OF THE STATE OF ITS NAVIGATION (PDL, 24.10.2026, „strana tima posle brisanja vodi na spisak
 * timova sa „Tim je obrisan.""). `location.state` is `unknown`, and a list reached any other way carries whatever that way
 * put there, or nothing, so only the one word this file names counts and nothing else is taken for it.
 */
describe('the word that says a team was deleted from its own page', () => {
  it('is taken for what it is', () => {
    expect(teamWasDeleted(TEAM_DELETED)).toBe(true)
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['text', 'teamDeleted'],
    ['an object without it', {}],
    ['an object that says no', { teamDeleted: false }],
    ['an object that says something else', { teamDeleted: 'yes' }],
  ])('is not taken for %s', (_, state) => {
    expect(teamWasDeleted(state)).toBe(false)
  })
})
