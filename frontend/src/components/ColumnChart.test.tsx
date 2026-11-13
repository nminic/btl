import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Competitor } from '../data/types'
import { I18nProvider } from '../i18n/I18nProvider'
import { ColumnChart, type ChartColumn } from './ColumnChart'

/**
 * Where the number of a column stands (owner, 13.11.2026): a chart that counts
 * races carries it as a pin on the foot of the face and leaves the bar clean; the
 * chart of best progress, with two numbers in a bar, keeps them in the bar.
 *
 * Which of the two a chart is comes from the columns it is handed, so these cases
 * hand it both kinds and read where each number ended up.
 */
const competitor = (memberNumber: string): Competitor => ({
  memberNumber,
  firstName: 'Ime',
  lastName: memberNumber,
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  category: { season: 2027, ageBand: '40-54', beginner: false },
  categories: [{ season: 2027, ageBand: '40-54', beginner: false }],
  firstSeason: 2027,
  membershipBasis: 'payment',
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  photo: null,
  smallPhoto: null,
  crop: null,
  bio: '',
})

function draw(columns: ChartColumn[]) {
  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>
        <ColumnChart columns={columns} caption="Naslov" empty="Nema" label="Grafikon" />
      </MemoryRouter>
    </I18nProvider>,
  )
}

const counting = (label: string, memberNumber = '000001'): ChartColumn => ({
  competitor: competitor(memberNumber),
  value: 3,
  label,
  reading: 'trka',
  to: `/profil/${memberNumber}`,
})

const progress: ChartColumn = {
  competitor: competitor('000001'),
  value: 10,
  label: '1,50',
  reading: 'bodova',
  base: { value: 8, label: '8,00', reading: 'bodova ranije' },
  to: '/profil/000001',
}

const css = () => readFileSync(join(process.cwd(), 'src/components/ColumnChart.css'), 'utf-8')

const charsOf = () =>
  screen.getByRole('region', { name: 'Grafikon' }).style.getPropertyValue('--count-chars')

describe('the number of races on a column', () => {
  it('is a pin on the face and not a number in the bar', () => {
    draw([counting('12')])

    const figure = screen.getByText('12', { selector: 'span' })

    expect(figure).toHaveClass('colchart__count--pin')
    expect(figure.closest('.colchart__bar')).toBeNull()
    expect(screen.getByRole('region', { name: 'Grafikon' })).toHaveClass('colchart--pins')
  })

  it('is still said once, with the member, in the name of the column', () => {
    draw([counting('12')])

    const name = screen.getByRole('link').textContent ?? ''

    expect(name.match(/12/g)).toHaveLength(1)
    expect(name).toContain('trka')
    expect(name.indexOf('12')).toBeLessThan(name.indexOf('Ime 000001'))
  })

  it('stays in the bar, two of them, on the chart of best progress', () => {
    draw([progress])

    const loud = screen.getByText('1,50', { selector: 'span' })
    const quiet = screen.getByText('8,00', { selector: 'span' })

    expect(loud.closest('.colchart__bar')).not.toBeNull()
    expect(quiet.closest('.colchart__bar')).not.toBeNull()
    expect(loud).not.toHaveClass('colchart__count--pin')
    expect(quiet).not.toHaveClass('colchart__count--pin')
    expect(screen.getByRole('region', { name: 'Grafikon' })).not.toHaveClass('colchart--pins')
  })

  it('asks for a circle as wide as the longest number in its own chart', () => {
    const { unmount } = draw([counting('7')])
    const small = charsOf()
    unmount()
    draw([counting('7'), counting('123', '000002')])

    expect(Number(charsOf())).toBeGreaterThan(Number(small))
  })

  it('takes its diameter from the circle rule, so a long number stays a circle', () => {
    const rule = css().slice(css().indexOf('.colchart__count--pin {'))
    const body = rule.slice(0, rule.indexOf('}'))

    expect(body).not.toMatch(/--diameter:|inline-size|block-size|border-radius/)
    expect(body).toMatch(/var\(--diameter\) \* 0\.6/)
    expect(body).toMatch(/inset-block-end:\s*calc\(var\(--bar\)/)
    expect(body).toMatch(/box-shadow:\s*0 0 0 2px var\(--surface\)/)
  })
})
