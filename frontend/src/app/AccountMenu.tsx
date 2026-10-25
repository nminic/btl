import { Link } from 'react-router'
import { useCompetitors } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { useMyData } from '../pages/member/useMyData'
import { useRole } from '../roles/useRole'
import type { SignedIn } from '../session/context'
import { signOutOfTheServer } from '../session/theServer'
import { useSession } from '../session/useSession'
import { Dropdown } from './Dropdown'
import { initialsOf, monogramFor } from './monogram'
import { Portrait } from '../components/Portrait'
import { accountMenuFor } from './routes'

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
 * it is that the league keeps no record of him - administration, which has no competitor
 * record at all (PDL P21). Anybody who has registered and is not a member yet (ADL A44) was
 * in it as well until 11.10.2026 and has an arm of his own now (`neverPaid`). **This menu drew him
 * exactly as it draws an account - „Nalog 4" and the last two digits of the id - until
 * 23.10.2026**, and the owner took both away: he is named by his name and given its initials
 * (`MenuOfSomebodyWhoHasNotPaid`). Until 24.09.2026 every signed in MEMBER was in the account arm too, because the portal read
 * past the number, and this menu named him „Nalog 41" while his own name sat one field
 * away in the same answer.
 */

export function AccountMenu({ signedIn }: { signedIn: SignedIn }) {
  /* TWO COMPONENTS AND NOT ONE, because the name of somebody who has not paid is a read of its own
     (`useMyData`) and a hook cannot be asked of one arm only. The shape `MessagesMenu` has. */
  return signedIn.as === 'neverPaid' ? (
    <MenuOfSomebodyWhoHasNotPaid account={signedIn.account} />
  ) : (
    <MenuOfAMemberOrAnAccount signedIn={signedIn} />
  )
}

/**
 * THE MENU OF SOMEBODY WHO REGISTERED AND HAS NOT PAID, and in it nothing that says „nalog".
 *
 * <p>Owner, 22.10.2026 (PDL, „Član koji još nije platio: bez reči nalog, samo Članarina"): „Kada se
 * član prijavi, a pre nego što uplati, stoji mu Nalog 4 npr. gore desno. Ne sme nigde da se pominje
 * nalog 4 niti reč nalog uopšte. niti broj naloga. Treba i dalje da stoje inicijali, a da se prikaže
 * ime kad se klikne na to." So the circle holds the INITIALS OF HIS NAME, and the line in the panel
 * is his name; neither is the number of his account, which is the id of a row in a table and not a
 * number of his (it was „Nalog 4" for the third person to register, because the first two
 * accounts were deleted). The button is named without the word either (`shell.openMyMenu`), because
 * a screen reader hears the name of the button and the owner's sentence is about every place the
 * word could be read.
 *
 * <p><b>Until his name arrives the circle is empty and the panel names nobody</b>, and so it is if
 * the read fails. The alternative to an empty circle was the last two digits of the account, which
 * is the number of the account in a smaller font. The panel still holds the two entries he has and
 * the way out, so a read that fails costs him a name and nothing he can do.
 *
 * <p>The entries are his two (`accountMenuFor`), „Moji podaci" above „Moja članarina", and the sign
 * out button (owner, 22.10.2026: „Odjava ostaje dostupna").
 */
function MenuOfSomebodyWhoHasNotPaid({ account }: { account: number }) {
  const { t } = useI18n()
  const mine = useMyData(account)
  const name = mine.status === 'ready' ? `${mine.data.firstName} ${mine.data.lastName}` : undefined

  return (
    <Dropdown
      id="account-menu"
      className="account"
      label={t('shell.openMyMenu')}
      trigger={
        <span className="account__monogram">
          {mine.status === 'ready' ? initialsOf(mine.data.firstName, mine.data.lastName) : ''}
        </span>
      }
    >
      {(close) => <Entries who={name} unpaid close={close} />}
    </Dropdown>
  )
}

function MenuOfAMemberOrAnAccount({ signedIn }: { signedIn: Exclude<SignedIn, { as: 'neverPaid' }> }) {
  const { t } = useI18n()
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
        member === undefined ? (
          /* AN ACCOUNT THAT IS NOT A MEMBER, and it keeps a mark of its own on purpose.
             This is the boundary named rather than left for a review to find.

             `Portrait` draws a MEMBER: it needs a record to take a portrait, initials and a
             colour from, and there is none here. Administration has no competitor record at
             all (PDL P21) and somebody who has registered and is not a member yet has none
             either (ADL A44), so what stands here is the rule the portal already had - the
             last two of whatever identifies him, until a name is there to take initials
             from.

             **It would have been cheaper to hand `Portrait` the `undefined` it already
             accepts, and that would have been wrong:** `undefined` there means „a place on a
             board the league has not filled", drawn as a dashed empty ring, and this is not
             an empty place. Teaching it a fourth state would be deciding what the circle
             MEANS, and that decision is the owner's and has not been made.

             The accent keeps a second job because of this: filled with the accent it says
             „an account", and filled with the blue every member's circle has (or with his
             photograph) it says „a person".

             **And this arm also covers a MEMBER whose record has not arrived yet**, which is
             why the number handed over is still chosen the way it always was. `member` is
             looked up in a resource that may still be loading, so „no record" here is two
             states: an account that will never have one, and a member who will have one in a
             moment. He is shown the last two of HIS MEMBER NUMBER and never of the account
             id; folding the two into one number would have him watch a stranger's digits and
             then his own name. */
          <span className="account__monogram">
            {monogramFor(
              signedIn.as === 'member' ? signedIn.memberNumber : String(signedIn.account),
            )}
          </span>
        ) : (
          /* A MEMBER, so the same circle every other screen draws, and since 26.09.2026 that
             means his own approved photograph the moment a moderator approves it. This is the
             place the owner named by name: „gornjem desnom zaglavlju ulogovanog korisnika"
             (PDL P28f).

             It had its own monogram until 27.09.2026, and that is why the picture would not
             have arrived here: a sweep for the shared class could not see this header,
             because it wore `account__monogram` instead. `components/oneFace.test.ts` now asks
             the import graph rather than a class name.

             **One thing about it changes look and is worth saying out loud:** the circle of a
             signed in MEMBER is now the one blue every member's circle has, or his photograph,
             rather than the accent - the same circle wherever the portal draws him. (It was a
             colour computed off his member number from 27.09.2026 until 21.10.2026, which the
             owner had abolished on 31.07.2026, PDL P28, „Sve kartice takmičara su identične".)
             The header was the one place that disagreed with the other circles. */
          <Portrait competitor={member} />
        )
      }
    >
      {(close) => <Entries who={who} unpaid={false} close={close} />}
    </Dropdown>
  )
}

/**
 * What stands in the panel behind the picture: who it is, the entries that are his, and the way out.
 *
 * <p>One list for the two kinds of reader (`accountMenuFor`) and one sign out, so the two menus
 * cannot sign out in two ways.
 */
function Entries({
  who,
  unpaid,
  close,
}: {
  who: string | undefined
  unpaid: boolean
  close: () => void
}) {
  const { locale, t } = useI18n()
  const { signOut } = useSession()
  const { become } = useRole()

  return (
    <>
      {who !== undefined && <p className="account__who">{who}</p>}
      {/* Everything but what has a shorter way in of its own (routes.ts).
          Filtered there rather than dropped here, because that same list is
          what the router is built from. */}
      {accountMenuFor(unpaid).map((route) => (
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
  )
}
