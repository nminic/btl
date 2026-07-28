import { render, screen } from '@testing-library/react'
import { dictionaryFor, dictionaryLocale, isLocale, LOCALES } from './config'
import { I18nProvider } from './I18nProvider'
import { useI18n } from './useI18n'

function Probe() {
  const { locale, t } = useI18n()

  return (
    <>
      <span data-testid="locale">{locale}</span>
      <span data-testid="text">{t('app.name')}</span>
      <span data-testid="plural">{t('units.raceCount', { count: 3 })}</span>
    </>
  )
}

describe('config', () => {
  it('recognises the supported locales and nothing else', () => {
    expect(isLocale('sr')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })

  it('has a dictionary for every locale', () => {
    expect(dictionaryFor('sr')['app']).toBeDefined()
    expect(dictionaryFor('en')['app']).toBeDefined()
  })

  it('declares the language each address is really written in', () => {
    // While a locale still falls back to the Serbian dictionary, its declared
    // language has to say Serbian. These two tables drift apart silently.
    for (const locale of LOCALES) {
      const fallsBackToSerbian = dictionaryFor(locale) === dictionaryFor('sr')

      expect(dictionaryLocale(locale)).toBe(fallsBackToSerbian ? 'sr' : locale)
    }
  })
})

describe('I18nProvider', () => {
  it('translates through the provider', () => {
    render(
      <I18nProvider locale="sr">
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByTestId('locale')).toHaveTextContent('sr')
    expect(screen.getByTestId('text')).toHaveTextContent('Balkanska trkačka liga')
    expect(screen.getByTestId('plural')).toHaveTextContent('3 trke')
  })
})

describe('useI18n', () => {
  it('refuses to work outside the provider', () => {
    // React logs the thrown render error; silenced so the run stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow('useI18n must be used inside I18nProvider')

    spy.mockRestore()
  })
})
