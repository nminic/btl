import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { registracija } from '../../forms/definitions'
import { choicesOf } from '../../forms/records'
import {
  WHAT_THE_ADMINISTRATION_CORRECTS,
  membersDataIn,
  theMembersForm,
  whatTheAdministrationChanged,
  type MembersData,
} from './memberData'

/** Where the server's own source lives, spelled the way `member/myAccount.test.ts` spells it. */
const WEB = join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web')

const AS_SERVED = {
  memberNumber: '000001',
  firstName: 'Vladan',
  lastName: 'Đurišić',
  fatherName: 'Petar',
  gender: 'M',
  birthDate: '1980-04-02',
  idNumber: 'AB12345',
  email: 'vladan@primer.rs',
  emailConfirmed: false,
  address: 'Bulevar 1',
  phone: '060111222',
  placeId: 792680,
  city: 'Beograd',
  country: 'RS',
  shirtSize: 'L',
}

const STANDING: MembersData = {
  memberNumber: '000001',
  firstName: 'Vladan',
  lastName: 'Đurišić',
  fatherName: 'Petar',
  gender: 'M',
  birthDate: '1980-04-02',
  idNumber: 'AB12345',
  email: 'vladan@primer.rs',
  emailConfirmed: false,
  address: 'Bulevar 1',
  phone: '060111222',
  city: 'Beograd',
  country: 'RS',
  shirtSize: 'L',
}

describe('what the form of the administration draws', () => {
  /* HELD TO THE ROUTE FROM THE OUTSIDE: every name this form corrects is one `MemberDataWriteApi` takes,
     read off the Java, and the one it takes and this form never sends is `placeId` (the town is a name
     and its country here, as on the registration). */
  it('is every name the route takes, but the codebook key of a town', () => {
    const java = readFileSync(join(WEB, 'MemberDataWriteApi.java'), 'utf-8')
    const declared = /WHAT_THIS_ROUTE_TAKES\s*=\s*List\.of\(([^)]*)\)/.exec(java)?.[1] ?? ''
    const taken = [...declared.matchAll(/"([^"]+)"/g)].map((one) => one[1])

    expect([...WHAT_THE_ADMINISTRATION_CORRECTS, 'country', 'placeId'].toSorted()).toEqual(taken.toSorted())
  })

  it('is the registration’s own fields, in its order, with the box of the address only where there is an account', () => {
    expect(theMembersForm(true).fields.map((one) => one.name)).toEqual(
      registracija.fields.map((one) => one.name).filter((name) => WHAT_THE_ADMINISTRATION_CORRECTS.some((one) => one === name)),
    )
    expect(theMembersForm(false).fields.map((one) => one.name)).not.toContain('email')
    expect(theMembersForm(true).submitKey, 'the button saves, it does not send a registration').toBe('account.save')
    expect(theMembersForm(true).fields.find((one) => one.name === 'fatherName')).toBe(
      registracija.fields.find((one) => one.name === 'fatherName'),
    )
  })
})

describe('what the server says of a member', () => {
  it('is read whole, a null of the server’s as an empty box', () => {
    expect(membersDataIn({ ...AS_SERVED, phone: null, idNumber: null })).toEqual({
      ...STANDING,
      phone: '',
      idNumber: '',
    })
    expect(membersDataIn({ ...AS_SERVED, email: null, emailConfirmed: null })).toMatchObject({
      email: '',
      emailConfirmed: null,
    })
  })

  it.each([
    ['nothing', null],
    ['a word', 'vladan'],
    ['a name of the wrong kind', { ...AS_SERVED, firstName: 7 }],
    ['a name left out', (({ fatherName: _gone, ...rest }) => rest)(AS_SERVED)],
    ['a confirmation that is a word', { ...AS_SERVED, emailConfirmed: 'yes' }],
  ])('is nothing for %s', (_what, body) => {
    expect(membersDataIn(body)).toBeNull()
  })
})

describe('what of the form travels', () => {
  /** The form's values as it opened: the record's texts, and nothing of what is not a box. */
  const { emailConfirmed: _notABox, ...asOpened } = STANDING

  it('is nothing at all while nothing has moved, spaces aside', () => {
    expect(whatTheAdministrationChanged(STANDING, { ...asOpened, firstName: ' Vladan ' })).toEqual({})
  })

  it('is the one field that moved, trimmed', () => {
    expect(whatTheAdministrationChanged(STANDING, { ...asOpened, fatherName: ' Jovan ' })).toEqual({
      fatherName: 'Jovan',
    })
  })

  it('carries an emptied telephone and an emptied document, which is how the route removes them', () => {
    expect(whatTheAdministrationChanged(STANDING, { ...asOpened, phone: '', idNumber: '' })).toEqual({
      phone: '',
      idNumber: '',
    })
  })

  it('sends the town and its country together when either moved', () => {
    expect(whatTheAdministrationChanged(STANDING, { ...asOpened, city: 'Novi Sad' })).toEqual({
      city: 'Novi Sad',
      country: 'RS',
    })
    expect(whatTheAdministrationChanged(STANDING, { ...asOpened, country: 'HR' })).toEqual({
      city: 'Beograd',
      country: 'HR',
    })
  })

  it('says nothing about a field the form does not draw', () => {
    const { email: _none, ...withoutTheAddress } = asOpened

    expect(whatTheAdministrationChanged(STANDING, withoutTheAddress)).toEqual({})
  })
})

describe('the choices of a field, read off its definition', () => {
  it('are the seven sizes of the registration', () => {
    expect(choicesOf(registracija, 'shirtSize').map((one) => one.value)).toEqual([
      'XS',
      'S',
      'M',
      'L',
      'XL',
      'XXL',
      'XXXL',
    ])
  })

  it('refuse a field with no choices of its own, which is a mistake in the code and not an empty list', () => {
    expect(() => choicesOf(registracija, 'firstName')).toThrow(/firstName/)
  })
})
