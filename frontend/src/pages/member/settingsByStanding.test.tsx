import { act, configure, getConfig, screen, within } from '@testing-library/react'
import { useSession } from '../../session/useSession'
import { setupUser } from '../../test/user'
import { afterEach, describe, expect, it } from 'vitest'
import { hisPageAsServed } from '../../test/hisPage'
import { aNeverPaidRecord, neverPaidAsServed } from '../../test/neverPaid'
import { renderAt } from '../../test/render'
import { answeredWith, isResource, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'

/**
 * THE SETTINGS SCREEN HAS THREE SHAPES, AND WHICH ONE A READER IS DRAWN IS DECIDED BY WHO HE IS.
 *
 * <p>PDL P8, the entry „Šta sme neplaćen član" (10.10.2026) and its addition of 11.10.2026, both
 * chosen by the owner between offered outcomes - the sentences are the record's and not his own
 * words:
 *
 * <ul>
 * <li><b>Somebody who registered and has not paid</b> may change „lozinku, adresu pošte i svoje
 * podatke za evidenciju i majicu", and may not do „ništa što ga čini vidljivim ili ga uključuje u
 * ligu: sliku, biografiju, skrivanje profila".</li>
 * <li><b>A member whose fee has lapsed</b> „dopire samo do obnove i svog profila": the data and the
 * password are answered 404 (`PUT /api/me`, `PUT /api/me/password`), and the picture, the
 * biography and the switch with them.</li>
 * <li><b>An administration account with no member</b> is drawn „sve troje" since the evening of
 * 17.10.2026 (PDL, the answers of that evening, chosen by the owner between offered outcomes; the
 * sentence is the record's and not his own words: „Nalog administracije bez člana na strani
 * Podešavanja vidi sve troje: jezik pošte, izbor teme i promenu lozinke"): the language of its mail,
 * the theme and the password, and none of the six panels that are a competitor's.</li>
 * <li><b>A member whose fee stands</b> may change all of it, and is the anchor the other two are
 * measured against: a screen that took everything from everybody would pass every absence below
 * and fail every presence.</li>
 * </ul>
 *
 * <p><b>Each panel is asked by its heading</b> (`getByRole`, not a class), and the absences are
 * asked only after the screen has finished drawing what it is going to draw - the heading of the
 * screen and then a tick for the public list to arrive - so that „the picture is not there" is
 * never satisfied by „the picture has not arrived yet". That is the one way an absence on this
 * screen can be vacuous: the three panels a member is drawn arrive behind a read.
 */

/* Every wait of this file is given half of the time a case has, so a wait that never succeeds ends
   the case with the assertion's own words and not with the case's clock. */
configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function stand<T extends { stop: () => void }>(server: T): T {
  stops.push(server.stop)

  return server
}

/** The headings of the panels, by what they are called on the screen. */
const PANELS = {
  data: 'Lični podaci',
  locked: 'Podaci koji se ne menjaju ovde',
  picture: 'Profilna slika',
  biography: 'Tekst o sebi',
  password: 'Lozinka',
  appearance: 'Izgled',
  mail: 'Pošta',
  privacy: 'Privatnost',
} as const

const WHAT_OPENS_LATER =
  'Slika, biografija i skrivanje profila otvaraju se kad tvoja članarina bude evidentirana.'

/**
 * The sentence a member whose fee has lapsed is told (PDL P8, 16.10.2026, „Članu kome je istekla
 * članarina strana Podešavanja dobija jednu rečenicu da se podaci i lozinka otvaraju kad članarina
 * bude obnovljena, uz vezu na stranu za obnovu"; the record's sentence and not the owner's own
 * words), asked of its words in front of the link. The link is asked apart, by its role.
 */
const WHAT_OPENS_ON_RENEWAL =
  /^Podaci i lozinka otvaraju se kad tvoja članarina bude obnovljena\. Obnovi je ovde: \.$/

/**
 * The sentence is there once, with its link to the page the fee is renewed on, and it is in the
 * screen's own part and not the menu's (the menu names the same page, so a link asked of the whole
 * document would be answered by the menu).
 */
function expectTheSentenceAboutRenewal(): void {
  const main = within(screen.getByRole('main'))

  expect(main.getAllByText(WHAT_OPENS_ON_RENEWAL)).toHaveLength(1)
  expect(main.getByRole('link', { name: 'Moja članarina' })).toHaveAttribute(
    'href',
    '/sr/moja-clanarina',
  )
}

/** The sentence is not on the screen, and neither is a link to the page the fee is renewed on. */
function expectNoSentenceAboutRenewal(): void {
  const main = within(screen.getByRole('main'))

  expect(main.queryByText(WHAT_OPENS_ON_RENEWAL)).not.toBeInTheDocument()
  expect(main.queryByRole('link', { name: 'Moja članarina' })).not.toBeInTheDocument()
}

/**
 * The screen once it has drawn what it is going to draw: its own heading, and then everything the
 * public list was asked for and the settings was waiting on.
 *
 * <p>The list is asked for by the header's menu too, and a second `serverThat` in front of the
 * disc reader is how the case sees WHEN it was asked; a few ticks after that it has been drawn from,
 * if it is going to be. Said once here so that no absence below is asked in the first render.
 */
async function drawn(): Promise<void> {
  expect(await screen.findByRole('heading', { level: 1, name: 'Podešavanja' })).toBeVisible()
  expect(await screen.findByRole('heading', { level: 2, name: PANELS.appearance })).toBeVisible()

  await act(async () => {
    for (let tick = 0; tick < 5; tick += 1) {
      await new Promise((settled) => {
        setTimeout(settled, 0)
      })
    }
  })
}

describe('the settings of somebody who registered and has not paid', () => {
  it('draws his data and his password and the theme, and nothing that makes a member visible', async () => {
    stand(neverPaidAsServed())
    renderAt('/sr/podesavanja', 'visitor', null)

    await drawn()

    /* What the entry lets him do. His data arrives behind a read of its own, so it is waited for. */
    expect(await screen.findByRole('heading', { level: 2, name: PANELS.data })).toBeVisible()
    expect(screen.getByDisplayValue('Tek')).toBeVisible()
    expect(screen.getByDisplayValue('Stigao')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: PANELS.locked })).toBeVisible()
    expect(screen.getByText('Beograd')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: PANELS.password })).toBeVisible()

    /* What it does not: „sliku, biografiju, skrivanje profila". */
    expect(screen.queryByRole('heading', { name: PANELS.picture })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: PANELS.biography })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: PANELS.privacy })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  }, SLOW)

  it('is told, once, that the three he does not see open with his fee', async () => {
    stand(neverPaidAsServed())
    renderAt('/sr/podesavanja', 'visitor', null)

    await drawn()

    expect(await screen.findByText(WHAT_OPENS_LATER)).toBeVisible()
    expect(screen.getAllByText(WHAT_OPENS_LATER)).toHaveLength(1)
    /* And not the other one: his fee was never recorded, so there is nothing to be renewed. */
    expectNoSentenceAboutRenewal()
  }, SLOW)

  it('draws his data from the answer that has a row for him, and not from the public list', async () => {
    /* The list the server serves is every member whose fee stands, and he is on no row of it, so a
       screen that looked him up THERE would draw nothing of his. His data is asked for under his own
       cookie (`GET /api/me`) a second time, after the shell's own question, and the language of his
       mail (`MailLanguageChoice`) is a third: it is read off the same answer by a panel of its own,
       which is drawn to every kind of reader and so cannot borrow a read that is made only for him. */
    const { asked } = stand(neverPaidAsServed())

    renderAt('/sr/podesavanja', 'visitor', null)

    await drawn()
    await screen.findByRole('heading', { level: 2, name: PANELS.data })

    expect(asked.filter((one) => one.path === '/api/me')).toHaveLength(3)
  }, SLOW)

  it('says his data could not be read, and offers to ask again, when the server will not give it', async () => {
    /* The shell's question is answered, and the one that follows is not: the second read of the
       same address is the screen's own. Said in the portal's own words (`components/Resource`) and
       not in a sentence of this screen's. The THIRD read is the language panel's and is answered,
       because this case is about his data: the panels read in the order they stand on the screen
       (the shell, his data, the language of his mail), which is what makes „the second" his. */
    let answered = 0

    stand(
      serverThat((path) => {
        if (path !== '/api/me') {
          return null
        }

        answered += 1

        return answered === 2
          ? new Response(null, { status: 500 })
          : new Response(
              JSON.stringify({
                role: 'competitor',
                account: 1,
                member: aNeverPaidRecord,
                mailLanguage: 'sr',
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
      }),
    )
    renderAt('/sr/podesavanja', 'visitor', null)

    await drawn()

    expect(await screen.findByText('Podaci se ne mogu učitati.')).toBeVisible()
    expect(screen.getByRole('button', { name: /Pokušaj ponovo/ })).toBeVisible()
    /* And the rest of the screen is there, because a failed read of his data is not a reason to
       take his password or the theme away from him. */
    expect(screen.getByRole('heading', { level: 2, name: PANELS.password })).toBeVisible()
  }, SLOW)
})

/**
 * SOMEBODY ELSE SIGNING IN WHILE THE SETTINGS ARE OPEN, through the portal's own live writer.
 *
 * <p>`theServerSignedMeIn` is the very call `member/SignIn.tsx` makes with the answer to `GET
 * /api/me`, `SessionProvider` sits above the router so it never comes down, and the sign in screen
 * can be walked to while somebody is signed in: a shared laptop at a race is the ordinary case. It
 * moves what the server answers in the same click, so a case built on it measures whether the SCREEN
 * reacts and not whether the stand-in server can.
 */
function SignInAsSomebodyWhoHasNotPaid({ account }: { account: number }) {
  const { theServerSignedMeIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        theServerSignedMeIn({
          account,
          memberNumber: null,
          country: 'RS',
          firstSeason: 2027,
          teamId: null,
          membershipBasis: 'payment',
          referralCode: '3d6b1f0a9c2e4478',
          referredCount: 0,
          hasARecord: true,
          feeStands: false,
        })
      }}
    >
      prijavi drugog
    </button>
  )
}

describe('the settings of somebody who has not paid, when somebody else signs in beside them', () => {
  /* **THE FAULT THIS EXISTS FOR IS THE SECOND MAN READING THE FIRST ONE'S NAME OUT OF THE BOX.**
     His data is held by the account it was asked under (`useMyData`), and the screen is what hands
     the hook that account. A screen that handed it a constant would hold the first answer for ever:
     the effect asks again only when the account it is keyed by changes, so the second reader would
     be drawn the first reader's name and could press „Sačuvaj" on it. The cheaper mutation - the
     hook ignoring the account - is held by `useMyData.test.tsx`; this is the wire between the two. */
  it('draws the second reader his own data, and not the first reader\'s', async () => {
    const user = setupUser()
    let whose: Record<string, unknown> = {}

    stand(
      serverThat((path) =>
        path === '/api/me'
          ? new Response(
              JSON.stringify({
                role: 'competitor',
                account: 1,
                member: { ...aNeverPaidRecord, ...whose },
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          : null,
      ),
    )
    renderAt(
      '/sr/podesavanja',
      'visitor',
      null,
      undefined,
      undefined,
      <SignInAsSomebodyWhoHasNotPaid account={2} />,
    )

    expect(await screen.findByDisplayValue('Tek')).toBeVisible()

    whose = { firstName: 'Ana', lastName: 'Anić' }
    await user.click(screen.getByRole('button', { name: 'prijavi drugog' }))

    expect(await screen.findByDisplayValue('Ana')).toBeVisible()
    expect(screen.queryByDisplayValue('Tek')).not.toBeInTheDocument()
  }, SLOW)
})

describe('the settings of a member whose fee has lapsed', () => {
  /* 000032 is the member of the generated data whose fee has lapsed: the harness answers
     `GET /api/me` off the file, and his row there is `active: false`. */
  it('draws the theme and nothing else, because the server answers 404 to everything else', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000032')

    await drawn()

    for (const panel of [
      PANELS.data,
      PANELS.locked,
      PANELS.picture,
      PANELS.biography,
      PANELS.password,
      PANELS.privacy,
    ]) {
      expect(screen.queryByRole('heading', { name: panel }), panel).not.toBeInTheDocument()
    }

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    /* And not the sentence that is for somebody who has not paid: he HAS a number, and „kad tvoja
       članarina bude evidentirana" is said to a person whose fee was never recorded. */
    expect(screen.queryByText(WHAT_OPENS_LATER)).not.toBeInTheDocument()
    /* What he is told instead: his data and his password open once the fee is renewed, and where. */
    expectTheSentenceAboutRenewal()
  }, SLOW)

  it('is told the same sentence in English, and the link names the page as the English menu does', async () => {
    renderAt('/en/podesavanja', 'competitor', '000032')

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()

    const main = within(screen.getByRole('main'))

    expect(
      await main.findByText(
        /^Your data and your password open once your fee has been renewed\. Renew it here:/,
      ),
    ).toBeVisible()
    expect(main.getByRole('link', { name: 'My fee' })).toHaveAttribute('href', '/en/moja-clanarina')
  }, SLOW)
})

describe('the settings of a member the list still carries and the answer about him says has lapsed', () => {
  /* **THE FLAG IS THE SESSION'S AND THE LIST IS A CACHE OF THE VISIT**, so they can disagree for the
     length of one: the list is read once and nothing drops it, and the answer about the caller is
     the one the server gave a moment ago. 000001 stands in the generated data and is on the list the
     disc serves; the answer about him says his fee does not stand. The panels are drawn from the list
     for a member whose fee stands, so a screen that asked the LIST whether to draw them - and not the
     flag - would draw all five here, and this is the only case that tells the two apart: for every
     other lapsed member the list has no row to draw them from, which makes the gate look redundant
     and is exactly why it needs a case. */
  it('draws the theme and nothing else, whatever the list holds', async () => {
    stand(hisPageAsServed({ memberNumber: '000001', active: false }))
    renderAt('/sr/podesavanja', 'visitor', null)

    await drawn()

    for (const panel of [
      PANELS.data,
      PANELS.locked,
      PANELS.picture,
      PANELS.biography,
      PANELS.password,
      PANELS.privacy,
    ]) {
      expect(screen.queryByRole('heading', { name: panel }), panel).not.toBeInTheDocument()
    }

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expectTheSentenceAboutRenewal()
  }, SLOW)
})

describe('the settings of an administration account with no member', () => {
  /* The answer a moderator or a superadmin gets from `GET /api/me`: a role, an account, the language of
     its mail, and no `member` at all (PDL P21). Everything else is the disc, as for every screen. */
  function administration(role: string): void {
    stand(
      serverThat((path) => {
        if (path === '/api/me') {
          return new Response(JSON.stringify({ role, account: 11, mailLanguage: 'sr' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }

        return path.startsWith('/api') && !isResource(path) ? answeredWith(404) : null
      }),
    )
  }

  it.each(['moderator', 'superadmin'])(
    'draws a %s the password and the theme and the language of the mail, in that order, and nothing else',
    async (role) => {
      administration(role)
      renderAt('/sr/podesavanja', 'visitor', null)

      await drawn()
      expect(await screen.findByRole('group', { name: 'Jezik pošte' })).toBeVisible()

      /* Asked of the whole list of headings, so that a panel drawn beyond these three, and one of
         these three drawn in another place, both fail. */
      expect(
        within(screen.getByRole('main'))
          .getAllByRole('heading', { level: 2 })
          .map((one) => one.textContent),
      ).toEqual([PANELS.password, PANELS.appearance, PANELS.mail])
      expect(screen.getByRole('radio', { name: 'Tamna' })).toBeVisible()
      expect(screen.getByLabelText(/^Trenutna lozinka/)).toBeVisible()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      /* Nothing is waiting on a renewal for somebody who has no fee: the sentence is a lapsed member's. */
      expectNoSentenceAboutRenewal()
      expect(screen.queryByText(WHAT_OPENS_LATER)).not.toBeInTheDocument()
    },
    SLOW,
  )
})

describe('the settings of a member whose fee stands', () => {
  /* 000001 is freed of the fee in the generated data and stands. The anchor of the other two:
     everything is drawn, in the order it was always drawn in. */
  it('draws every panel there is, and not the sentence for somebody who has not paid', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000001')

    await drawn()

    for (const panel of [
      PANELS.data,
      PANELS.locked,
      PANELS.picture,
      PANELS.biography,
      PANELS.password,
      PANELS.privacy,
    ]) {
      expect(await screen.findByRole('heading', { name: panel }), panel).toBeVisible()
    }

    expect(screen.getByRole('checkbox')).toBeVisible()
    expect(screen.queryByText(WHAT_OPENS_LATER)).not.toBeInTheDocument()
    /* Nothing to be told: his fee stands, so nothing is waiting on a renewal. */
    expectNoSentenceAboutRenewal()
  }, SLOW)

  it('draws them in the order of how much each is his own, with the password before the theme', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000001')

    await drawn()
    await screen.findByRole('heading', { level: 2, name: PANELS.privacy })

    expect(
      within(screen.getByRole('main'))
        .getAllByRole('heading', { level: 2 })
        .map((one) => one.textContent),
    ).toEqual([
      PANELS.data,
      PANELS.locked,
      PANELS.picture,
      PANELS.biography,
      PANELS.password,
      PANELS.appearance,
      PANELS.mail,
      PANELS.privacy,
    ])
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    /* The floor under the `configure` at the head of the file, asked of the number that decides and
       not of the text of the file. Every case above is given `SLOW`, and every wait half of it; take
       the `configure` away and both are `SLOW` again (`test/setup.ts`), so a wait that never
       succeeds is ended by the clock of the case that is waiting for it and the series of mutations
       that reads the log has nothing but a timeout to count. */
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
