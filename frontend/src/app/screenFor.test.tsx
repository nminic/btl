import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nProvider'
import { Placeholder } from '../pages/Placeholder'
import { screenFor } from './routeObjects'
import { ROUTES } from './routes'

describe('screenFor', () => {
  it('answers a new address with a stand-in until its screen is built', () => {
    /* Every address the portal has today has a screen of its own, which makes
       this the only place the stand-in can be seen. It is what keeps a newly
       added route readable on the day it is added, instead of drawing nothing at
       all. */
    render(
      <I18nProvider locale="sr">
        {screenFor({ path: 'jos-nema-ekrana', labelKey: 'nav.badges', seoKey: 'badges' })}
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Značke' })).toBeVisible()
    expect(screen.getByText(/Ovaj ekran dolazi u sledećoj fazi/)).toBeVisible()
  })

  it('gives every address of the portal a screen of its own', () => {
    const standIns = ROUTES.filter((route) => screenFor(route).type === Placeholder)

    expect(standIns).toEqual([])
  })
})
