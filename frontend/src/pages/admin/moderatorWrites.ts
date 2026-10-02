import type { FormValues } from '../../forms/types'

/**
 * WHAT `POST /api/moderators` TAKES, which is `ModeratorWriteApi.Invited` and nothing
 * besides: a first name, a last name and an address, and never a password or a role
 * (the superadmin refused both by name, PDL P28a 18.09.2026 - see the route's own
 * javadoc). There are no rights on this shape either: a moderator made here starts
 * holding none, which is the ordinary state the matrix exists to end.
 */
export type Invited = { firstName: string; lastName: string; email: string }

/** The same three fields, read off the form the way `admin/leagueWrites.ts` reads
 *  `upsertFrom` off its own: by name, off the values the form is holding rather than
 *  off the derived text, because the derived text is for the local overlay
 *  (`recordFrom`) and the route asks for the values themselves. */
export function invitedFrom(values: FormValues): Invited {
  const text = (name: string): string => String(values[name] ?? '')

  return { firstName: text('firstName'), lastName: text('lastName'), email: text('email') }
}

/**
 * WHAT `PUT /api/moderators/{id}/name` SENDS TO CORRECT A NAME, which is
 * `ModeratorWriteApi.Renamed` and nothing besides: the two parts of the name, both always.
 *
 * **There are no rights on this shape, and that is what the owner's decision of 02.10.2026
 * is made of** (PDL, „Odluke iz ciscenja nalaza": correcting a name sends only the name, and
 * the rights are sent separately, so that it does not undo another superadmin's change of
 * rights). Until then the name went to the same route as the boxes, with the boxes this screen
 * had last read beside it. The route has no statement that writes a box, so a field of the
 * other shape that still arrived would be dropped, not written; sending none is this screen's
 * half of it. The shape of the two routes is derived and is not the owner's word.
 *
 * There is no address field here either, on purpose and unlike `Invited`: the address is not
 * changed, because it is what he signs in with (PDL, 26.09.2026), and the form behind this
 * shape does not ask for one (`AdminModerators.tsx`'s own edit form, narrower than the one
 * that makes a moderator). The route refuses one by name regardless of what any form sends,
 * so leaving the field out here is not the only thing standing between a superadmin and that
 * mistake - it is simply this screen's own half of never asking.
 */
export type Renamed = { firstName: string; lastName: string }

/**
 * The name off the form, read by name exactly as `invitedFrom` reads its own three fields:
 * off the values the form is holding and not off the derived text. The rights are not here
 * and not an argument: they are the matrix, and nothing a name correction needs to say.
 */
export function renamedFrom(values: FormValues): Renamed {
  const text = (name: string): string => String(values[name] ?? '')

  return { firstName: text('firstName'), lastName: text('lastName') }
}

/**
 * THE IDENTITY THE SERVER HANDED OUT, read off a 201 the same way
 * `admin/leagueWrites.ts#identityIn` reads one: without an assertion (ADL A14), because
 * what comes off the wire is `unknown`.
 *
 * A whole number above nought, which is the range `account.id` (a `bigserial`) lives
 * in and never the range the session's own counter used to hand out
 * (`admin/raceIds.ts` counts down from nought).
 */
export function identityIn(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const id: unknown = Reflect.get(body, 'id')

  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null
}

/**
 * THE ADDRESS AS THE ROW CARRIES IT, off the same answer.
 *
 * `ModeratorWriteApi.Made` hands back the email the way `WhatAnAddressLooksLike` folded
 * it on the way in, which is not always what the superadmin typed (upper case letters,
 * mainly). Read off the answer rather than off what was typed, for the same reason
 * `Ticked.rights` is read back rather than echoed: the two agree whenever the write
 * worked, and a screen that echoed the typed value would show a spelling the database
 * does not hold the moment it differs by case.
 */
export function emailIn(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const email: unknown = Reflect.get(body, 'email')

  return typeof email === 'string' && email !== '' ? email : null
}

/** A proper type guard rather than an inline comparison, so `Array.prototype.every`
 *  narrows the array itself (ADL A14 bans the assertion an inline arrow function
 *  would otherwise need here: `rights as string[]`). */
function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * WHAT THE TABLE HOLDS AFTER A `PUT`, read off `ModeratorWriteApi.Ticked` without an
 * assertion.
 *
 * `null` where the shape is not what a successful answer carries, which this screen
 * treats the same way `admin/AdminLeagues.tsx` treats a 201 with no usable id: the
 * write happened and cannot be shown, so nothing is silently believed and the reader
 * is told to refresh instead.
 */
export function ticksIn(body: unknown): string[] | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const rights: unknown = Reflect.get(body, 'rights')

  return Array.isArray(rights) && rights.every(isString) ? rights : null
}

/**
 * THE FOUR REFUSALS `ModeratorWriteApi` CAN NAME, each to a sentence in the
 * dictionary. `refusals.test.ts` reads the four `static final String` reasons the
 * class declares and fails when one of them is not here.
 *
 * <p><b>One table for all four writing routes</b>, the way `WHEN_WRITING_A_LEAGUE`
 * covers `add`, `change` and `remove` of one entity. `theFormIsNotComplete` is
 * declared by `add` (missing name, surname or address), by `rename` (a name with a part
 * missing, which says which) and, defensively, by `change` (a request with no `rights`
 * field at all) - the sentence below speaks to the one a superadmin can actually reach,
 * which is the form; the other two uses of it are covered because the form refuses an
 * empty required field before either request leaves the browser and this is therefore the
 * same defensive floor `admin/leagueWrites.ts` keeps for its own „nearly unreachable"
 * reasons.
 */
export const WHEN_WRITING_A_MODERATOR: Record<string, string> = {
  theFormIsNotComplete: 'admin.moderatorSaveRefused.theFormIsNotComplete',
  theAddressIsNotShaped: 'admin.moderatorSaveRefused.theAddressIsNotShaped',
  theAddressIsTaken: 'admin.moderatorSaveRefused.theAddressIsTaken',
  aRightTheMatrixDoesNotHold: 'admin.moderatorSaveRefused.aRightTheMatrixDoesNotHold',
}
