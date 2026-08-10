import countries from './countries.json'

/**
 * What a country code is called, read off the same file the select is filled
 * from.
 *
 * The dictionary held five of these, the five of the region, and two screens
 * asked it for whatever code they had. The select offers two hundred and fifty
 * two: the six of the region at the top and the rest of the world under them, so
 * a team proposed from Slovenia reached the moderator as the words
 * `country.SI`. There is no second list to keep in step now, and no code without
 * a name.
 *
 * The code itself where the file does not have it, which is what a code that is
 * not a country is: a value typed in by hand or arriving from an older record.
 */
export function countryName(code: string): string {
  return [...countries.region, ...countries.rest].find((one) => one.code === code)?.name ?? code
}
