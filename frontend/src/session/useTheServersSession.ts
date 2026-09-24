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
export function useTheServersSession(): void {
  const { become, moderator } = useRole()
  const { theServerSignedMeIn } = useSession()

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
    /* Both of these are stable for the life of the provider - `become` is a `useCallback`
       over nothing, `theServerSignedMeIn` is a state setter - so this runs once a visit
       rather than once a render. */
    async function ask(): Promise<void> {
      const who = await whoTheServerSaysIAm()

      if (who === null) {
        return
      }

      become(who.role, holding.current)
      /* Whole, which is what makes coming back tomorrow the same session as signing in
         today. The number is in it since 24.09.2026, and the bold sentence above is what
         keeps its other half: an answer that never came leaves everything alone, and it
         does so by returning before this line rather than by this line being careful. */
      theServerSignedMeIn(who)
    }

    void ask()
  }, [become, theServerSignedMeIn])
}
