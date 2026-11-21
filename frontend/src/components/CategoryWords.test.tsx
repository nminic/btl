import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CategoryWords } from './CategoryWords'

describe('CategoryWords', () => {
  it('is named by the full name and hides the short form from a reader', () => {
    render(
      <button type="button">
        <CategoryWords full="M 24-" short="24-" />
      </button>,
    )

    /* The full name is the name of the button: the short form is `aria-hidden` and is not read twice. */
    expect(screen.getByRole('button', { name: 'M 24-' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '24-' })).not.toBeInTheDocument()
  })

  it('draws a label that is as short as it gets once', () => {
    render(
      <button type="button">
        <CategoryWords full="Početnici" short="Početnici" />
      </button>,
    )

    expect(screen.getByRole('button', { name: 'Početnici' })).toBeInTheDocument()
    expect(screen.getByRole('button').children).toHaveLength(0)
  })
})
