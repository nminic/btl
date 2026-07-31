import { render, screen } from '@testing-library/react'
import { Sentence } from './Sentence'

describe('Sentence', () => {
  it('puts the node where the placeholder was, and keeps the words on both sides', () => {
    render(
      <p>
        <Sentence text="U klubu {team} od 2018." slot="team">
          <a href="/sr/tim/dunav">Dunavski trkači</a>
        </Sentence>
      </p>,
    )

    const line = screen.getByRole('paragraph')

    expect(line).toHaveTextContent('U klubu Dunavski trkači od 2018.')
    expect(screen.getByRole('link', { name: 'Dunavski trkači' })).toBeInTheDocument()
  })

  it('still reads as a sentence when the placeholder has been edited out', () => {
    /* A translator who drops the placeholder loses the link, which is a loss.
       Throwing instead would lose the whole screen, which is worse, and the
       missing word is visible the moment anyone looks. */
    render(
      <p>
        <Sentence text="U klubu od 2018." slot="team">
          <a href="/sr/tim/dunav">Dunavski trkači</a>
        </Sentence>
      </p>,
    )

    expect(screen.getByRole('paragraph')).toHaveTextContent('U klubu od 2018.')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
