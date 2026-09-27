import type { Crop } from '../../components/crop'

/**
 * WHAT `POST /api/me/photo` TAKES, AND IT IS THE ONLY BODY ON THIS PORTAL THAT IS NOT JSON.
 *
 * <p>Its own module rather than a constant beside the screen, which is the arrangement
 * `admin/moderatorWrites.ts`, `admin/verificationWrites.ts` and `member/myAccount.ts`
 * already have and the reason they give: `react/only-export-components` asks for it, and a
 * test reading a component file to get at a shape is a test that mounts React to ask a
 * question about an object.
 *
 * <p><b>THE FOUR PARTS ARE THE ROUTE'S AND ARE NOT DECIDED HERE.</b>
 * `MePhotoApi.send` declares them: one `@RequestPart` called `picture` and three
 * `@RequestParam` called `cropX`, `cropY` and `cropSize`, each of the three
 * `required = false` so that the class can refuse a missing one with a sentence rather
 * than let an argument resolver answer 400 with a name of a part. A fifth part would be
 * one the route never reads.
 *
 * <p><b>WHAT DELIBERATELY DOES NOT TRAVEL, said out loud because the screen holds it.</b>
 * `Chosen` carries three things - the name of the file, the picture as a data URL, and the
 * crop (`components/CropChooser.tsx`) - and only the last of those three goes on the wire,
 * beside the file itself. The NAME is not sent because the route never reads one and says
 * why: „the name is what V8 refuses to let near a path", so the file is named by the key
 * the database issues. The DATA URL is not sent because it is the same bytes a second time,
 * a third longer for being base64, and the route hashes what arrives rather than what it is
 * told.
 *
 * <p><b>ONE OF THE THREE FIELDS OF THE ANSWER IS READ, AND THE OTHER TWO ARE STILL NOT.</b>
 * `MePhotoApi.Waiting` carries the key of the queue row, the digest of the picture that is
 * now waiting, and the digest of the one still standing on the profile. The two digests are
 * addresses under `/api/photos/`, and `PhotoApi` refuses a picture no public thing holds
 * (ADL A60), so a waiting picture's digest is an address that answers nothing to anybody
 * yet; the day `PhotoApi` serves a member his own waiting portrait, this is where the reader
 * for those goes. What the member is shown until then is the picture he chose, out of his
 * own browser, which `CropChooser` is already holding.
 *
 * <p><b>THE KEY IS READ, and until 27.09.2026 it was not, which is the whole of the fault
 * this paragraph used to describe as a boundary.</b> It said the key was „a key of a row in a
 * queue this portal still draws out of its own overlay", and while that was true the screen
 * minted a row of its OWN beside the server's: one upload drew TWO cards in front of the
 * moderator, identical in everything he could see, and a decision taken on the browser's
 * copy reached no route at all. The owner met it himself and asked for „jedan jedini red na
 * strani verifikacije". So the row the member is waiting on is the row the SERVER made, named
 * by the key it answers with here, and it is the same key the moderator's decision is filed
 * under - which is what lets the member's own „čeka odobrenje" clear when that decision lands
 * (`ProfilePicture.tsx`, `session/context.ts#pictureSent`).
 */

/** The one address a picture goes to, and the one it is taken down at. */
export const THE_PICTURE_GOES_TO = '/api/me/photo'

/**
 * THE QUEUE ROW THE SERVER MADE FOR THE PICTURE THAT WAS JUST SENT, or nothing where the
 * answer did not name one.
 *
 * <p>The shape is `admin/leagueWrites.ts#identityIn`'s, down to the guards, and it is
 * copied rather than reused for the reason that file's twin in `admin/moderatorWrites.ts`
 * already writes down: the two read different keys off different routes, and one function
 * taking the name of the key as an argument would be a function whose callers decide what it
 * means. This one reads `waiting`, which is what `MePhotoApi.Waiting` calls it.
 *
 * <p><b>Without an assertion (ADL A14).</b> The answer is `unknown` because that is what
 * came off the wire, and `Reflect.get` asks the object rather than telling the compiler what
 * it holds. A whole number above nought, so that a route answering `0`, `-1`, `"7"` or
 * nothing at all is one this returns null for rather than one whose key the screen goes on to
 * file a decision under.
 */
export function theRowIn(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const waiting: unknown = Reflect.get(body, 'waiting')

  return typeof waiting === 'number' && Number.isInteger(waiting) && waiting > 0 ? waiting : null
}

/**
 * HOW MANY DECIMAL PLACES THE COLUMN HOLDS, and it is V21's number rather than a choice
 * made here.
 *
 * <p>`V21__crop_is_a_circle.sql` declares all three as `numeric(9, 8)` and says why the
 * scale is written out at all: „Declaring the scale says out loud how finely two crops may
 * be told apart." So eight is what the database keeps, and a ninth digit is not a finer
 * crop but a crop that cannot be stored.
 */
export const AS_FINE_AS_THE_COLUMN = 8

/**
 * ONE FRACTION, AS FINE AS THE COLUMN AND NO FINER.
 *
 * <p><b>This is not tidying. Without it the route refuses an ordinary crop of an ordinary
 * photograph, and the measurement is the whole reason this function exists.</b>
 * `MePhotoApi.fraction` parses each of the three with `BigDecimal` and then asks for
 * `setScale(8, RoundingMode.UNNECESSARY)`, which THROWS rather than rounds when a digit
 * would be lost, and answers `theCropIsNotACircle`. What the screen holds are IEEE doubles:
 *
 * <ul>
 * <li>measured on a square photograph of 1200 pixels, where the smallest circle works out
 * at exactly `0.2`, <b>one press of an arrow on the size slider</b> gives
 * `0.21000000000000002` - seventeen decimal places;
 * <li>on 1234 by 1600 the floor itself is `0.19448946515397084`, so the slider has no round
 * value anywhere on it;
 * <li>and dragging the circle (`crop.ts`, `draggedTo`) works the middle out through two
 * multiplications, so every value off it is arbitrary.
 * </ul>
 *
 * <p><b>Why it would not have been caught by a case about an untouched frame.</b> A member
 * who never moves anything sends `WHOLE`, which is `0.5`, `0.5` and `1` (`crop.ts`), and all
 * three of those survive `UNNECESSARY` untouched. So the state that passes without this
 * function is precisely the state a fixture reaches for first, and
 * `profilePicture.test.tsx` therefore moves a slider in the case that measures what was
 * sent.
 *
 * <p><b>`toFixed` and never a multiply-round-divide.</b> The question is how the number is
 * WRITTEN, because what crosses the wire is text and what the server parses is text;
 * `Math.round(value * 1e8) / 1e8` answers it with another double, which is the same problem
 * one step further along - `0.21000000000000002` so treated is `0.21`, whose nearest double
 * prints as `0.21` today and is not promised to.
 *
 * <p><b>The bounds are not re-checked here, and that is measured rather than trusting.</b>
 * V21 holds `crop_x` and `crop_y` `between 0 and 1` and `crop_diameter` `> 0 and <= 1`, and
 * every value this is handed has already been kept inside those by `movedTo` and `sizedTo`,
 * which clamp. A second check would be a second home for the schema's own rule, with no
 * floor under it, and the route is what refuses anything that arrives outside them anyway.
 * Eight places cannot carry a value out of range either: rounding moves a number by at most
 * five in the ninth place, and the smallest circle the portal allows is `240 / shorter edge`.
 */
export function asTheColumnHolds(fraction: number): string {
  return fraction.toFixed(AS_FINE_AS_THE_COLUMN)
}

/**
 * THE PICTURE AND ITS CIRCLE, AS THE FOUR PARTS THE ROUTE READS.
 *
 * <p>The file is handed over as the browser gave it, which is the one thing that cannot be
 * rebuilt from anything else the screen is holding: `CropChooser` reads the file into a data
 * URL to draw it, and a data URL turned back into bytes is the same picture arrived at the
 * long way round, with a type and a name invented on the way. The route decides the type by
 * looking at the bytes (`WhatAPictureIs.sniff`, ADL A12a), so what it is handed has to be
 * the bytes the member chose.
 *
 * @param file the file itself, off `Chosen`
 * @param crop the three fractions, each written as fine as the column and no finer
 */
export function pictureToSend(file: File, crop: Crop): FormData {
  const body = new FormData()

  body.append('picture', file)
  body.append('cropX', asTheColumnHolds(crop.x))
  body.append('cropY', asTheColumnHolds(crop.y))
  /* `cropSize` ON THE WIRE AND `size` IN THE PORTAL, AND THE COLUMN IS `crop_diameter`.
     Three names for one number, which A17 already writes down as the cost of V21 renaming
     the third: „frontend zapis treci broj i dalje zove `size`... razlika je samo u imenu i
     pada na onoga ko bude spajao API na ekran." This is that line, and the mapping is here
     rather than in the screen so there is one place it can be wrong. */
  body.append('cropSize', asTheColumnHolds(crop.size))

  return body
}

/**
 * THE FIVE REFUSALS `MePhotoApi` CAN NAME, each to a sentence in the dictionary.
 *
 * <p>`refusals.test.ts` reads the `static final String` reasons the class declares and
 * fails when one of them is not here, or when one here is not there. The class declares
 * SIX such constants and one of them is not a refusal at all - `THE_PROFILES_TAB =
 * "profiles"`, the name of the queue a portrait waits in - so it is named in that file's
 * own `NOT_A_REASON`, which is itself checked both ways: an exemption for a constant some
 * screen does answer is refused there.
 *
 * <p><b>TWO OF THE FIVE CANNOT BE REACHED THROUGH THE SCREEN AS IT STANDS, AND BOTH ARE
 * ANSWERED ANYWAY.</b> The form is the floor and the route decides (the shape
 * `admin/priceWrites.ts` states for its own two, out of PDL P12c), so a request that goes
 * round the screen meets the route with nothing in between:
 *
 * <ul>
 * <li>`theCropIsNotACircle` is what {@link asTheColumnHolds} exists to stop, so from this
 * screen it should now be unreachable - which is a reason to answer it rather than a reason
 * not to, because the sentence is the only thing standing between the reader and a code;
 * <li>`theFormIsNotComplete` is answered for a request that carried no `picture` part, and
 * the screen refuses to send with nothing chosen before that.
 * </ul>
 *
 * <p><b>AND THREE OF THE FIVE REALLY ARE REACHABLE, which is measured and is not obvious.</b>
 * The screen refuses exactly two files today - one whose shorter edge is under 240 pixels
 * and one the browser cannot decode (`components/CropChooser.tsx`) - and it checks NEITHER
 * the number of bytes NOR the type. `accept="image/*"` lets a GIF through, a browser decodes
 * a GIF perfectly well, so it reaches the cropper and the button; and a photograph off a
 * modern telephone can be over five megabytes without anything on the screen saying so.
 *
 * <p><b>NO NUMBER AND NO LIST OF TYPES IS REPEATED IN THE WORDS, and that is the shape
 * `pages/account/refusals.ts` already keeps.</b> It says of how long a link lasts: „that
 * number is the schema's... and a copy on a screen is a second home for a fact the server
 * owns." Five megabytes is `WhatAPictureIs.AT_MOST_BYTES` and the three types are V8's
 * constraint; written into a Serbian sentence here, each would be a fact with no floor under
 * it on this side of the repo. `crop.unreadable` names two formats and says „na primer",
 * which is the honest form, and `thisIsNotAPicture` follows it.
 */
export const WHEN_SENDING_A_PICTURE: Record<string, string> = {
  aPictureAlreadyWaits: 'picture.sendRefused.aPictureAlreadyWaits',
  theFormIsNotComplete: 'picture.sendRefused.theFormIsNotComplete',
  thePictureIsTooBig: 'picture.sendRefused.thePictureIsTooBig',
  thisIsNotAPicture: 'picture.sendRefused.thisIsNotAPicture',
  theCropIsNotACircle: 'picture.sendRefused.theCropIsNotACircle',
}
