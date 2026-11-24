import type { FrontPageSponsors } from '../../data/types'
import { aFailedRead } from '../../test/failedRead'
import { sponsorsOrNobody } from './sponsorsOrNobody'

/**
 * THE THREE STATES OF THE SPONSORS' READ, AS THE FRONT PAGE WAITS FOR THEM (`sponsorsOrNobody.ts`).
 *
 * The case that the page is drawn whole and without a sponsor when the read fails is in
 * `pages/homeSponsored.test.tsx`; this holds the other half, which no drawn page can hold cheaply: that a
 * read still on its way is WAITED FOR, so the page is never drawn first without a sponsor and then
 * moved under the reader's eyes.
 */
describe('the sponsors of the front page, as the page waits for them', () => {
  const answered: FrontPageSponsors = {
    ofTheDay: {
      id: 7,
      name: 'VOLT',
      url: 'https://volt.primer.rs/',
      logo: '/api/photos/5e1f0a9c',
      description: 'Energetsko piće za duge treninge i noćne trke.',
      language: 'sr',
    },
    strip: [],
  }

  it('waits while the answer is on its way, and is not read as nobody', () => {
    expect(sponsorsOrNobody({ status: 'loading' })).toEqual({ status: 'loading' })
  })

  it('is the answer, as it came, once it is here', () => {
    expect(sponsorsOrNobody({ status: 'ready', data: answered })).toEqual({ status: 'ready', data: answered })
  })

  it('is nobody, and not a failure, when it cannot be read', () => {
    expect(sponsorsOrNobody(aFailedRead())).toEqual({ status: 'ready', data: { ofTheDay: null, strip: [] } })
  })
})
