import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import type { ResourceState } from '../data/useResource'
import { renderWithI18n } from '../test/render'
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
    const state: ResourceState<string> = { status: 'error', error: new Error('pukla veza') }
    renderWithI18n(<Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders the data', () => {
    const state: ResourceState<string> = { status: 'ready', data: 'Fruškogorski maraton' }
    renderWithI18n(<Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>)

    expect(screen.getByText('Fruškogorski maraton')).toBeInTheDocument()
  })
})
