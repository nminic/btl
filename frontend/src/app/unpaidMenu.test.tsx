import { configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { htmlElement } from '../test/at'
import { aNeverPaidRecord, neverPaidAsServed } from '../test/neverPaid'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useSession } from '../session/useSession'

/**
 * THE MENU BEHIND THE PICTURE OF SOMEBODY WHO REGISTERED AND HAS NOT PAID, AND THE WORD IT MAY NOT
 * SAY.
 *
 * <p>Owner, 22.10.2026 (PDL, „Član koji još nije platio: bez reči nalog, samo Članarina"): „Kada se
 * član prijavi, a pre nego što uplati, stoji mu Nalog 4 npr. gore desno. Ne sme nigde da se pominje
 * nalog 4 niti reč nalog uopšte. niti broj naloga. Treba i dalje da stoje inicijali, a da se prikaže
 * ime kad se klikne na to. Sve opcije koje mu nisu dostupne privremeno (dakle sve osim Članarine) ne
 * treba da mu uopšte budu dostupne." And, chosen between offered outcomes with the recommendation:
 * „Odjava ostaje dostupna." And: „Neka ima u navigaciji stranu Moji Podaci dok nije odobren koja je
 * iznad Moja Članarina."
 *
 * <p><b>Where he is, and where the word could be read</b>, written as a list so that a place the list
 * does not name is a place the cases do not claim: the text on the screen, the names the page gives to
 * what is on it (`aria-label`, `title`, `alt`, `placeholder`) and the title of the document. The
 * words of the pages that are not his to change - the rulebook, the terms, the privacy policy - are
 * the league's own text and are not asked.
 *
 * <p>Every wait is given half of the time a case has, so a wait that never succeeds ends the case in
 * an assertion and not in its own clock.
 */
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

/** The button behind the picture, once the portal has drawn who is signed in. */
async function pictureButton(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: 'Otvori moj meni' })
}

/** The panel that button opens, found the way a screen reader finds it: through `aria-controls`. */
function panelOf(button: HTMLElement): HTMLElement {
  return htmlElement(document.getElementById(button.getAttribute('aria-controls') ?? ''))
}

/** Everything on the screen that is a word a reader could meet, one string each. */
function everyWordOnTheScreen(): string[] {
  const attributes = ['aria-label', 'title', 'alt', 'placeholder']
  const named = [...document.querySelectorAll(attributes.map((one) => `[${one}]`).join(','))].flatMap(
    (one) => attributes.flatMap((attribute) => one.getAttribute(attribute) ?? []),
  )

  return [document.body.textContent ?? '', document.title, ...named]
}

describe('the picture of somebody who has not paid', () => {
  it('holds the initials of his name and not the digits of his account', async () => {
    stand(neverPaidAsServed())
    renderAt('/sr', 'visitor', null)

    const button = await pictureButton()

    /* Waited for, because the name is a read of its own and the circle is empty until it arrives. The
       whole text is asked for and not a part of it: „TS" and nothing, so neither the id of the account
       (1 in this answer) nor the last two digits of anything stand beside it. */
    await waitFor(() => {
      expect(button).toHaveTextContent(/^TS$/)
    })
  }, SLOW)

  it('is named without the word, and the name that says „nalog" is not on the page at all', async () => {
    stand(neverPaidAsServed())
    renderAt('/sr', 'visitor', null)

    await pictureButton()

    expect(screen.queryByRole('button', { name: /nalog/i })).not.toBeInTheDocument()
  }, SLOW)

  it('is empty until his name has arrived, and names nobody in the panel', async () => {
    /* The read of his name never comes back: the shell's question is answered and every other is held.
       The circle is empty and the panel does not name him, which is the state this case holds a floor
       under (the alternative was the last two digits of the account). */
    let answered = 0

    stand(
      serverThat((path) => {
        if (path !== '/api/me') {
          return null
        }

        answered += 1

        return answered === 1
          ? new Response(
              JSON.stringify({ role: 'competitor', account: 1, member: aNeverPaidRecord }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          : new Response(null, { status: 500 })
      }),
    )
    renderAt('/sr', 'visitor', null)

    const button = await pictureButton()

    await waitFor(() => {
      expect(answered).toBeGreaterThanOrEqual(2)
    })
    expect(button).toHaveTextContent(/^$/)
    expect(panelOf(button).querySelector('.account__who')).toBeNull()
    /* And what he can do does not depend on it. */
    expect(
      within(panelOf(button)).getByRole('link', { name: 'Moja članarina', hidden: true }),
    ).toBeInTheDocument()
    expect(
      within(panelOf(button)).getByRole('button', { name: 'Odjavi se', hidden: true }),
    ).toBeInTheDocument()
  }, SLOW)
})

describe('the panel behind the picture of somebody who has not paid', () => {
  it('names him, and holds „Moji podaci" above „Moja članarina", and the way out, and nothing else', async () => {
    const user = setupUser()

    stand(neverPaidAsServed())
    renderAt('/sr', 'visitor', null)

    const button = await pictureButton()

    await user.click(button)

    const panel = within(panelOf(button))

    expect(await panel.findByText('Tek Stigao')).toBeVisible()
    expect(
      panel.getAllByRole('link').map((one) => [one.textContent, one.getAttribute('href')]),
    ).toEqual([
      ['Moji podaci', '/sr/moji-podaci'],
      ['Moja članarina', '/sr/moja-clanarina'],
    ])
    expect(panel.getAllByRole('button').map((one) => one.textContent)).toEqual(['Odjavi se'])

    /* The three he is not drawn, named, so an entry that is left in by the next change fails here and
       not by being counted. */
    for (const gone of ['Moj profil', 'Moji rezultati', 'Podešavanja', 'Poruke']) {
      expect(panel.queryByRole('link', { name: gone }), gone).not.toBeInTheDocument()
    }
  }, SLOW)

  it('says no „Nalog", and no number of any account, anywhere in it', async () => {
    const user = setupUser()

    stand(neverPaidAsServed())
    renderAt('/sr', 'visitor', null)

    const button = await pictureButton()

    await user.click(button)
    await within(panelOf(button)).findByText('Tek Stigao')

    expect(htmlElement(panelOf(button)).textContent).not.toMatch(/nalog/i)
    expect(htmlElement(panelOf(button)).textContent).not.toMatch(/\d/)
  }, SLOW)

  it('signs him out from it', async () => {
    const user = setupUser()

    stand(neverPaidAsServed())
    renderAt('/sr/moja-clanarina', 'visitor', null)

    const button = await pictureButton()

    await user.click(button)
    await user.click(within(panelOf(button)).getByRole('button', { name: 'Odjavi se' }))

    expect(await screen.findByRole('link', { name: 'Prijavi se' })).toBeVisible()
  }, SLOW)

  it('follows a link and shuts itself, as the menu of everybody else does', async () => {
    const user = setupUser()

    stand(neverPaidAsServed())
    renderAt('/sr', 'visitor', null)

    const button = await pictureButton()

    await user.click(button)
    await user.click(within(panelOf(button)).getByRole('link', { name: 'Moji podaci' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Moji podaci' })).toBeVisible()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  }, SLOW)
})

describe('the picture of somebody who has not paid, with a keyboard and a screen reader', () => {
  /* The control is a disclosure (`app/Dropdown.tsx`): a button that says whether it is open and which
     panel it opens, and a panel of ordinary links. What the keyboard does is the same as for every
     other menu of the header, asked here of THIS one because it is a different component now. */
  it('opens with Enter, walks its entries in order with Tab, and Escape shuts it and gives the focus back', async () => {
    const user = setupUser()

    stand(neverPaidAsServed())
    renderAt('/sr', 'visitor', null)

    const button = await pictureButton()

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', 'account-menu')

    button.focus()
    await user.keyboard('{Enter}')

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panelOf(button)).toBeVisible()

    await user.tab()
    expect(screen.getByRole('link', { name: 'Moji podaci' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Moja članarina' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Odjavi se' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
  }, SLOW)

  it('is named by what it is for, which the sentence a screen reader hears says without the word', async () => {
    stand(neverPaidAsServed())
    renderAt('/sr', 'visitor', null)

    const button = await pictureButton()

    expect(button).toHaveAccessibleName('Otvori moj meni')
    /* The circle is not read twice: the letters inside the button are the picture's, the button's
       name is the sentence above. */
    expect(button).not.toHaveAccessibleName(/TS/)
  }, SLOW)
})

describe('the envelope of the inbox, for somebody who has not paid', () => {
  /* **HIDDEN UNTIL HE PAYS** (owner, 24.10.2026, chosen between offered outcomes with the recommendation:
     „Neplaćenom članu se koverta sa porukama u zaglavlju sakriva dok ne plati"). Held on both sides,
     because a header that dropped the envelope for everybody would pass the case about him. */
  it('is not drawn to him, and is drawn to a member and to administration', async () => {
    stand(neverPaidAsServed())
    renderAt('/sr', 'visitor', null)

    await pictureButton()

    expect(screen.queryByRole('button', { name: /Otvori poruke/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sve poruke', hidden: true })).not.toBeInTheDocument()
  }, SLOW)

  it('is drawn to a member', async () => {
    renderAt('/sr', 'competitor', '000007')

    expect(await screen.findByRole('button', { name: /Otvori poruke/ })).toBeVisible()
  }, SLOW)
})

describe('the word, over everything somebody who has not paid can open', () => {
  /* **ASKED OF THE SCREENS HE IS DRAWN AND OF NOTHING ELSE**: the front page, the calendar, the teams,
     the page he pays on and the page of his data. The rulebook, the terms and the privacy policy are
     text the association wrote and are not this record's to edit. The page he pays on is read for
     somebody in Serbia: the sentences about the association's PayPal account, drawn only to somebody
     abroad, call it „Nalog" and are asked of the owner (see the report of this change). */
  it.each(['/sr', '/sr/kalendar', '/sr/timovi', '/sr/moja-clanarina', '/sr/moji-podaci'])(
    'is nowhere on %s, in the text, in the names or in the title',
    async (address) => {
      stand(neverPaidAsServed())
      renderAt(address, 'visitor', null)

      const button = await pictureButton()

      /* Waited for until the name is in the circle, so the whole header has been drawn. */
      await waitFor(() => {
        expect(button).toHaveTextContent(/^TS$/)
      })
      await screen.findByRole('heading', { level: 1 })

      for (const words of everyWordOnTheScreen()) {
        expect(words).not.toMatch(/nalog/i)
      }
    },
    SLOW,
  )
})

describe('the word, on the page he pays on from abroad', () => {
  /* **THE PAYPAL SENTENCES NO LONGER SAY IT** (owner, 24.10.2026, chosen between offered outcomes with
     the recommendation: „Adresa naloga" is „PayPal adresa", and the note begins „PayPal adresa je
     poslovna, na Sportsko udruženje BTL."). They are drawn to everybody abroad and not to him alone, so
     the case reads the page as he meets it and as a member does. */
  it('is nowhere on it, in the text or in the names, and the label and the note are the new ones', async () => {
    stand(neverPaidAsServed({ country: 'MK' }))
    renderAt('/sr/moja-clanarina', 'visitor', null, undefined, '2026-11-01')

    expect(await screen.findByRole('heading', { level: 4, name: 'PayPal' })).toBeVisible()
    expect(screen.getByText('PayPal adresa')).toBeVisible()
    expect(screen.getByText(/^PayPal adresa je poslovna, na Sportsko udruženje BTL\./)).toBeVisible()

    for (const words of everyWordOnTheScreen()) {
      expect(words).not.toMatch(/nalog/i)
    }
  }, SLOW)
})

describe('the same menu for everybody else', () => {
  /* **THE OTHER SIDE OF EVERY CASE ABOVE.** A menu that dropped the word, the number and the entries for
     everybody would pass the cases about him and fail one of these. Administration has no record to
     take a name from (PDL P21) and is still named by its account, which is the decision of
     22.10.2026 left as it was: the owner's sentence is about somebody who has not paid. */
  it('names an administration account by its account, as it always was', async () => {
    const user = setupUser()

    stand(
      serverThat((path) =>
        path === '/api/me'
          ? new Response(JSON.stringify({ role: 'moderator', account: 11 }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          : null,
      ),
    )
    renderAt('/sr', 'visitor', null)

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })

    expect(button).toHaveTextContent('11')
    await user.click(button)
    expect(within(panelOf(button)).getByText('Nalog 11')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Moji podaci' })).not.toBeInTheDocument()
  }, SLOW)

  it('draws a member the entries it always had, without „Moji podaci"', async () => {
    const user = setupUser()

    renderAt('/sr', 'competitor', '000007')

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })

    await user.click(button)

    expect(
      within(panelOf(button))
        .getAllByRole('link')
        .map((one) => one.textContent),
    ).toEqual(['Moj profil', 'Moji rezultati', 'Moja članarina', 'Podešavanja'])
  }, SLOW)
})

/**
 * Signs in a member through the portal's own live writer, as the answer to `GET /api/me` does the
 * moment a moderator records the payment and the member next opens the portal.
 */
function ApprovesHim() {
  const { theServerSignedMeIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        theServerSignedMeIn({
          account: 1,
          memberNumber: '000021',
          country: 'RS',
          firstSeason: 2027,
          teamId: null,
          membershipBasis: 'payment',
          membershipSeason: 2027,
          referralCode: '3d6b1f0a9c2e4478',
          referredCount: 0,
          hasARecord: true,
          feeStands: true,
        })
      }}
    >
      odobri ga
    </button>
  )
}

describe('the menu, when his fee is recorded', () => {
  /* **„MOJI PODACI" GOES AWAY WITH THE APPROVAL** (PDL 22.10.2026: „posle odobrenja „Moji podaci" nestaje
     iz navigacije"), in the same render the session changes in. The member he becomes is a row of the
     generated data, so he is named as one and his circle is a member's. */
  it('loses „Moji podaci", gains the entries of a member, and is named as a member', async () => {
    const user = setupUser()

    stand(neverPaidAsServed())
    renderAt('/sr', 'visitor', null, undefined, undefined, <ApprovesHim />)

    const before = await pictureButton()

    await user.click(before)
    expect(within(panelOf(before)).getByRole('link', { name: 'Moji podaci' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'odobri ga' }))

    const after = await screen.findByRole('button', { name: 'Otvori nalog' })

    await user.click(after)

    const panel = within(panelOf(after))

    expect(await panel.findByText('Ksenija Vasiljević')).toBeVisible()
    expect(panel.queryByRole('link', { name: 'Moji podaci' })).not.toBeInTheDocument()
    expect(panel.getByRole('link', { name: 'Moj profil' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Otvori moj meni' })).not.toBeInTheDocument()
  }, SLOW)
})
