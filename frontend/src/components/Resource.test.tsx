import { screen } from '@testing-library/react'
import type { ResourceState } from '../data/useResource'
import { renderWithI18n } from '../test/render'
import { Resource } from './Resource'

describe('Resource', () => {
  it('announces loading', () => {
    const state: ResourceState<string> = { status: 'loading' }
    renderWithI18n(<Resource<string> state={state}>{(data) => <span>{data}</span>}</Resource>)

    expect(screen.getByRole('status')).toHaveTextContent('Učitavanje')
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
