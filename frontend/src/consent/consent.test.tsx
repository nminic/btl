import { render, screen } from '@testing-library/react'
import { CONSENT_KEY } from './consent'
import { useConsent } from './useConsent'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

/* Asking whether the portal may measure with cookies, and what happens to the
 * answer (ADL A9, PDL P8).
 *
 * The rules being held here are not this file's: the bar carries no „Odbij sve"
 * because the owner decided against it on 28.07.2026 with the risk written
 * down; Google Analytics is not fetched before somebody agrees; Umami needs no
 * agreement because it sets no cookie; and withdrawing costs as few presses as
 * agreeing did.
 *
 * What is deliberately not held here is that anything is measured. This build is
 * given no ids at all, in tests as in local development and on QA (ADL A9), so
 * neither script has anywhere to report to and neither is fetched. That the
 * loader asks for nothing without an id is the assertion below; that it asks for
 * the right thing with one is a matter for the build, and no test can put a real
 * measurement id in a public repository.
 */

const scriptsOn = (): string[] =>
  [...document.head.querySelectorAll('script')].map((one) => one.id)

describe('the question about measurement', () => {
  it('is asked once, at the foot of the page, and does not trap the reader', async () => {
    renderAt('/sr')

    const bar = await screen.findByRole('complementary', { name: 'Kolačići i merenje' })

    /* A region and not a dialog: nothing on the page is waiting on this answer,
       so the reader may walk past it. A dialog would hold the keyboard until it
       was dealt with, over a question the portal works perfectly well without. */
    expect(bar).toBeVisible()
    expect(bar).not.toHaveAttribute('role', 'dialog')
  })

  it('offers agreeing and closing, and nothing that records a refusal', async () => {
    /* PDL P8, question 368, confirmed 28.07.2026: no „Odbij sve" in the first
       layer. The risk is stated in the decision and accepted; what must not
       happen is that this quietly grows one, or that closing is written down as
       though it were an answer. */
    renderAt('/sr')

    const bar = await screen.findByRole('complementary', { name: 'Kolačići i merenje' })

    expect(
      [...bar.querySelectorAll('button')].map((one) => one.textContent),
    ).toEqual(['Prihvati', 'Zatvori traku'])
  })

  it('fetches nothing from Google before anybody has agreed', async () => {
    renderAt('/sr')
    await screen.findByRole('complementary', { name: 'Kolačići i merenje' })

    /* Not hidden, not queued, not loaded-and-idle. Asking for the script is
       already a request to Google carrying this reader's address. */
    expect(scriptsOn()).not.toContain('ga4')
  })

  it('remembers an agreement, and takes the question off the screen', async () => {
    const user = setupUser()
    renderAt('/sr')

    const bar = await screen.findByRole('complementary', { name: 'Kolačići i merenje' })

    await user.click(bar.getElementsByTagName('button')[0] ?? bar)

    expect(localStorage.getItem(CONSENT_KEY)).toBe('yes')
    expect(
      screen.queryByRole('complementary', { name: 'Kolačići i merenje' }),
    ).not.toBeInTheDocument()
  })

  it('writes nothing down when the bar is merely closed', async () => {
    /* „Zatvaranje trake nije pristanak", which the privacy policy says in those
       words. It is also not a refusal that was recorded, because there is no way
       to record one: the question is simply put again on the next visit, and
       that is the cost of the decision above. */
    const user = setupUser()
    renderAt('/sr')

    const bar = await screen.findByRole('complementary', { name: 'Kolačići i merenje' })

    await user.click(bar.getElementsByTagName('button')[1] ?? bar)

    expect(localStorage.getItem(CONSENT_KEY)).toBeNull()
    expect(
      screen.queryByRole('complementary', { name: 'Kolačići i merenje' }),
    ).not.toBeInTheDocument()
    expect(scriptsOn()).not.toContain('ga4')
  })
})

describe('withdrawing an agreement', () => {
  it('is one press, in the footer, on every page', async () => {
    /* Where the privacy policy says it is: „saglasnost za kolačiće menjate u
       podnožju svake strane". Until 15.08.2026 the policy said that and the
       footer carried privacy, terms and an email address. */
    const user = setupUser()
    renderAt('/sr')

    const bar = await screen.findByRole('complementary', { name: 'Kolačići i merenje' })
    await user.click(bar.getElementsByTagName('button')[0] ?? bar)

    expect(localStorage.getItem(CONSENT_KEY)).toBe('yes')

    await user.click(screen.getByRole('button', { name: 'Podešavanja kolačića' }))

    /* The record goes and the question comes back, so it costs exactly what
       agreeing cost (član 15 ZZPL, član 7 GDPR). */
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull()
    expect(
      await screen.findByRole('complementary', { name: 'Kolačići i merenje' }),
    ).toBeVisible()
  })

  it('brings the question back even after the bar was closed this visit', async () => {
    /* Closing hides the bar without answering. Withdrawing has to reopen it all
       the same, or somebody who closed it and then went looking for the control
       would press it and see nothing happen. */
    const user = setupUser()
    renderAt('/sr')

    const bar = await screen.findByRole('complementary', { name: 'Kolačići i merenje' })
    await user.click(bar.getElementsByTagName('button')[1] ?? bar)

    expect(
      screen.queryByRole('complementary', { name: 'Kolačići i merenje' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Podešavanja kolačića' }))

    expect(
      await screen.findByRole('complementary', { name: 'Kolačići i merenje' }),
    ).toBeVisible()
  })
})

describe('what is loaded, and when', () => {
  /* The build these tests run in is given no ids, like local development and QA
     (ADL A9). Everything below hands them in for the length of one test, because
     the whole of this file is the difference between having them and not, and a
     value that cannot be varied is a value nothing can check. */

  it('loads Umami for everybody, without asking anybody anything', async () => {
    /* It is hosted on the league's own server, sets no cookie and builds no
       profile, so there is nothing to consent to. It is also what keeps the
       numbers honest: Google cannot measure without cookies at all, so without
       this everybody who does not agree would be invisible rather than merely
       unprofiled. */
    vi.stubEnv('VITE_UMAMI_SRC', 'https://analytics.primer.rs/script.js')
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'proba')

    renderAt('/sr')
    await screen.findByRole('complementary', { name: 'Kolačići i merenje' })

    const umami = document.getElementById('umami')

    expect(umami).not.toBeNull()
    expect(umami).toHaveAttribute('data-website-id', 'proba')
    /* And the question is still on the screen, because Umami is not what it is
       about. */
    expect(
      screen.getByRole('complementary', { name: 'Kolačići i merenje' }),
    ).toBeVisible()
  })

  it('asks Google for nothing until somebody agrees, and then asks once', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-PROBA')

    const user = setupUser()
    renderAt('/sr')

    const bar = await screen.findByRole('complementary', { name: 'Kolačići i merenje' })

    /* Before: not hidden, not queued, not loaded-and-idle. Asking for the script
       is already a request to Google carrying this reader's address. */
    expect(document.getElementById('ga4')).toBeNull()

    await user.click(bar.getElementsByTagName('button')[0] ?? bar)

    const ga = document.getElementById('ga4')

    expect(ga).not.toBeNull()
    expect(ga).toHaveAttribute('src', 'https://www.googletagmanager.com/gtag/js?id=G-PROBA')
    /* Once. React runs an effect again whenever a dependency moves and mounts
       everything twice in development on purpose; a script fetched twice is a
       visit counted twice, and a portal whose own numbers are doubled is worse
       than one that measures nothing. */
    expect(document.querySelectorAll('script#ga4')).toHaveLength(1)
  })

  it('tells Google to stop when the agreement is withdrawn', async () => {
    /* The script already fetched cannot be unfetched, and the privacy policy
       does not promise that it can: „povlačenje ne dira zakonitost onoga što je
       mereno pre njega". What it can do is say so, and silence would let the
       script that is on the page go on sending. */
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-PROBA')

    const user = setupUser()
    renderAt('/sr')

    const bar = await screen.findByRole('complementary', { name: 'Kolačići i merenje' })
    await user.click(bar.getElementsByTagName('button')[0] ?? bar)
    await user.click(screen.getByRole('button', { name: 'Podešavanja kolačića' }))

    /* Read through a typed view of the window rather than an assertion, which
       ADL A14 bans: Google's queue belongs to a script this portal loads on one
       condition, so it is not a fact about every window. */
    const holder: Window & { dataLayer?: unknown[] } = window
    const said = holder.dataLayer ?? []

    expect(said).toContainEqual(['consent', 'update', { analytics_storage: 'denied' }])
  })
})

describe('asking about consent outside the provider', () => {
  it('refuses rather than answering „nobody has agreed"', () => {
    /* The same guard every other provider on the portal carries, and for the
       same reason: a hook that answered `false` where there is no provider would
       make a screen built without one look like a screen whose visitor declined,
       and Google would simply never be loaded for anybody. A missing provider is
       a fault in the tree, and it says so. */
    function Probe() {
      useConsent()

      return null
    }

    expect(() => render(<Probe />)).toThrow('useConsent must be used inside ConsentProvider')
  })
})
