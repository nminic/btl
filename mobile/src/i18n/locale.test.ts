import { getLocales } from 'expo-localization';
import { localeFor, phoneLocale } from './locale';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

const phone = (languageTag: string, languageCode: string | null = languageTag.split('-')[0]) => ({ languageTag, languageCode });

it.each([
  ['Serbian in Latin script', phone('sr-Latn-RS', 'sr')],
  ['Serbian in Cyrillic script', phone('sr-Cyrl-RS', 'sr')],
  ['Serbian with only a region', phone('sr-RS', 'sr')],
  ['Serbian with no language code, read from the tag', phone('sr-Cyrl-RS', null)],
  ['Serbian in the old underscore form', phone('sr_RS', null)],
  ['Serbian in capitals', phone('SR', 'SR')],
])('answers Serbian, in Latin script, for a phone set to %s', (_, locale) => {
  expect(localeFor([locale])).toBe('sr');
});

it.each([
  ['English', phone('en-US')],
  ['Croatian', phone('hr-HR')],
  ['Bosnian', phone('bs-BA')],
  ['German', phone('de-DE')],
])('answers English for a phone set to %s', (_, locale) => {
  expect(localeFor([locale])).toBe('en');
});

it('lets only the first language decide', () => {
  expect(localeFor([phone('en-US'), phone('sr-Latn-RS', 'sr')])).toBe('en');
  expect(localeFor([phone('sr-Cyrl-RS', 'sr'), phone('en-US')])).toBe('sr');
});

it('answers English for a phone that names no language', () => {
  expect(localeFor([])).toBe('en');
});

it('asks the phone', () => {
  jest.mocked(getLocales).mockReturnValue([phone('sr-Cyrl-RS', 'sr')] as never);

  expect(phoneLocale()).toBe('sr');
});
