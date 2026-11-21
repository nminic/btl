import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithI18n } from '../test/render'
import { LengthFilter } from './LengthFilter'

describe('LengthFilter', () => {
  it('is as wide as its buttons on the profile and not on the front page', () => {
    const first = renderWithI18n(<LengthFilter value={null} onChange={() => undefined} />)

    expect(screen.getAllByRole('button')[0]?.parentElement).not.toHaveClass('seg--fit')
    first.unmount()

    renderWithI18n(<LengthFilter fit value={null} onChange={() => undefined} />)

    expect(screen.getAllByRole('button')[0]?.parentElement).toHaveClass('seg--fit')
  })
})
