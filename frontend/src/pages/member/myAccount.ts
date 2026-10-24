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
 * THE ONE ADDRESS ALL THREE PANELS OF THIS SCREEN WRITE TO.
 *
 * <p>Written once so the three cannot part, which is the arrangement `member/myCategory.ts`
 * already has for its own resource („Where both verbs of this resource live. Written once so
 * the two cannot part") and `member/photoWrites.ts` for the picture. Until 28.09.2026 the
 * address was spelt out at the one panel that sent anything; two more send now, and three
 * hand-written copies of one string is three places for it to be wrong.
 */
export const THE_ACCOUNT_GOES_TO = '/api/me'

/**
 * WHETHER THE PROFILE IS HIDDEN, AS THE ROW NOW HOLDS IT, or nothing where the answer did
 * not say.
 *
 * <p><b>Read off the ANSWER and never off what was sent, which is the whole reason this
 * exists.</b> {@code MeWriteApi.Changed} says of this field that it is „the flag as the row
 * now holds it", and its own class note gives the reason in the other direction: leaving it
 * out „would be the opposite lie: the one half of this request that DID take effect would be
 * the half the caller is told nothing about, and the screen would have to assume what it had
 * just asked for". A screen that folded in the tick it drew would agree with the table on
 * every request that worked and would claim something on every request that did not.
 *
 * <p><b>Without an assertion (ADL A14)</b>, the shape `photoWrites.ts#theRowIn` already has:
 * what came off the wire is `unknown` and `Reflect.get` asks the object rather than telling
 * the compiler what it holds. A route that stopped answering the field, or answered it as the
 * word „true", gives nothing back here rather than a value the screen goes on to draw.
 */
export function hiddenIn(body: unknown): boolean | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const hidden: unknown = Reflect.get(body, 'profileHidden')

  return typeof hidden === 'boolean' ? hidden : null
}

/**
 * THE TEXT STANDING ON THE PROFILE AFTER THE REQUEST, or nothing where the answer did not
 * say.
 *
 * <p><b>Which is NEVER the text that was just sent, and that is the field's own definition
 * rather than a caution here.</b> {@code MeWriteApi.Changed}: „the text STANDING ON THE
 * PROFILE, which is never the one this request sent: a new one waits for a moderator and the
 * profile goes on carrying the approved words". After a DELETION it is empty, which is the
 * one road on which it does move (PDL, owner 19.09.2026).
 *
 * <p>An empty string is an answer and `null` is the absence of one, so the two are told
 * apart: the column may hold no text at all ({@code Competitor.bio} is `string | null`), and
 * a member who has never written one and a member whose words were just removed are the same
 * state to this screen - which is what {@code ProfileBio} folds them into, once, at the top.
 */
export function standingTextIn(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const bio: unknown = Reflect.get(body, 'bio')

  return typeof bio === 'string' ? bio : null
}

/**
 * THE KEY OF THE TEXT OF HIS STANDING IN THE QUEUE UNDECIDED, or nothing where none stands.
 *
 * <p>The shape is `photoWrites.ts#theRowIn`'s, down to the guards, and it is copied rather
 * than reused for the reason that file's own twin writes down: the two read different keys
 * off different routes, and one function taking the name of the key as an argument would be
 * a function whose callers decide what it means. This one reads `waiting`, which is what
 * {@code MeWriteApi.Changed} calls it.
 *
 * <p><b>It is not „what this request wrote", and the route says so</b>: „a member who sent
 * only the switch is told about the text that was already waiting, because that is what is
 * true". So a deletion, and a bare flick of the privacy switch, both answer with whatever
 * was already standing in the queue.
 *
 * <p>A whole number above nought, so that a route answering `0`, `-1`, `"7"` or nothing at
 * all is one this returns null for rather than one whose key the screen goes on to file a
 * decision under.
 */
export function waitingIn(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const waiting: unknown = Reflect.get(body, 'waiting')

  return typeof waiting === 'number' && Number.isInteger(waiting) && waiting > 0 ? waiting : null
}

/**
 * WHAT THE SERVER HOLDS IN EACH FIELD OF THE MEMBER'S OWN FORM, AS OF THE LAST TIME THE PORTAL
 * HEARD IT.
 *
 * <p><b>There is no "unknown" any more, and that is the correction of 18.10.2026.</b> This type
 * had a third state until then, `null` for "the portal cannot say what the server holds", because
 * nothing served the postal address and the telephone (measured 24.09.2026: {@code GET /api/me}
 * answered a role, an account and a record that carried neither, and {@code /api/competitors}
 * answers the PUBLIC record). The boxes opened empty and said so beside themselves. The owner
 * saved both on QA, was told so, refreshed, and found them empty again: the screen was telling
 * the truth about its own ignorance, and the ignorance was the fault. {@code MeApi.MyOwnRecord}
 * carries both now, so the portal knows what stands in every box and an empty box means what it
 * says: for the telephone, "I have none".
 */
export type Standing = Record<Sent, string>

export type Typed = Record<Sent, string>

/**
 * THE FIELDS THIS SCREEN SENDS, AND THE LENGTH OF EACH ONE'S BOX.
 *
 * <p><b>The numbers are read off the form and never written here</b>, which is the same
 * arrangement `ProfileBio.tsx` has for the biography and what `CLAUDE.md` asks of any list
 * in a guard: the box on the registration form and the box on this screen are the same
 * field of the same record, and `MeWriteApi.EACH_BOX_ON_THE_FORM` holds the SERVER to that
 * very file. Three homes for one number, and the file is the only one that decides.
 *
 * <p><b>The town and the shirt size since 23.10.2026</b>, when the panel moved from the screen of
 * the settings to the card „Podaci" of the member's own profile (PDL 22.10.2026, „Profil dobija
 * karticu „Podaci""; „Član sam menja sve osim pola i datuma rođenja", and the father's name stays the
 * administration's, „Ime oca i dalje menja samo administracija"). The town is a name and its country,
 * the same two words the registration sends for it (`Registration.tsx`), so {@code PUT /api/me} takes
 * it as a typed {@code city} with its {@code country} and never as a {@code placeId}; the two travel
 * together or not at all, because the route refuses half a town (`theTownIsNotSaidOnce`). The address
 * of post is not here: it is changed only against a confirmation, which is its own piece of work (PDL,
 * „Promena adrese pošte ulazi u obim pred lansiranje, ali se radi posle profila, lige i ostatka
 * bloka", 24.09.2026).
 */
export const WHAT_THIS_SCREEN_SENDS = [
  'firstName',
  'lastName',
  'address',
  'phone',
  'city',
  'country',
  'shirtSize',
] as const

export type Sent = (typeof WHAT_THIS_SCREEN_SENDS)[number]

/**
 * THE BOXES THE SERVER WILL NOT TAKE EMPTIED, which is not yet the list of the ones asked for.
 *
 * <p>{@code MeWriteApi.NEVER_EMPTIED}: the two names and the address are refused when blank
 * ({@code competitor_*_not_blank}, V7 and V8), while a blank telephone is a REMOVAL, since it is
 * the one optional field of the form. Held to that list from the outside by
 * `myAccountScreen.test.tsx`, which reads it off the Java and compares it with what the screen
 * asks for, so a box taken off it on either side alone is a red gate on the day it is written.
 *
 * <p><b>A box is asked for where it is on this list</b> (`PersonalData.tsx`). Until 18.10.2026 it
 * was asked for only where it was on this list AND the portal knew what the server held in it
 * (PENDING 217.5), because an address the portal could not see was a box a member could leave
 * alone. The portal sees all four now, so the second half has nothing left to say and the list is
 * the answer.
 */
export const NEVER_EMPTIED: readonly Sent[] = ['firstName', 'lastName', 'address']

/**
 * THE FIELDS SOMEBODY TYPES INTO FREELY, which are the ones with a length: the town is picked or
 * typed in its own control (`PlaceField`), its country goes with it, and the size is one of seven.
 */
export const TYPED_BOXES = ['firstName', 'lastName', 'address', 'phone'] as const

export type TypedBox = (typeof TYPED_BOXES)[number]

/** How many characters each of those boxes holds, and the town's, asked of the form rather than of me. */
export const AS_LONG_AS_THE_FORM_ALLOWS: Record<TypedBox | 'city', number> = {
  firstName: limitOf(registracija, 'firstName'),
  lastName: limitOf(registracija, 'lastName'),
  address: limitOf(registracija, 'address'),
  phone: limitOf(registracija, 'phone'),
  city: limitOf(registracija, 'city'),
}

/** The two words of the town, which travel together or not at all. */
const THE_TOWN: readonly Sent[] = ['city', 'country']

/**
 * WHAT OF IT ACTUALLY CHANGED, WHICH IS THE ONLY THING THAT TRAVELS.
 *
 * <p><b>A field left out means „do not touch it" and that is the route's own reading</b>
 * (ADL A54, and {@code MeWriteApi} writes every column through a {@code coalesce} that
 * leaves a null parameter exactly as it was). So sending the whole form every time would
 * make every save a rewrite of every column, and a member who came here to correct a
 * telephone would have his name written again by a box that happened to be on the screen.
 *
 * <p><b>A field travels when what is typed differs from what stands, and only then.</b>
 * Unchanged, it is left out, so pressing Save twice sends nothing the second time. That holds for
 * all four boxes since 18.10.2026, when the portal learned what the server holds in the address
 * and the telephone: until then those two had "nothing to differ FROM" and travelled whenever
 * something was typed, and a box left empty meant "I do not know what is there". An empty
 * box now means what it says, so a telephone emptied on purpose is a change - it travels as the
 * empty string, which the route reads as a removal (V8) - and an address emptied on purpose
 * travels too and is refused by name, which is the server's to say.
 *
 * <p><b>What is deliberately NOT judged here:</b> whether a name emptied on purpose may be
 * emptied. It may not - {@code competitor.first_name} is NOT NULL - and the server says so
 * by name, which this screen then says in words. That is the same division `NewPassword.tsx`
 * keeps and gives its reason for: the rule is the server's, and a screen holding a second
 * copy of it is a second thing to be wrong.
 *
 * <p><b>The two records are taken side by side rather than zipped into one</b>, which is
 * what keeps this file free of a type assertion: a record built with `Object.fromEntries`
 * comes back as `Record<string, …>` and would have to be claimed to be narrower, and that
 * claim is exactly what ADL A14 forbids. Written this way `Record<Sent, …>` also makes the
 * compiler demand a value for EVERY field this screen sends, so a fifth one cannot be added
 * to the list and quietly left out of the reading.
 *
 * @param standing what the server holds for each field
 * @param typed    what is in each box now
 * @return only what changed, which is empty when nothing did
 */
export function whatChanged(standing: Standing, typed: Typed): Partial<Record<Sent, string>> {
  const changed: Partial<Record<Sent, string>> = {}

  for (const name of WHAT_THIS_SCREEN_SENDS) {
    const written = typed[name].trim()

    if (written !== standing[name].trim()) {
      changed[name] = written
    }
  }

  /* HALF A TOWN IS NOT A TOWN: a new town in the same country moves only the name, and a country
     chosen for the same name moves only the country, but the route takes the two together or
     refuses them (`MeWriteApi`, `theTownIsNotSaidOnce`). So either one moving sends both. */
  if (THE_TOWN.some((name) => Object.hasOwn(changed, name))) {
    for (const name of THE_TOWN) {
      changed[name] = typed[name].trim()
    }
  }

  return changed
}

/**
 * {@code MeWriteApi}, which names seven refusals, of which this screen can meet five.
 *
 * <p><b>Held to the server by `myAccount.test.ts`</b>, which reads the Java source and takes
 * every reason constant it declares, in the shape `pages/account/refusals.test.ts` already
 * has: a reason added on the server is a red gate on the day it is written, rather than a
 * member shown a code he cannot read.
 *
 * <p><b>One of the seven belongs to the biography, which is why this table is keyed by ROUTE and
 * not by panel</b> - and since 28.09.2026 three panels really do send to it, so the table is read
 * by three screens rather than by one. That was always the shape the guard above could hold: it
 * reads the Java source, which knows one route and nothing about which of our panels reaches it.
 *
 * <p>{@code theTextIsTooLong} is what {@code PUT /api/me} answers about a `bio`, and
 * {@code ProfileBio.tsx} is what meets it. <b>{@code aTextAlreadyWaits} was the second, and left on
 * 18.10.2026</b> with the decision it carried out: a text sent over one that waits overwrites it
 * (PDL P11, the entry of 19.09.2026 struck as OBORENO). {@code onlyAnAdministratorChangesThese} is
 * what it answers about a date of birth or a gender, which no panel here draws at all.
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
  /* The biography's, which the panels of personal data do not send. The words are the biography's. */
  theTextIsTooLong: 'account.textIsTooLong',
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
