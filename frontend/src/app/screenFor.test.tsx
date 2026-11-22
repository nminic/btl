import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nProvider'
import { Placeholder } from '../pages/Placeholder'
import { screenFor } from './screens'
import { ROUTES } from './routes'

describe('screenFor', () => {
  it('answers a new address with a stand-in until its screen is built', async () => {
    /* Every address the portal has today has a screen of its own, which makes
       this the only place the stand-in can be seen. It is what keeps a newly
       added route readable on the day it is added, instead of drawing nothing at
       all. */
    render(
      <I18nProvider locale="sr">
        {await screenFor({ path: 'jos-nema-ekrana', labelKey: 'nav.teams', seoKey: 'teams' })()}
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Timovi' })).toBeVisible()
    expect(screen.getByText(/Ovaj ekran je u izradi/)).toBeVisible()
  })

  it('gives every address of the portal a screen of its own', async () => {
    const drawn = await Promise.all(ROUTES.map(async (route) => ({ route, screen: await screenFor(route)() })))
    const standIns = drawn.filter((one) => one.screen.type === Placeholder).map((one) => one.route)

    expect(standIns).toEqual([])
  })
})
