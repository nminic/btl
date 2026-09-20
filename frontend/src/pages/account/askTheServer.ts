/**
 * THE FIRST THING ON THIS PORTAL THAT ASKS THE SERVER TO DO SOMETHING, AND IT IS
 * DELIBERATELY THE SMALLEST THING THAT CAN.
 *
 * Everything else here reads generated files out of `/mock` (`data/client.ts`), and
 * ADL A50 says that stays so until every resource exists and they are switched over
 * in one go. Nothing in this file moves that day nearer or further: no resource is
 * added, `BASE` is untouched, and no screen that draws data changes. What these two
 * routes are is the other half of a message the server already posted - a link, spent
 * once - and there is no mock of a link anybody clicked.
 *
 * **It is not a client for the portal and must not become one.** Two screens of one
 * increment share it because the alternative is two homes for one fact, and the fact
 * here is the token below. The screen after these may copy this file and change it
 * rather than import it and widen it; that is the cheaper mistake of the two.
 *
 * **THE TOKEN, WHICH IS THE ONLY PART OF THIS THAT IS NOT OBVIOUS.** `ApiSecurity`
 * configures `csrf.spa()`, which keeps the token in a cookie readable by script and
 * expects it echoed in a header. The sequence is measured over a real socket rather
 * than read out of the configuration - `SignInOverRealHttpTest` reads the cookie off
 * a plain read of an open route and echoes it, and a wrong value in the same shape is
 * refused - and `SettingAPasswordOverRealHttpTest` measures the very pair of requests
 * this file sends, against the very route it sends them to.
 *
 * **What is echoed is what the cookie holds, character for character.** Nothing is
 * decoded on the way out. The whole mechanism is that two values match, so a value
 * this file "corrects" is a value the server does not recognise, and the one failure
 * that buys is a door nobody can open - which is the fault a security round found in
 * this very mechanism on 12.09.2026, from the other end.
 *
 * **NOTHING HERE WRITES WHAT IT IS GIVEN ANYWHERE BUT INTO THE BODY OF ONE REQUEST.**
 * Not to the console, not into an address, not into storage, and not into anything it
 * answers with. One of the two callers sends a password; `newPassword.test.tsx` holds
 * that rule by sweeping every place a value could land rather than by trusting this
 * paragraph.
 */

/** What the server hands out, and the header it wants it back in. Both measured. */
const TOKEN_COOKIE = 'XSRF-TOKEN'

const TOKEN_HEADER = 'X-XSRF-TOKEN'

/**
 * The read that gets the cookie when the browser has none yet, which on a link out
 * of a message is always: nothing else on the portal has spoken to `/api` at all.
 *
 * One of `ApiSecurity.READ_BY_ANYBODY`, so it needs nobody signed in, and one of the
 * small ones on purpose. Deliberately not `/api/places`, which is the codebook of
 * every town in the world and around 1.2 MB of it (`data/client.ts`): a megabyte
 * fetched to be handed a cookie is a screen that arrives late for no reason.
 */
const A_READ_THAT_HANDS_OUT_THE_TOKEN = '/api/countries'

/**
 * What came back, in the four shapes a caller has anything different to say about.
 *
 * `refused` carries the server's own word for why, never a sentence of ours built on
 * top of it: the routes tell three refusals apart on purpose, and a screen that folds
 * them into "something went wrong" hands the reader a form to press again with no
 * idea what to change.
 */
export type Answer =
  /** 204, which is what both routes answer when they did the thing. */
  | { got: 'done' }
  /** 400, and the reason the route itself named. */
  | { got: 'refused'; reason: string }
  /** 403: the token did not match, or there was none to send. */
  | { got: 'rejected' }
  /** Any other answer, carrying the number so the screen can say it rather than
   *  guess at it. A 400 whose body holds no reason lands here too, because a
   *  refusal nobody can name is not one of the three the screens know. */
  | { got: 'wrong'; status: number }
  /** The request never got an answer at all. */
  | { got: 'nothing' }

/**
 * The token the browser is holding, or nothing.
 *
 * Matched on the whole name and the equals sign after it, never on a prefix: a cookie
 * called `XSRF-TOKEN-SOMETHING` is a different cookie, and a comparison that let it
 * through would echo a value the server never issued and be refused with nothing said.
 */
function tokenInTheCookieJar(): string | null {
  const found = document.cookie
    .split(';')
    .map((one) => one.trim())
    .find((one) => one.startsWith(`${TOKEN_COOKIE}=`))

  return found === undefined ? null : found.slice(TOKEN_COOKIE.length + 1)
}

/**
 * The token, reading an open route for it first where the browser holds none.
 *
 * The read is not guarded here on purpose. If it cannot be made at all there is no
 * server to talk to, and the caller below turns that into one honest sentence instead
 * of sending a password into a connection that is not there.
 */
async function beHandedTheToken(): Promise<string | null> {
  const already = tokenInTheCookieJar()

  if (already !== null) {
    return already
  }

  await fetch(A_READ_THAT_HANDS_OUT_THE_TOKEN)

  return tokenInTheCookieJar()
}

/**
 * The word a route used for its refusal, or nothing where the body does not carry one.
 *
 * Read without an assertion (ADL A14): what comes off the wire is `unknown` and is
 * narrowed by looking at it, so a body of some other shape answers "no reason" rather
 * than being claimed to hold one.
 */
async function reasonIn(answer: Response): Promise<string | null> {
  let body: unknown

  try {
    body = await answer.json()
  } catch {
    return null
  }

  if (typeof body !== 'object' || body === null) {
    return null
  }

  const reason: unknown = Reflect.get(body, 'reason')

  return typeof reason === 'string' && reason !== '' ? reason : null
}

/**
 * Sends one thing to one route and says what came back.
 *
 * @param path what is being asked, an address under `/api`
 * @param said the body, which is the only place anything given here is written
 */
export async function askTheServer(path: string, said: object): Promise<Answer> {
  let answer: Response

  try {
    const token = await beHandedTheToken()
    /* Built rather than written out, because a header carrying `null` is a header
       carrying the four letters of the word. Without the token the request is still
       sent: the server is what judges it, and being refused by it out loud is worth
       more than this file deciding on its own that there is no point. */
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (token !== null) {
      headers[TOKEN_HEADER] = token
    }

    answer = await fetch(path, { method: 'POST', headers, body: JSON.stringify(said) })
  } catch {
    return { got: 'nothing' }
  }

  if (answer.status === 204) {
    return { got: 'done' }
  }

  if (answer.status === 403) {
    return { got: 'rejected' }
  }

  if (answer.status === 400) {
    const reason = await reasonIn(answer)

    return reason === null ? { got: 'wrong', status: 400 } : { got: 'refused', reason }
  }

  return { got: 'wrong', status: answer.status }
}
