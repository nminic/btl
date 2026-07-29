import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import { SessionContext, type Message, type SessionValue } from '../session/context'
import { renderAt } from '../test/render'
import { monogramFor } from './monogram'
import { CaretIcon, GearIcon, MailIcon, SignInIcon } from './icons'
import { MessagesMenu } from './MessagesMenu'
import type { Competitor } from '../data/types'

/* The header: the mark, the groups that open, the inbox, the account picture
 * and the cog. Everything here is reached by role and by name, because that is
 * how it is reached with a keyboard and a screen reader too. */

/** The panel a trigger opens, found the way a screen reader finds it: through
 *  the aria-controls of the button. Several member screens repeat the same
 *  words, so the panel has to be looked in rather than the whole page. */
function panelOf(triggerName: string | RegExp) {
  const trigger = screen.getByRole('button', { name: triggerName })
  const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '')

  return within(panel as HTMLElement)
}

describe('the brand', () => {
  it('says the whole name and the slogan, and leads home', async () => {
    const user = userEvent.setup()
    renderAt('/sr/timovi')

    const brand = await screen.findByRole('link', { name: 'Naslovna strana' })
    expect(within(brand).getByText('Balkanska trkačka liga')).toBeVisible()
    expect(within(brand).getByText('Svaka trka se broji.')).toBeVisible()

    await user.click(brand)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Balkanska trkačka liga')
  })
})

describe('a panel that opens under a button', () => {
  it('opens and closes from its own button, and says which panel it controls', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Tabele' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', 'nav-tables')
    expect(screen.queryByRole('link', { name: 'BTL tabela' })).not.toBeInTheDocument()

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'BTL tabela' })).toBeVisible()

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Tabele' })
    await user.click(button)
    await user.keyboard('{Escape}')

    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('leaves a key it does not handle alone', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Tabele' })
    await user.click(button)
    await user.keyboard('{ArrowDown}')

    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes when something outside it is clicked', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Tabele' })
    await user.click(button)
    await user.click(screen.getByRole('main'))

    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays open while something inside it is clicked', async () => {
    const user = userEvent.setup()
    renderAt('/sr', 'competitor', 'M0005')

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })
    await user.click(button)
    await user.click(await panelOf('Otvori nalog').findByText('Strahinja Vukićević'))

    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('monogramFor', () => {
  const member: Competitor = {
    memberNumber: 'M0005',
    firstName: 'strahinja',
    lastName: 'vukićević',
    gender: 'M',
    city: 'Banja Luka',
    country: 'BA',
    birthYear: 2007,
    firstSeason2027: false,
    firstSeason: 2015,
    active: true,
    membershipBasis: 'payment',
    teamId: null,
  }

  it('takes the initials of whoever is signed in', () => {
    expect(monogramFor(member, 'M0005')).toBe('SV')
  })

  it('falls back to the end of the member number until the name is there', () => {
    expect(monogramFor(undefined, 'M0005')).toBe('05')
  })
})

describe('the account menu', () => {
  it('offers a visitor the way in and nothing else', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('link', { name: 'Prijavi se' })).toHaveAttribute(
      'href',
      '/sr/prijava',
    )
  })

  it('shows the monogram and the name of whoever is signed in', async () => {
    const user = userEvent.setup()
    renderAt('/sr', 'competitor', 'M0005')

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })
    expect(button).toHaveTextContent('SV')

    await user.click(button)
    expect(await panelOf('Otvori nalog').findByText('Strahinja Vukićević')).toBeVisible()
  })

  it('falls back to the member number when there is no such member', async () => {
    const user = userEvent.setup()
    renderAt('/sr', 'competitor', 'M9999')

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })
    expect(button).toHaveTextContent('99')

    await user.click(button)
    expect(panelOf('Otvori nalog').getByText('M9999')).toBeVisible()
  })

  it('closes itself when one of its links is followed', async () => {
    const user = userEvent.setup()
    renderAt('/sr', 'competitor', 'M0005')

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })
    await user.click(button)
    await user.click(screen.getByRole('link', { name: 'Moja članarina' }))

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(await screen.findByRole('heading', { level: 1, name: 'Moja članarina' })).toBeVisible()
  })

  it('signs out from the menu', async () => {
    const user = userEvent.setup()
    renderAt('/sr/moj-profil', 'competitor', 'M0005')

    await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))
    await user.click(panelOf('Otvori nalog').getByRole('button', { name: 'Odjavi se' }))

    expect(screen.getByRole('heading', { name: 'Za ovo treba prijava' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Prijavi se' })).toBeVisible()
  })
})

describe('the inbox in the header', () => {
  it('carries the number of unread messages in the name of the button', async () => {
    renderAt('/sr', 'competitor', 'M0005')

    // The count is part of the name, not a badge nobody hears: an aria-label
    // replaces the contents of the button.
    expect(await screen.findByRole('button', { name: 'Otvori poruke, 1 nepročitana' })).toBeVisible()
  })

  it('lists what arrived, newest first, and opens one of them', async () => {
    const user = userEvent.setup()
    renderAt('/sr', 'competitor', 'M0005')

    await user.click(await screen.findByRole('button', { name: /Otvori poruke/ }))
    await user.click(screen.getByRole('link', { name: /Dobro došao u pripremu sezone 2027/ }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Dobro došao u pripremu sezone 2027' }),
    ).toBeVisible()
    // Reading it is what marks it read, so the header says nothing is waiting.
    expect(screen.getByRole('button', { name: 'Otvori poruke, 0 nepročitanih' })).toBeVisible()
  })

  it('leads to the whole inbox', async () => {
    const user = userEvent.setup()
    renderAt('/sr', 'competitor', 'M0005')

    await user.click(await screen.findByRole('button', { name: /Otvori poruke/ }))
    await user.click(screen.getByRole('link', { name: 'Sve poruke' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Poruke' })).toBeVisible()
  })

  it('says so when there is nothing in it', async () => {
    const user = userEvent.setup()
    renderInbox([])

    await user.click(screen.getByRole('button', { name: /Otvori poruke/ }))

    expect(screen.getByText('Nema poruka.')).toBeVisible()
  })
})

const ICONS: [string, ReactElement][] = [
  ['the cog', <GearIcon key="gear" />],
  ['the way in', <SignInIcon key="signin" />],
  ['the envelope', <MailIcon key="mail" className="inbox__glyph" />],
  ['the caret', <CaretIcon key="caret" />],
]

describe('the icons', () => {
  it.each(ICONS)('draws %s as a picture that carries no name of its own', (_name, icon) => {
    const { container } = render(icon)
    const drawing = container.firstElementChild

    expect(drawing?.tagName).toBe('svg')
    // The meaning is in the label of the control the icon sits in, never in the
    // icon, so assistive technology is told to skip it.
    expect(drawing).toHaveAttribute('aria-hidden', 'true')
  })
})

function renderInbox(messages: Message[]) {
  const session: SessionValue = {
    memberNumber: 'M0005',
    signIn: vi.fn(),
    signOut: vi.fn(),
    submissions: [],
    submit: vi.fn(),
    decide: vi.fn(),
    messages,
    markRead: vi.fn(),
    notifications: {
      resultApproved: true,
      resultChanged: true,
      upcomingEvent: true,
      newsletter: false,
    },
    setNotification: vi.fn(),
    edits: {},
    edit: vi.fn(),
  }

  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>
        <SessionContext.Provider value={session}>
          <MessagesMenu />
        </SessionContext.Provider>
      </MemoryRouter>
    </I18nProvider>,
  )
}
