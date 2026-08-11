import countries from '../data/countries.json'
import { countryName } from '../data/countryName'
import { useI18n } from '../i18n/useI18n'

/**
 * Every country the portal knows, the region first.
 *
 * Written once and used by both selects that offer them: the country of a team's
 * seat, on a form of its own (FormRenderer.tsx), and the country beside a town
 * (PlaceField.tsx). It was written twice, and the two copies had already come
 * apart: one of them carried the option below and the other did not, so the same
 * code that read as a name in one place drew an empty box in the other.
 */
export function CountryOptions({ holding }: { holding: string }) {
  const { t } = useI18n()
  const named = [...countries.region, ...countries.rest].some((one) => one.code === holding)

  return (
    <>
      {/* Only while there is no answer, and then it is the answer standing
          there: a select handed the empty string with no option for it draws a
          blank box that reads as a country nobody can make out. On the form of
          an event this never shows, because an event starts on Serbia; on the
          registration form it is what the field opens on. */}
      {holding === '' && <option value="">{t('form.choose')}</option>}

      {/* The region first, because all but a handful of these races are run in
          it, and nine members in ten live there. */}
      <optgroup label={t('form.region')}>
        {countries.region.map((one) => (
          <option key={one.code} value={one.code}>
            {one.name}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('form.restOfWorld')}>
        {countries.rest.map((one) => (
          <option key={one.code} value={one.code}>
            {one.name}
          </option>
        ))}
      </optgroup>

      {/* And whatever code the record actually holds, where the list has no name
          for it. A select given a value it has no option for shows nothing at
          all: the box goes blank, `selectedIndex` is -1, and the country the
          record carries is invisible, so whoever is looking answers what looks
          unanswered and the record quietly moves country.

          Empty is not such a code: an unanswered country is unanswered, and the
          list says so with its own first row rather than with a nameless one. */}
      {holding !== '' && !named && <option value={holding}>{countryName(holding)}</option>}
    </>
  )
}
