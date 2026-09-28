import { screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { aCompetitor } from '../../test/theAnswer'
import { setupUser } from '../../test/user'
import { useSession } from '../../session/useSession'
import sr from '../../i18n/sr.json'

/**
 * HIDING A PROFILE FROM VISITORS, MEASURED ON THE PANEL THAT OFFERS THE BOX.
 *
 * <p><b>What this file is for that `pages/profilePrivacy.test.tsx` cannot be.</b> That one is
 * about the CONSEQUENCE - who can reach a hidden profile, from which of thirty addresses - and
 * it presses the box to get there. This one is about the ERRAND: that the choice leaves the
 * browser at all, that what the box shows afterwards is what the SERVER said rather than what
 * was pressed, and what happens on each of the ways the route can say no. Until 28.09.2026
 * the choice reached no route at all and every case in that file passed regardless, which is
 * exactly the shape this file exists to make impossible.
 *
 * <p><b>Every case here puts its own competitor in front of the disc reader</b>, because the
 * seed has no hidden member at all - measured: thirty-two rows, `profileHidden` false on all
 * thirty-two - so „the box starts ticked" is a state no fixture on disc can produce and the
 * axis would have one end.
 */

/** The member every case is, and he is deliberately not the first row of anything: the panel
 *  is handed one record and „it drew mine" must not be satisfied by „it drew the first one". */
const ME = '000009'

const HIM = { ...aCompetitor, memberNumber: ME, firstName: 'Strahinja', lastName: 'Vukićević' }

/** SOMEBODY ELSE, on the same answer throughout, so that a panel reading the list rather than
 *  its own record is told apart. He is FIRST, which is the position a wrong reading would
 *  land on. */
const SOMEBODY_ELSE = { ...aCompetitor, memberNumber: '000002', firstName: 'Relja' }

/** What `PUT /api/me` answers: the flag as the row now holds it, beside the two fields the
 *  biography panel reads off the same answer (`MeWriteApi.Changed`). */
const asTheRowHolds = (hidden: boolean): Response =>
  new Response(JSON.stringify({ profileHidden: hidden, bio: null, waiting: null }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

/**
 * The list, and then whatever a case wants said about the write.
 *
 * @param hidden  whether the member's row starts hidden, which is the axis no fixture carries
 * @param answers what a `PUT` is answered with, and null to let it fall through to the disc
 *                reader - which answers every write 404, and is itself one of the states a
 *                case measures
 */
function theServer(
  hidden: boolean,
  answers: (init: RequestInit | undefined) => Response | Promise<Response> | null,
): { asked: Asked[]; stop: () => void } {
  clearResourceCache()

  return serverThat((path, init) => {
    if (path === '/api/competitors') {
      return new Response(
        JSON.stringify([SOMEBODY_ELSE, { ...HIM, profileHidden: hidden }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    if (path === '/api/me' && init?.method === 'PUT') {
      return answers(init)
    }

    return null
  })
}

/** What the panel asked for, read off the body it really sent. */
const sentIn = (one: Asked): unknown => JSON.parse(String(one.init?.body))

const writes = (asked: Asked[]): Asked[] =>
  asked.filter((one) => one.path === '/api/me' && one.init?.method === 'PUT')

const panelFor = async () => within(await screen.findByRole('region', { name: 'Privatnost' }))

const theBox = async () =>
  (await panelFor()).getByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni')

/** Somebody else signing in during the same visit, through the portal's own live writer -
 *  the very call `member/SignIn.tsx` makes with the answer to `GET /api/me`. */
function SignInAs({ memberNumber }: { memberNumber: string }) {
  const { theServerSignedMeIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        theServerSignedMeIn({
          account: 2,
          memberNumber,
          country: null,
          firstSeason: null,
          teamId: null,
          membershipBasis: null,
          referralCode: null,
          referredCount: null,
        })
      }}
    >
      prijavi drugog
    </button>
  )
}

describe('the choice to hide a profile from visitors', () => {
  it('goes to the route as that one field and takes nothing else with it', async () => {
    /* `profileHidden` ALONE. A field left out means „do not touch it" on this route (ADL A54,
       and `MeWriteApi` says so in as many words), so a panel that sent the whole record would
       rewrite a member's name, his address and his biography every time he ticked a box. */
    const user = setupUser()
    const { asked, stop } = theServer(false, () => asTheRowHolds(true))

    try {
      renderAt('/sr/podesavanja', 'competitor', ME)

      await user.click(await theBox())
      await (await panelFor()).findByText(sr.account.saved)

      expect(writes(asked)).toHaveLength(1)
      expect(sentIn(must(writes(asked)[0], 'the one write'))).toEqual({ profileHidden: true })
    } finally {
      stop()
      clearResourceCache()
    }
  }, SLOW)

  it('sends the other state too, for a member whose profile is already hidden', async () => {
    /* THE OTHER END OF THE AXIS, and the seed cannot produce it: nobody on disc is hidden. The
       route takes „pali" and „gasi" as one sentence (`NotificationWriteApi` writes that out
       for its own switches, and `MeWriteApi` boxes this field so a member can send `false` at
       all), so a panel that could only ever hide would make the portal's own default a state a
       member could leave and never return to. */
    const user = setupUser()
    const { asked, stop } = theServer(true, () => asTheRowHolds(false))

    try {
      renderAt('/sr/podesavanja', 'competitor', ME)

      expect(await theBox()).toBeChecked()

      await user.click(await theBox())
      await (await panelFor()).findByText(sr.account.saved)

      expect(sentIn(must(writes(asked)[0], 'the one write'))).toEqual({ profileHidden: false })
      expect(await theBox()).not.toBeChecked()
    } finally {
      stop()
      clearResourceCache()
    }
  }, SLOW)

  it('shows what the row now holds, and not what was pressed', async () => {
    /* THE NOSING AXIS OF THIS WHOLE PANEL, and it is invisible on every ordinary request
       because the route agrees with what was sent whenever the write worked. So the two are
       deliberately made to DISAGREE: the press says „hide me" and the answer says the row is
       not hidden.
     *
       Read off `event.target.checked`, the box would stay ticked and the member would spend
       the rest of the visit believing his profile was hidden while every screen of the portal
       drew a way into it. `MeWriteApi.Changed` answers this field off the row after the
       writing for exactly this reason. */
    const user = setupUser()
    const { stop } = theServer(false, () => asTheRowHolds(false))

    try {
      renderAt('/sr/podesavanja', 'competitor', ME)

      await user.click(await theBox())
      await (await panelFor()).findByText(sr.account.saved)

      expect(await theBox()).not.toBeChecked()
    } finally {
      stop()
      clearResourceCache()
    }
  }, SLOW)

  it('leaves the box where it was when the server refused, and says the reason in words', async () => {
    /* The route names eight refusals and the screen says each one in its own words rather than
       folding them into „nešto je puklo". None of the eight is reachable through this box as
       the panel draws it, and they are answered anyway, because a request that goes round the
       screen meets the route with nothing in between (the shape `admin/priceWrites.ts` states
       for its own two).
     *
       And the box does not move: a tick left standing over a refusal is the portal telling a
       member his profile is hidden when it is not, which is the one outcome on this panel that
       is worse than saying nothing. */
    const user = setupUser()
    const { stop } = theServer(false, () => refused('onlyAnAdministratorChangesThese'))

    try {
      renderAt('/sr/podesavanja', 'competitor', ME)

      await user.click(await theBox())

      const panel = await panelFor()

      expect(await panel.findByText(sr.account.notYoursToChange)).toBeVisible()
      expect(await theBox()).not.toBeChecked()
      expect(panel.queryByText(sr.account.saved)).not.toBeInTheDocument()
    } finally {
      stop()
      clearResourceCache()
    }
  }, SLOW)

  it('says so when the portal could not be reached at all, rather than pretending it saved', async () => {
    const user = setupUser()
    const { stop } = theServer(false, () => answeredWith(500))

    try {
      renderAt('/sr/podesavanja', 'competitor', ME)

      await user.click(await theBox())

      const panel = await panelFor()

      expect(await panel.findByText(/Server je odgovorio brojem 500/)).toBeVisible()
      expect(await theBox()).not.toBeChecked()
    } finally {
      stop()
      clearResourceCache()
    }
  }, SLOW)

  it('does not move the box on an answer that carries no flag at all', async () => {
    /* A 200 this screen cannot read, which is a portal one release behind its server. Nothing
       is written anywhere and the box stays where it was, so the member is never told
       something the panel could not confirm. Measured rather than argued, because the branch
       is the one place where „it worked" and „I know what the row holds" come apart. */
    const user = setupUser()
    const { stop } = theServer(false, () => (
      new Response(JSON.stringify({ bio: null, waiting: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    ))

    try {
      renderAt('/sr/podesavanja', 'competitor', ME)

      await user.click(await theBox())

      const panel = await panelFor()

      expect(await panel.findByText(/Server je odgovorio brojem 200/)).toBeVisible()
      expect(await theBox()).not.toBeChecked()
      expect(panel.queryByText(sr.account.saved)).not.toBeInTheDocument()
    } finally {
      stop()
      clearResourceCache()
    }
  }, SLOW)

  it('asks for the list again, so the next screen reads the row and not the old answer', async () => {
    /* `data/client.ts` fetches a resource once per visit, and `/api/competitors` carries
       `profileHidden` on every row - so without dropping that one name the list this visit is
       holding goes on saying what it said before the member changed his mind, and the profile
       he walks to next is drawn from it.
     *
       Counted rather than compared against a number written here: what matters is that the
       name is asked for AGAIN after the write, not how many times the shell asked for it
       before. */
    const user = setupUser()
    const { asked, stop } = theServer(false, () => asTheRowHolds(true))

    try {
      const { router } = renderAt('/sr/podesavanja', 'competitor', ME)

      await panelFor()

      const before = asked.filter((one) => one.path === '/api/competitors').length

      await user.click(await theBox())
      await (await panelFor()).findByText(sr.account.saved)

      await router.navigate('/sr/takmicari')
      await screen.findByRole('heading', { level: 1, name: 'Takmičari' })

      await waitFor(() => {
        expect(asked.filter((one) => one.path === '/api/competitors').length).toBeGreaterThan(
          before,
        )
      })
    } finally {
      stop()
      clearResourceCache()
    }
  }, SLOW)

  it('sends one request for two presses while the first is still out', async () => {
    /* A checkbox the browser toggles whatever is said about it, so the panel is `disabled`
       while the request is out - which is `admin/RightsMatrix.tsx`'s own shape for a box that
       writes with no save button beside it. Held open until both presses are in, because an
       answer that had already landed would make the two presses two errands. */
    const user = setupUser()
    let release: (answer: Response) => void = () => undefined
    const onItsWay = new Promise<Response>((resolve) => {
      release = resolve
    })
    const { asked, stop } = theServer(false, () => onItsWay)

    try {
      renderAt('/sr/podesavanja', 'competitor', ME)

      const box = await theBox()

      await user.click(box)

      await waitFor(() => {
        expect(box).toBeDisabled()
      })

      await user.click(box)

      expect(writes(asked)).toHaveLength(1)

      release(asTheRowHolds(true))

      await (await panelFor()).findByText(sr.account.saved)

      expect(writes(asked)).toHaveLength(1)
      expect(await theBox()).toBeChecked()
    } finally {
      stop()
      clearResourceCache()
    }
  }, SLOW)

  it('does not tell the next member to sign in that anything of his was saved', async () => {
    /* A VISIT IS NOT A MEMBER. `SessionProvider` sits above the router so it never comes down
       and the sign in screen is walkable while somebody is signed in, so „Sačuvano." left
       standing would tell the second man the portal had just written something for him. */
    const user = setupUser()
    const { stop } = theServer(false, () => asTheRowHolds(true))

    try {
      renderAt('/sr/podesavanja', 'competitor', ME, undefined, undefined, (
        <SignInAs memberNumber={SOMEBODY_ELSE.memberNumber} />
      ))

      await user.click(await theBox())
      await (await panelFor()).findByText(sr.account.saved)

      await user.click(screen.getByRole('button', { name: 'prijavi drugog' }))

      const panel = await panelFor()

      expect(panel.queryByText(sr.account.saved)).not.toBeInTheDocument()
      expect(await theBox()).not.toBeChecked()
    } finally {
      stop()
      clearResourceCache()
    }
  }, SLOW)
})
