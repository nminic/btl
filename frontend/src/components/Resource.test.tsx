import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import en from '../i18n/en.json'
import sr from '../i18n/sr.json'
import type { ResourceState } from '../data/useResource'
import { aFailedRead } from '../test/failedRead'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import { Resource } from './Resource'

describe('Resource', () => {
  /* A sheet over the whole page, not a word where the content will be (owner,
     31.07.2026): a line of text reads as the answer, and the page under it is
     still there to be clicked a moment before the data lands. */
  it('covers the page while it waits, and says so out loud', () => {
    const state: ResourceState<string> = { status: 'loading' }
    const { container } = renderWithI18n(
      <Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Učitavanje')
    // The word is for a screen reader alone; what is seen is the sheet.
    expect(screen.getByText('Učitavanje')).toHaveClass('visually-hidden')
    expect(container.querySelector('.loader')).toBeInTheDocument()
  })

  it('shows nothing of the screen underneath while it waits', () => {
    const state: ResourceState<string> = { status: 'loading' }

    renderWithI18n(
      <Resource<string> state={state}>{() => <a href="/sr/kalendar">Kalendar</a>}</Resource>,
    )

    /* The children are not rendered at all, so there is nothing to click and
       nothing to tab to even if the sheet were somehow not there. The child
       ignores the data on purpose: one that printed it would render nothing
       while loading anyway, and the assertion could not fail. By text and not by
       role, because a sheet drawn over the content rather than instead of it
       would mark the content aria-hidden, which takes it out of a role query
       while leaving every link under it focusable and clickable. */
    expect(screen.queryByText('Kalendar')).not.toBeInTheDocument()
  })

  it('stands where a part of a screen will be, without covering the page', () => {
    const state: ResourceState<string> = { status: 'loading' }
    const { container } = renderWithI18n(
      <Resource<string> state={state} inline label="Trke">
        {(data) => <span>{data}</span>}
      </Resource>,
    )

    /* A part of a screen waiting must not hide the parts that have arrived:
       that is the whole reason it loads separately. It still says what it is
       waiting for, and now says which part. */
    expect(container.querySelector('.loader--inline')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Učitavanje: Trke')
  })

  it('leaves a part waiting where it stands, with no sheet over the page', () => {
    /* jsdom applies no stylesheet, so the one thing that decides whether the
       page is covered is read off disk, the way the tokens are (ADL A7). Drop
       any of these three and the inline form becomes a sheet again. */
    const css = readFileSync(join(process.cwd(), 'src/components/Loader.css'), 'utf-8')
    const rule = css.slice(css.indexOf('.loader--inline {'))

    expect(rule).toMatch(/position:\s*static/)
    expect(rule).toMatch(/background:\s*none/)
    expect(rule).toMatch(/backdrop-filter:\s*none/)
  })

  it('announces an error', () => {
    const state: ResourceState<string> = aFailedRead()
    renderWithI18n(<Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders the data', () => {
    const state: ResourceState<string> = { status: 'ready', data: 'Fruškogorski maraton' }
    renderWithI18n(<Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>)

    expect(screen.getByText('Fruškogorski maraton')).toBeInTheDocument()
  })
})

/**
 * A READ THAT FAILED SAYS SO AND OFFERS TO ASK AGAIN (decision of 02.10.2026, PENDING stavka 368,
 * in the words of the PDL's record of it and not the owner's: „Spisak koji ne moze da se ucita KAZE
 * to, umesto da izgleda prazan, uz dugme „Pokusaj ponovo". Vazi za sve ekrane sa spiskom.").
 *
 * <p>This is the one place every screen that reads data goes through, so these are the cases that
 * hold the button for all of them at once; what a real screen does around it, and what asking
 * again reaches, is held where a server can answer (`data/askingAgain.test.tsx`,
 * `pages/resourceAsksAgain.test.tsx`).
 *
 * <p>The axes are the shape of the screen (a whole screen, a part that has a name, a part that has
 * none), the moment (failed, asking again, and every state in which there is nothing to ask) and
 * the language. The state is built by hand because that is the only way to hold it still: a failed
 * read that a real hook produces is already on its way to being something else.
 */
describe('Resource, when the read failed', () => {
  const showing = (state: ResourceState<string>, how: { inline?: boolean; label?: string } = {}) => {
    const drawn: string[] = []

    renderWithI18n(
      <Resource<string> state={state} {...how}>
        {(data) => {
          drawn.push(data)

          return <span>{data}</span>
        }}
      </Resource>,
    )

    return drawn
  }

  it('says so, and offers to ask again, where it owns the whole screen', () => {
    const drawn = showing(aFailedRead())

    expect(screen.getByRole('alert')).toHaveTextContent(sr.data.error)
    /* Named by its own word and nothing else: a whole screen has nothing to say which list it is
       about, and a name that carried an empty one („Pokušaj ponovo: ") would be worse than none. */
    expect(screen.getByRole('button', { name: sr.data.retry })).toBeVisible()
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-label')
    /* The screen underneath is not drawn over it and not drawn as if it had read nothing: it is
       not drawn, which is what a read that failed has to give. */
    expect(drawn).toEqual([])
    /* And no sheet over the page: a failure is something to read and to press, and a reader who
       cannot press anything under a sheet would be stuck with a button he cannot reach. */
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('names the button after the part where the part has a name', () => {
    showing(aFailedRead(), { inline: true, label: 'Trke' })

    expect(screen.getByRole('button', { name: `${sr.data.retry}: Trke` })).toHaveTextContent(
      sr.data.retry,
    )
  })

  it('names it by its own word where a part has no name', () => {
    showing(aFailedRead(), { inline: true })

    expect(screen.getByRole('button', { name: sr.data.retry })).not.toHaveAttribute('aria-label')
  })

  it('asks again, once, when the button is pressed', async () => {
    let asked = 0

    showing(
      aFailedRead({
        readAgain: () => {
          asked += 1
        },
      }),
    )

    await setupUser().click(screen.getByRole('button', { name: sr.data.retry }))

    expect(asked).toBe(1)
  })

  it('says it is asking while the request is out, and refuses a press without leaving the tab order', async () => {
    let asked = 0

    showing(
      aFailedRead({
        reading: true,
        readAgain: () => {
          asked += 1
        },
      }),
    )

    /* The sentence about the failure is gone and the loader's own word stands in its place, and it
       is a status and not an alert: asking again is not news of a fault. */
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(sr.data.loading)

    const button = screen.getByRole('button', { name: sr.data.retry })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()

    await setupUser().click(button)

    expect(asked, 'a press went through while the request was out').toBe(0)
  })

  it('draws no button where there is nothing to ask again', () => {
    for (const state of [
      { status: 'loading' } satisfies ResourceState<string>,
      { status: 'ready', data: 'Fruškogorski maraton' } satisfies ResourceState<string>,
    ]) {
      const { unmount } = renderWithI18n(
        <Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>,
      )

      expect(screen.queryByRole('button')).toBeNull()
      unmount()
    }
  })

  it('says the same in English', () => {
    renderWithI18n(
      <Resource<string> state={aFailedRead()} inline label="Races">
        {(data) => <span>{data}</span>}
      </Resource>,
      'en',
    )

    expect(screen.getByRole('alert')).toHaveTextContent(en.data.error)
    expect(screen.getByRole('button', { name: `${en.data.retry}: Races` })).toBeVisible()
  })
})
