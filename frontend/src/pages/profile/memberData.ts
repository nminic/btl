import { registracija } from '../../forms/definitions'
import type { FormDef, FormValues } from '../../forms/types'

/**
 * THE ADMINISTRATION'S FORM OF A MEMBER'S DATA, AND WHAT OF IT TRAVELS.
 *
 * <p>Owner, 22.10.2026 (PDL, „Red člana, kartica Podaci i strana Podešavanja"): „Dugme Edit otvara
 * popunjenu formu sa svim podacima kao registracionu, samo bez lozinke. Tu admini i moderatori imaju
 * pravo da izmene sve podatke takmičara." So the form IS the registration's, field for field, and not a
 * copy of it: every field below is taken out of `registracija.form.json`, with its label, its length,
 * its row and its group, so the two cannot come to disagree about what a field is.
 *
 * <p><b>What of the registration is left out, and why.</b> The password and its repetition, by the
 * owner's own words („samo bez lozinke"). The statement of health and the parent's consent, because each
 * is a record that something was given at one moment and not a fact about the member: V8 keeps the
 * consent as evidence, and evidence that could be edited would no longer be evidence. And the beginners'
 * category, which has a screen and a route of its own (`MeCategoryWriteApi`) and rules about when it may
 * move. Those three are the assistant's reasoning, told to the coordinator as such on 22.10.2026 and
 * taken; they are the same list `MemberDataWriteApiTest` holds the route to.
 *
 * <p><b>The route that reads it is `PUT /api/members/{memberNumber}/data`</b> (PR 633), which takes
 * exactly these names (`MemberDataWriteApi.WHAT_THIS_ROUTE_TAKES`, less `placeId`, which this form never
 * sends: the town is a name and its country here, as on the registration).
 */
export const WHAT_THE_ADMINISTRATION_CORRECTS = [
  'firstName',
  'lastName',
  'fatherName',
  'gender',
  'birthDate',
  'idNumber',
  'email',
  'address',
  'phone',
  'city',
  'shirtSize',
] as const

export type Corrected = (typeof WHAT_THE_ADMINISTRATION_CORRECTS)[number]

/**
 * The registration's own fields, those of them this form draws, in the registration's order.
 *
 * @param withAnAddress whether the member has an account and so an address of post. One with none (a
 *                      member older than the portal, or entered by the league before he took an
 *                      account over) has no box for it: the route refuses an address for him
 *                      (`thereIsNoAccount`), and the registration's box is one that must be filled
 */
export function theMembersForm(withAnAddress: boolean): FormDef {
  return {
    ...registracija,
    id: 'podaci-clana',
    /* The button saves a correction, and its word is the one the member's own panel saves with
       („Sačuvaj"), not the registration's „Pošalji prijavu". */
    submitKey: 'account.save',
    fields: registracija.fields.filter(
      (one) =>
        WHAT_THE_ADMINISTRATION_CORRECTS.some((name) => name === one.name) &&
        (withAnAddress || one.name !== 'email'),
    ),
  }
}

/** What the server says of a member (`MemberDataApi.Data`), as the form reads and compares it. */
export type MembersData = Record<Corrected | 'country', string> & {
  memberNumber: string
  /** Null where he has no account, false while it is not confirmed. */
  emailConfirmed: boolean | null
}

/**
 * THE ANSWER OF `GET` OR `PUT /api/members/{memberNumber}/data`, or nothing where any of its fields is
 * missing or of a kind the portal does not know. A null of the server's (no telephone, no document, no
 * account) is the empty string the box that holds it holds.
 */
export function membersDataIn(body: unknown): MembersData | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const text = (name: string): string | null => {
    const said: unknown = Reflect.get(body, name)

    if (said === null) {
      return ''
    }

    return typeof said === 'string' ? said : null
  }
  const confirmed: unknown = Reflect.get(body, 'emailConfirmed')

  if (confirmed !== null && typeof confirmed !== 'boolean') {
    return null
  }

  const read: Record<Corrected | 'country' | 'memberNumber', string> = {
    memberNumber: '',
    firstName: '',
    lastName: '',
    fatherName: '',
    gender: '',
    birthDate: '',
    idNumber: '',
    email: '',
    address: '',
    phone: '',
    city: '',
    country: '',
    shirtSize: '',
  }

  for (const name of [...WHAT_THE_ADMINISTRATION_CORRECTS, 'country', 'memberNumber'] as const) {
    const value = text(name)

    if (value === null) {
      return null
    }

    read[name] = value
  }

  return { ...read, emailConfirmed: confirmed }
}

/**
 * WHAT OF THE FORM ACTUALLY CHANGED, WHICH IS THE ONLY THING THAT TRAVELS, the rule of the member's own
 * form (`member/myAccount.ts`, `whatChanged`) for the same route reading: a field left out is left alone
 * (ADL A54), so a save that sent the whole form would rewrite every column and send the member a
 * message naming data nobody touched. Read trimmed, so spaces alone are not a change; an emptied
 * telephone or document number travels as the empty string, which is how the route removes one. The two
 * words of the town travel together or not at all, because the route refuses half a town.
 *
 * @param standing what the server holds, as the form reads it
 * @param values   what the form hands over, in the shape the server reads (a day as yyyy-mm-dd)
 */
export function whatTheAdministrationChanged(
  standing: MembersData,
  values: FormValues,
): Record<string, string> {
  const changed: Record<string, string> = {}

  for (const name of [...WHAT_THE_ADMINISTRATION_CORRECTS, 'country'] as const) {
    const value = values[name]

    /* A field the form does not draw is one it says nothing about: the address of post of a member
       with no account (`theMembersForm`). */
    if (value !== undefined && String(value).trim() !== standing[name].trim()) {
      changed[name] = String(value).trim()
    }
  }

  if (Object.hasOwn(changed, 'city') || Object.hasOwn(changed, 'country')) {
    changed.city = String(values.city).trim()
    changed.country = String(values.country).trim()
  }

  return changed
}

/**
 * THE REASONS `MemberDataWriteApi` NAMES, each to its sentence. Held to the Java by
 * `pages/account/refusals.test.ts`, in both directions. Four of the seven cannot be reached by this
 * screen as it is drawn (a name the route does not take, an address on a member with no account, a
 * confirmed address, whose box is held) and are answered all the same, because a request can still lose
 * a race against what the screen last read.
 */
export const WHEN_CORRECTING_A_MEMBER: Record<string, string> = {
  notTakenHere: 'memberData.notTakenHere',
  aPairHoldsTheGender: 'memberData.aPairHoldsTheGender',
  aMinorNeedsAConsent: 'memberData.aMinorNeedsAConsent',
  theAddressIsConfirmed: 'memberData.theAddressIsConfirmed',
  thereIsNoAccount: 'memberData.thereIsNoAccount',
  theAddressIsTaken: 'memberData.theAddressIsTaken',
  theAddressIsTheSuperadmins: 'memberData.theAddressIsTheSuperadmins',
}

/**
 * AND THE ONES IT SHARES WITH THE MEMBER'S OWN ROUTE, which are `MeWriteApi`'s constants and the same
 * sentences the member's own form says (`member/myAccount.ts`), so a box too long is one sentence on the
 * portal. `theFormIsNotComplete` is the one said differently: on this route it also answers a value the
 * form does not offer, which the member's own route never meets.
 */
export const SHARED_WITH_THE_MEMBERS_OWN: Record<string, string> = {
  theFormIsNotComplete: 'memberData.formNotComplete',
  aFieldIsBlank: 'account.fieldIsBlank',
  aFieldIsTooLong: 'account.fieldIsTooLong',
  theTownIsNotSaidOnce: 'account.townNotSaidOnce',
  theTownIsNotKnown: 'account.townNotKnown',
}
