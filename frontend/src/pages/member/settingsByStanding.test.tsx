import { act, configure, getConfig, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { hisPageAsServed } from '../../test/hisPage'
import { neverPaidAsServed } from '../../test/neverPaid'
import { renderAt } from '../../test/render'
import { answeredWith, isResource, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'

/**
 * THE SETTINGS SCREEN HAS THREE SHAPES, AND WHICH ONE A READER IS DRAWN IS DECIDED BY WHO HE IS. A
 * FOURTH READER, SOMEBODY WHO REGISTERED AND HAS NOT PAID, IS NOT DRAWN IT AT ALL.
 *
 * <p>PDL P8, the entry „Šta sme neplaćen član" (10.10.2026) and its addition of 11.10.2026, both
 * chosen by the owner between offered outcomes - the sentences are the record's and not his own
 * words:
 *
 * <ul>
 * <li><b>Somebody who registered and has not paid</b> was drawn the password and the theme until
 * 23.10.2026, and is sent to the page he pays on since: the owner decided on 22.10.2026 (PDL, „Član
 * koji još nije platio: bez reči nalog, samo Članarina") that „Sve opcije koje mu nisu dostupne
 * privremeno (dakle sve osim Članarine) ne treba da mu uopšte budu dostupne", and „vidljive niti deep
 * linkom dostupne". His data are on the page „Moji podaci" (`myData.test.tsx`).</li>
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
  picture: 'Profilna slika',
  biography: 'Tekst o sebi',
  password: 'Lozinka',
  appearance: 'Izgled',
  mail: 'Pošta',
  privacy: 'Privatnost',
} as const

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
  /* **HE IS NOT DRAWN THEM, AND NOT TOLD THEY EXIST** (PDL 22.10.2026, „Član koji još nije platio:
     bez reči nalog, samo Članarina"): until 23.10.2026 he was drawn the password and the theme, with a
     sentence that three more opened with his fee. The address sends him to the page he pays on, and
     nothing of the screen is drawn on the way. */
  it('sends him to the page he pays on and draws none of the settings', async () => {
    stand(neverPaidAsServed())
    const { router } = renderAt('/sr/podesavanja', 'visitor', null)

    expect(await screen.findByRole('heading', { level: 1, name: 'Moja članarina' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/sr/moja-clanarina')
    expect(screen.queryByRole('heading', { level: 1, name: 'Podešavanja' })).not.toBeInTheDocument()

    for (const panel of Object.values(PANELS)) {
      expect(screen.queryByRole('heading', { name: panel }), panel).not.toBeInTheDocument()
    }
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
      PANELS.picture,
      PANELS.biography,
      PANELS.password,
      PANELS.privacy,
    ]) {
      expect(screen.queryByRole('heading', { name: panel }), panel).not.toBeInTheDocument()
    }

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
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
    },
    SLOW,
  )
})

describe('the settings of a member whose fee stands', () => {
  /* 000001 is freed of the fee in the generated data and stands. The anchor of the other two:
     everything is drawn, in the order it was always drawn in. */
  it('draws every panel there is', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000001')

    await drawn()

    for (const panel of [PANELS.picture, PANELS.biography, PANELS.password, PANELS.privacy]) {
      expect(await screen.findByRole('heading', { name: panel }), panel).toBeVisible()
    }

    expect(screen.queryByRole('heading', { name: PANELS.data })).not.toBeInTheDocument()

    expect(screen.getByRole('checkbox')).toBeVisible()
    /* Nothing to be told: his fee stands, so nothing is waiting on a renewal. */
    expectNoSentenceAboutRenewal()
  }, SLOW)

  /* THREE ROWS OF TWO, IN THE OWNER'S ORDER (PDL 22.10.2026, „Strana Podešavanja u tri visoka reda sa
     dve kolone"): the password and who sees the profile, the picture and the words about himself, the
     theme and the language of the mail. And the personal data are not among them, for him either: they
     are on the card „Podaci" of his profile. */
  it('draws them in three rows, the password and the privacy, the picture and the words, the theme and the mail', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000001')

    await drawn()
    await screen.findByRole('heading', { level: 2, name: PANELS.privacy })
    await screen.findByRole('heading', { level: 2, name: PANELS.biography })

    expect(
      within(screen.getByRole('main'))
        .getAllByRole('heading', { level: 2 })
        .map((one) => one.textContent),
    ).toEqual([
      PANELS.password,
      PANELS.privacy,
      PANELS.picture,
      PANELS.biography,
      PANELS.appearance,
      PANELS.mail,
    ])
  }, SLOW)
})

/**
 * WHICH PANELS STAND BESIDE WHICH (PDL 22.10.2026, „Strana Podešavanja u tri visoka reda sa dve
 * kolone": „lozinka prelazi levo na njeno mesto, a Privatnost tekst iz priloga ide u desni stubac pored
 * boksa za lozinku [...] Profilna slika sa svim opcijama treba da bude u nivou levog stupca, a u desni
 * stubac treba da dođe u njenoj visini Tekst o sebi boks"; and from 18.10.2026 „Boksovi „Tema" i
 * „Jezik pošte" stoje jedan pored drugog u istom redu").
 *
 * <p>jsdom lays nothing out, so "beside" is asked in the only terms it can answer: two panels share a
 * `.member__pair`, the one element the stylesheet turns into two columns from 51.25em
 * (`styles/settingsLayout.test.ts` holds the rule, and `geometry/settings.geometry.ts` asks Chrome
 * where they then LAND). Asked of each of the three ways of being drawn the screen, because the panels of
 * each are different: the pair a member is drawn is not the pair a member whose fee has lapsed is, and an
 * administration account has its password with no neighbour at all.
 */
describe('which panels of the settings stand beside which', () => {
  const pairOf = (name: string): Element | null =>
    screen.getByRole('heading', { level: 2, name }).closest('.member__pair')

  /** The panels in a pair, by their headings, in the order they stand in. */
  const panelsIn = (pair: Element | null): (string | null)[] =>
    [...(pair?.querySelectorAll(':scope > section > h2') ?? [])].map((one) => one.textContent)

  it('puts the password beside the privacy, the picture beside the words, and the theme beside the mail, for a member whose fee stands', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000001')

    await drawn()
    await screen.findByRole('heading', { level: 2, name: PANELS.privacy })
    await screen.findByRole('heading', { level: 2, name: PANELS.biography })

    expect(panelsIn(pairOf(PANELS.password))).toEqual([PANELS.password, PANELS.privacy])
    expect(panelsIn(pairOf(PANELS.picture))).toEqual([PANELS.picture, PANELS.biography])
    expect(panelsIn(pairOf(PANELS.appearance))).toEqual([PANELS.appearance, PANELS.mail])
    expect(new Set([pairOf(PANELS.password), pairOf(PANELS.picture), pairOf(PANELS.appearance)]).size,
      'the three rows are three').toBe(3)

    /* And every pair is one of the tall rows (`.member__row`), whose two boxes are as tall as each
       other (`Member.css`). */
    for (const panel of [PANELS.password, PANELS.picture, PANELS.appearance]) {
      expect(pairOf(panel), panel).toHaveClass('member__row')
      /* Two boxes and nothing else, so nothing a panel draws beside itself takes a cell of the row. */
      expect(pairOf(panel)?.children, panel).toHaveLength(2)
    }
  }, SLOW)

  it('puts the theme beside the language of the mail for a member whose fee has lapsed, who has neither the data nor the password', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000032')

    await drawn()

    expect(panelsIn(pairOf(PANELS.appearance))).toEqual([PANELS.appearance, PANELS.mail])
    expect(screen.queryByRole('heading', { level: 2, name: PANELS.data })).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: PANELS.password })).toBeNull()
  }, SLOW)

  it('leaves the password alone in its row for an administration account, which has no profile to hide', async () => {
    stand(
      serverThat((path) => {
        if (path === '/api/me') {
          return new Response(JSON.stringify({ role: 'moderator', account: 11, mailLanguage: 'sr' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }

        return path.startsWith('/api') && !isResource(path) ? answeredWith(404) : null
      }),
    )
    renderAt('/sr/podesavanja', 'visitor', null)

    await drawn()
    expect(await screen.findByRole('group', { name: 'Jezik pošte' })).toBeVisible()

    expect(panelsIn(pairOf(PANELS.password))).toEqual([PANELS.password])
    expect(panelsIn(pairOf(PANELS.appearance))).toEqual([PANELS.appearance, PANELS.mail])
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
