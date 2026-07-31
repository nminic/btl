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

    renderWithI18n(<Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>)

    // The children are not rendered at all, so there is nothing to click even
    // if the sheet were somehow not there.
    expect(screen.queryByText('podaci')).not.toBeInTheDocument()
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
