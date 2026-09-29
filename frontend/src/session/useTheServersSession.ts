import { useEffect, useRef } from 'react'
import { useRole } from '../roles/useRole'
import { whoTheServerSaysIAm } from './theServer'
import { useSession } from './useSession'

/**
 * ASKS THE SERVER WHO IT THINKS IS ASKING, ONCE A VISIT, AND BELIEVES THE ANSWER.
 *
 * <p><b>Why this exists at all.</b> A session lives in a cookie the browser keeps and
 * script cannot read (ADL: „Tokeni: httpOnly kolačići, nikad localStorage"). So opening
 * the portal on a second tab, or coming back to it tomorrow, hands the application a
 * browser that IS signed in and an application that knows nothing about it. The only
 * thing that can say so is the server, and `GET /api/me` is the question.
 *
 * <p><b>Called from `Shell`</b>, which is the one thing every address on the portal is
 * drawn inside (`LocaleLayout`), so there is one home for the question rather than one
 * in `App` and a copy in the test helper that mirrors it. A guard written only into
 * `App.tsx` would be a guard no case ever runs: that file is the bootstrap and is out
 * of the coverage report on purpose.
 *
 * <p><b>The role and the account are set together and never apart</b>, which is the
 * same rule `RoleProvider` already keeps for a role and its moderator, and for the same
 * reason: an account without its role is a session drawing a visitor's navigation, and
 * a role without its account is a header that says nobody is signed in while every
 * screen behind it behaves as though somebody is.
 *
 * <p><b>Nobody signed in writes nothing at all.</b> 401, 404, a proxy answering
 * something else, no server to reach - all of them are `null` from
 * {@link whoTheServerSaysIAm}, and none of them may reach in and clear what the
 * development switch put there. That is not politeness: the switch is what the whole
 * prototype is walked through with (`RoleSwitch`), and a question asked of a server
 * that is not running would otherwise sign the developer out on every screen.
 */
/**
 * HOW LONG THE PORTAL WILL STAND ON A LOADING INDICATOR BEFORE DECIDING WITHOUT AN
 * ANSWER, in milliseconds.
 *
 * <p><b>This is derived reasoning and not the owner's words, and it is marked so on
 * purpose.</b> What he decided is that the door does not redirect until the server has
 * answered, and that the price is a short moment with an indicator. He did not name a
 * number, because until this branch there was no case in which no answer ever comes.
 *
 * <p><b>Why a bound has to exist at all.</b> Every other way of failing settles by
 * itself - a refusal, a dead host, a proxy answering nonsense - and all of them arrive
 * fast. The one that does not is a socket that is accepted and never written to: the
 * promise simply never settles, and a door that waits on it waits for ever. That is the
 * one state in which the fix would be worse than the fault.
 *
 * <p><b>Why ten seconds and not one or sixty.</b> The fault being repaired is „the
 * administrator is thrown out", and a bound that is too short RECREATES it: a slow but
 * living answer - a cold start, a phone on a bad connection - would lose the door and
 * land him on the front page again, just less often. Ten is long enough that no healthy
 * answer loses to it, and a reader who has watched an indicator for ten seconds already
 * knows the portal is not working.
 *
 * <p><b>Which way it fails.</b> Deciding without an answer means deciding on the role
 * there is, and at the first paint of a visit that is the visitor (`app/App.tsx` passes
 * `RoleProvider` nothing). So the bound can only ever send somebody to the front page,
 * which is exactly where they end up today. It never opens a door.
 *
 * <p><b>And the answer is not abandoned when it fires.</b> The request is not aborted
 * and the role it names is still adopted if it lands afterwards. What the bound ends is
 * the WAITING, not the question.
 */
export const HOW_LONG_THE_DOOR_WAITS = 10_000

export function useTheServersSession(): void {
  const { become, moderator } = useRole()
  const { theServerSignedMeIn, theServerAnswered } = useSession()

  /* **WHAT THE ANSWER DOES NOT MENTION IS LEFT ALONE, AND THAT IS THE RULE ABOVE
     APPLIED ONE LEVEL DOWN.** `become` takes a role AND a moderator and sets them
     together, so calling it with the role alone clears whoever was holding the rights.
     `GET /api/me` says nothing about a moderator - a real session's rights are their own
     increment and have not arrived - so adopting its role used to take the rights with
     it: measured 21.09.2026, a moderator walking the portal lost administration the
     moment the answer came back, on the same three words the header is drawn from.

     Read through a ref rather than named in the dependencies below, so that this stays
     the one question asked once a visit: put in the list, a moderator being set would
     ask it again. */
  const holding = useRef(moderator)

  holding.current = moderator

  useEffect(() => {
    /* All three of these are stable for the life of the provider - `become` and
       `theServerAnswered` are a `useCallback` over nothing, `theServerSignedMeIn` is a
       state setter - so this runs once a visit rather than once a render. */

    /* THE ONE OUTCOME A PROMISE CANNOT SETTLE, bounded rather than waited on. See
       {@link HOW_LONG_THE_DOOR_WAITS} for the number and for which way it fails. */
    const bound = setTimeout(theServerAnswered, HOW_LONG_THE_DOOR_WAITS)

    async function ask(): Promise<void> {
      const who = await whoTheServerSaysIAm()

      /* **THE WAITING ENDS HERE AND NOT INSIDE EITHER ARM BELOW, WHICH IS THE WHOLE
         CORRECTION OF 29.09.2026.** `whoTheServerSaysIAm` answers `null` to six
         different things - a 401, a host that is not there, a body that is not JSON, a
         body that is not an object, a role this portal does not know, an account that is
         not a number - and the portal has never been able to tell any of them from „the
         answer has not come back yet". It does not have to: for the question „has it come
         back", all six are YES, and the door may stop waiting on every one of them.

         Put after the early return below, this line would be reached only by somebody
         the server signed in, and the portal would stand on a loading indicator for ever
         for the one reader it should send away fastest - the one who really is nobody. */
      clearTimeout(bound)
      theServerAnswered()

      if (who === null) {
        return
      }

      become(who.role, holding.current)
      /* Whole, which is what makes coming back tomorrow the same session as signing in
         today. The number is in it since 24.09.2026, and the bold sentence above is what
         keeps its other half: an answer that never came leaves everything alone, and it
         does so by returning before this line rather than by this line being careful.
         That half is untouched by the correction above: what `null` does to the ROLE is
         still nothing at all, and the development switch still survives a server that is
         not running. All that is new is that it stops the CLOCK. */
      theServerSignedMeIn(who)
    }

    void ask()

    return () => {
      clearTimeout(bound)
    }
  }, [become, theServerSignedMeIn, theServerAnswered])
}
