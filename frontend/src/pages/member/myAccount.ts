import { registracija } from '../../forms/definitions'
import { limitOf } from '../../forms/records'

/**
 * WHAT THE MEMBER'S OWN ACCOUNT SCREEN SENDS, AND WHAT EACH REFUSAL OF IT IS CALLED.
 *
 * <p>Its own module rather than a constant beside the screen, which is the arrangement
 * `pages/account/refusals.ts` already has and the reason it gives: `react/only-export-components`
 * asks for it, and a test reading a component file to get at a table is a test that mounts
 * React to ask a question about a list.
 *
 * <p><b>Why this is not written into that file.</b> Two other increments are editing
 * `pages/account/refusals.ts` in the same week, and this table belongs to neither of the
 * two routes that file was written for - those take a link out of a message and are spent
 * once, these are a signed in member changing his own record. Keeping them apart costs one
 * import and saves a merge.
 */

/**
 * A FIELD OF THE MEMBER'S OWN FORM, AND WHETHER THE PORTAL KNOWS WHAT IS IN IT TODAY.
 *
 * <p>{@code standing} is `null` where the portal <b>cannot say</b> what the server holds,
 * which is not the same as an empty box and is the whole reason this type has three states
 * rather than two. Measured on 24.09.2026 and written here rather than implied:
 * {@code GET /api/me} answers a role, an account and seven facts about membership
 * (`MeApi.MyOwnRecord`), and {@code /api/competitors} answers the PUBLIC record, which
 * carries a name and a town and by ADL A8 may carry nothing else. Neither carries the
 * member's postal address or his telephone, so a box for one of those opens knowing
 * nothing, and the screen says so instead of drawing an empty box that reads as „you have
 * none".
 */
export type Box = {
  /** What the server holds today, or `null` where nothing serves it. */
  standing: string | null
  /** What is in the box now. */
  typed: string
}

/**
 * THE FIELDS THIS SCREEN SENDS, AND THE LENGTH OF EACH ONE'S BOX.
 *
 * <p><b>The numbers are read off the form and never written here</b>, which is the same
 * arrangement `ProfileBio.tsx` has for the biography and what `CLAUDE.md` asks of any list
 * in a guard: the box on the registration form and the box on this screen are the same
 * field of the same record, and `MeWriteApi.EACH_BOX_ON_THE_FORM` holds the SERVER to that
 * very file. Three homes for one number, and the file is the only one that decides.
 *
 * <p>`city` is not among them and that is named rather than forgotten: a town is chosen out
 * of the codebook (`type: 'place'`), and {@code PUT /api/me} takes it as either a
 * {@code placeId} or a typed {@code city} with its {@code country} - never both and never
 * neither, which is its own refusal. That is a picker and two roads rather than a box, and
 * it is written down as what this screen does not yet do.
 */
export const WHAT_THIS_SCREEN_SENDS = ['firstName', 'lastName', 'address', 'phone'] as const

export type Sent = (typeof WHAT_THIS_SCREEN_SENDS)[number]

/** How many characters each of those boxes holds, asked of the form rather than of me. */
export const AS_LONG_AS_THE_FORM_ALLOWS: Record<Sent, number> = {
  firstName: limitOf(registracija, 'firstName'),
  lastName: limitOf(registracija, 'lastName'),
  address: limitOf(registracija, 'address'),
  phone: limitOf(registracija, 'phone'),
}

/**
 * WHAT OF IT ACTUALLY CHANGED, WHICH IS THE ONLY THING THAT TRAVELS.
 *
 * <p><b>A field left out means „do not touch it" and that is the route's own reading</b>
 * (ADL A54, and {@code MeWriteApi} writes every column through a {@code coalesce} that
 * leaves a null parameter exactly as it was). So sending the whole form every time would
 * make every save a rewrite of every column, and a member who came here to correct a
 * telephone would have his name written again by a box that happened to be on the screen.
 *
 * <p><b>The two knowledge states are answered differently on purpose, and this is the
 * measured part.</b>
 *
 * <ul>
 * <li><b>A field the portal can see today</b> (a name) travels when what is typed differs
 * from what stands. Unchanged, it is left out, so pressing Save twice sends nothing the
 * second time.</li>
 * <li><b>A field the portal cannot see</b> (an address, a telephone) has nothing to differ
 * FROM. It travels when something was typed, and never when the box is empty - because an
 * empty box here means „I do not know what is there and I am not changing it", and sending
 * an empty string would ask the server to CLEAR a column the form requires, which is its
 * own refusal ({@code aFieldIsBlank}).</li>
 * </ul>
 *
 * <p><b>What is deliberately NOT judged here:</b> whether a name emptied on purpose may be
 * emptied. It may not - {@code competitor.first_name} is NOT NULL - and the server says so
 * by name, which this screen then says in words. That is the same division `NewPassword.tsx`
 * keeps and gives its reason for: the rule is the server's, and a screen holding a second
 * copy of it is a second thing to be wrong.
 *
 * @param boxes every field this screen carries, with what stands and what is typed
 * @return only what changed, which is empty when nothing did
 */
export function whatChanged(boxes: Record<Sent, Box>): Partial<Record<Sent, string>> {
  const changed: Partial<Record<Sent, string>> = {}

  for (const name of WHAT_THIS_SCREEN_SENDS) {
    const { standing, typed } = boxes[name]
    const written = typed.trim()

    /* The portal knows nothing about this one, so „changed" can only mean „something was
       typed". */
    if (standing === null) {
      if (written !== '') {
        changed[name] = written
      }

      continue
    }

    if (written !== standing.trim()) {
      changed[name] = written
    }
  }

  return changed
}

/**
 * {@code MeWriteApi}, which names eight refusals, of which this screen can meet six.
 *
 * <p><b>Held to the server by `myAccount.test.ts`</b>, which reads the Java source and takes
 * every reason constant it declares, in the shape `pages/account/refusals.test.ts` already
 * has: a reason added on the server is a red gate on the day it is written, rather than a
 * member shown a code he cannot read.
 *
 * <p><b>Two of the eight belong to the biography and not to this panel</b>, and they are
 * here all the same because a table keyed by route rather than by panel is the one the guard
 * above can hold. {@code theTextIsTooLong} and {@code aTextAlreadyWaits} are what
 * {@code PUT /api/me} answers about a `bio`, which this screen does not send yet; their
 * sentences are the ones the biography panel already says in its own words.
 */
export const WHEN_CHANGING_MY_DATA: Record<string, string> = {
  /* Nothing this route could act on arrived. On this screen it is unreachable by
     construction - the button is told off while nothing has changed - and it is answered
     because the request can still lose a race against the portal's own idea of what stands. */
  theFormIsNotComplete: 'account.nothingToSave',
  /* A box the form requires, emptied. `maxLength` on the control stops the other direction,
     so this is the one of the two lengths a member can actually reach from here. */
  aFieldIsBlank: 'account.fieldIsBlank',
  aFieldIsTooLong: 'account.fieldIsTooLong',
  /* The date of birth or the gender arrived. Unreachable from this screen, which draws
     neither as a control, and answered because the refusal exists and a screen that folded
     it into „something went wrong" would hide the one sentence PDL P28b, 2 asks be said. */
  onlyAnAdministratorChangesThese: 'account.notYoursToChange',
  /* Both roads to a town at once, or neither. Unreachable until this screen carries the
     picker, and named so that the day it does, the sentence is already here. */
  theTownIsNotSaidOnce: 'account.townNotSaidOnce',
  theTownIsNotKnown: 'account.townNotKnown',
  /* The biography's two, which this panel does not send. The words are the biography's. */
  theTextIsTooLong: 'account.textIsTooLong',
  aTextAlreadyWaits: 'account.textAlreadyWaits',
}

/**
 * {@code MePasswordApi}, which names three.
 *
 * <p><b>{@code theFormIsNotComplete} is one name for two causes and the sentence says
 * both</b>, because the route says both under one name: a field left empty or the two new
 * ones disagreeing, and a new password shorter than the policy allows. Guessing which it
 * was would point the reader at the wrong box half the time, so the sentence names the
 * three things he can check - which is the shape `WHEN_SETTING_A_PASSWORD` already uses for
 * the identical refusal on the other password route.
 */
export const WHEN_CHANGING_MY_PASSWORD: Record<string, string> = {
  theFormIsNotComplete: 'account.passwordFormIsNotComplete',
  theOldPasswordIsWrong: 'account.oldPasswordIsWrong',
  thePasswordHasLeaked: 'account.passwordHasLeaked',
}
