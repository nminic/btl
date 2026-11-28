import { DICTIONARIES, formatKilometres, formatMetres, translator, type Dictionary } from './translate';

function keys(dictionary: Dictionary, prefix = ''): string[] {
  return Object.entries(dictionary).flatMap(([name, value]) =>
    typeof value === 'string' ? [`${prefix}${name}`] : keys(value, `${prefix}${name}.`),
  );
}

it('holds the same names in both dictionaries, and there are two', () => {
  expect(Object.keys(DICTIONARIES).sort()).toEqual(['en', 'sr']);
  expect(keys(DICTIONARIES.en).sort()).toEqual(keys(DICTIONARIES.sr).sort());
  expect(keys(DICTIONARIES.sr).length).toBeGreaterThan(0);
});

it('writes no em dash in either dictionary', () => {
  for (const dictionary of Object.values(DICTIONARIES)) expect(JSON.stringify(dictionary)).not.toContain('—');
});

it('translates a dotted key and fills its placeholder', () => {
  const t = translator('sr');

  expect(t('meter.ascent')).toBe('Uspon');
  expect(t('meter.metres', { value: '12' })).toBe('12 m');
  expect(translator('en')('meter.ascent')).toBe('Ascent');
});

it('answers an unknown key, a branch and a missing placeholder with what it was given', () => {
  const t = translator('sr');

  expect(t('meter.nothing')).toBe('meter.nothing');
  expect(t('meter')).toBe('meter');
  expect(t('meter.ascent.deeper')).toBe('meter.ascent.deeper');
  expect(t('meter.metres')).toBe('{value} m');
});

it('writes kilometres with two decimals and a Serbian decimal comma, rounded to ten metres', () => {
  expect(formatKilometres('sr', 12344.9)).toBe('12,34');
  expect(formatKilometres('sr', 12345.1)).toBe('12,35');
  expect(formatKilometres('sr', 299.999)).toBe('0,30');
  expect(formatKilometres('en', 0)).toBe('0.00');
});

it('writes metres as whole metres, rounded', () => {
  expect(formatMetres('sr', 9.49)).toBe('9');
  expect(formatMetres('sr', 9.5)).toBe('10');
  expect(formatMetres('sr', 1234.4)).toBe('1.234');
});
