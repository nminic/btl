import { theTeamAsWritten, whereTheTeamGoes } from './teamWrites'

/**
 * WHAT THE ADMINISTRATION'S FORM SENDS, NAMED FIELD BY FIELD, AND WHERE IT GOES.
 *
 * <p>A box the form leaves out (the description and the link are not obligatory, and a form of the
 * portal omits what nobody typed) is the empty string on the wire, never the word `undefined` and never a
 * field left out: the route reads an absent description as „leave it as it stands" on a change, and the
 * form means „empty" (`TeamAdministrationWriteApiTest`).
 */
describe('what the administration sends for a team', () => {
  it('names the six fields and sends nothing a box was not asked for', () => {
    expect(
      theTeamAsWritten({
        name: 'Tim',
        city: 'Zemun',
        country: 'RS',
        organizerMemberNumber: '000005',
        bio: 'Opis',
        link: 'https://tim.example',
        id: 7,
        slug: 'tim',
      }),
    ).toEqual({
      name: 'Tim',
      city: 'Zemun',
      country: 'RS',
      organizerMemberNumber: '000005',
      bio: 'Opis',
      link: 'https://tim.example',
    })
  })

  it('writes every box that was left out as the empty string', () => {
    expect(theTeamAsWritten({})).toEqual({
      name: '',
      city: '',
      country: '',
      organizerMemberNumber: '',
      bio: '',
      link: '',
    })
  })

  it('makes a team that has no identity yet at the making and changes one that has its own', () => {
    expect(whereTheTeamGoes(null)).toEqual({ path: '/api/teams/direct', method: 'POST' })
    expect(whereTheTeamGoes(14)).toEqual({ path: '/api/teams/14', method: 'PUT' })
  })
})
