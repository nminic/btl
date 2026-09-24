import { Link } from 'react-router'
import { useCompetitors } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { useRole } from '../roles/useRole'
import type { SignedIn } from '../session/context'
import { signOutOfTheServer } from '../session/theServer'
import { useSession } from '../session/useSession'
import { Dropdown } from './Dropdown'
import { monogramFor } from './monogram'
import { ACCOUNT_ROUTES } from './routes'

/* The picture, and behind it everything that belongs to one person: the member
 * area, settings, and signing out. The cog that used to sit beside it is gone;
 * a second door to the same room is one more thing in a header that already has
 * enough (PDL P28a).
 *
 * The shell only renders this when somebody is signed in.
 *
 * WHAT IT CAN SAY DEPENDS ON WHETHER THE LEAGUE HAS GIVEN HIM A NUMBER, and the two are
 * told apart rather than folded together (session/context.ts, `SignedIn`). A member
 * number is a name in the file of members and becomes „Strahinja Vukićević"; an account
 * is a number the server handed back from `GET /api/me` and is not a member number at
 * all. Writing one into the slot of the other would be two facts in one home, and the
 * first thing it would do is look up a member with an account's id and draw whoever
 * happened to sit there.
 *
 * <p><b>The reason given here for there being an account arm at all was „`MeApi`
 * deliberately carries none", and that was false: it has carried a member number since
 * 20.09.2026.</b> The arm is right and the reason was not. What really puts somebody in
 * it is that the league has given him no number - administration, which has no competitor
 * record at all (PDL P21), and anybody who has registered and is not a member yet (ADL
 * A44). Until 24.09.2026 every signed in MEMBER was in it too, because the portal read
 * past the number, and this menu named him „Nalog 41" while his own name sat one field
 * away in the same answer.
 */

export function AccountMenu({ signedIn }: { signedIn: SignedIn }) {
  const { locale, t } = useI18n()
  const { signOut } = useSession()
  const { become } = useRole()
  const competitors = useCompetitors()

  /* Asked only where there is a member number to ask about. An account has none, so
     there is nobody to look for and no wrong answer to find. */
  const member =
    signedIn.as === 'member' && competitors.status === 'ready'
      ? competitors.data.find((one) => one.memberNumber === signedIn.memberNumber)
      : undefined

  /* The one string this menu has to call somebody by, worked out once so the picture
     and the line under it can never disagree about who is signed in. */
  const who =
    signedIn.as === 'member'
      ? (member === undefined ? signedIn.memberNumber : `${member.firstName} ${member.lastName}`)
      : t('shell.accountNumber', { number: signedIn.account })

  return (
    <Dropdown
      id="account-menu"
      className="account"
      label={t('shell.openAccount')}
      trigger={
        <span className="account__monogram">
          {/* The same rule either way, and it is the rule this portal already had: the
              last two of whatever identifies him, until a name is there to take
              initials from. An account never gets a name here, because the server does
              not hand one out. */}
          {monogramFor(member, signedIn.as === 'member' ? signedIn.memberNumber : String(signedIn.account))}
        </span>
      }
    >
      {(close) => (
        <>
          <p className="account__who">{who}</p>
          {/* Everything but what has a shorter way in of its own (routes.ts).
              Filtered here rather than dropped there, because that same list is
              what the router is built from. */}
          {ACCOUNT_ROUTES.filter((route) => route.notInMenu !== true).map((route) => (
            <Link
              key={route.path}
              className="account__link"
              to={`/${locale}/${route.path}`}
              onClick={close}
            >
              {t(route.labelKey)}
            </Link>
          ))}
          <button
            type="button"
            className="account__link account__link--button"
            onClick={() => {
              close()
              /* THE SERVER IS TOLD FIRST AND THE PORTAL FORGETS AFTERWARDS, and the
                 order is the whole of it: told the other way round, a member who
                 pressed this would watch the header empty while the cookie in his
                 browser went on opening every route on the server. `SignOutApi`
                 answers 204 whatever it was sent and sends the cookie back already
                 over, so there is no answer worth branching on and none is read.

                 The portal forgets even where the request never arrives. A member
                 pressing „Odjavi se" on a train has asked to be signed out of the
                 screen in front of him, and leaving him signed in because the network
                 was not there would be the portal arguing with him. What the server
                 still holds then runs out on its own (30 days, ADL A43). */
              void signOutOfTheServer()
              signOut()
              /* And the role goes back to a visitor. It came from the server
                 (`GET /api/me`), so it cannot outlive the session it came with: left
                 standing, a moderator who signed out would keep the administration in
                 his navigation and find every screen behind it refused. */
              become('visitor')
            }}
          >
            {t('myProfile.signOut')}
          </button>
        </>
      )}
    </Dropdown>
  )
}
