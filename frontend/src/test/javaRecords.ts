import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The component names of a record `MeApi` declares, off the backend's own source.
 *
 * Read between the opening bracket and the one that closes it, counted rather than
 * looked for, because the components carry annotations with brackets of their own
 * (`@JsonInclude(JsonInclude.Include.NON_NULL)`). Those are taken off before the list is
 * split, so what is left of each component is „type name" and the name is the last word
 * of it.
 *
 * One reader for every record and for every file that asks: they are the same question
 * asked one storey apart, and two copies of it would be free to stop agreeing. It stood
 * inside `data/contract.test.ts` until 10.10.2026 and is out here since a second file
 * (`pages/profile/hisOwnProfile.test.tsx`) needed to hold a sample of the answer to the
 * very same names.
 *
 * @param record the record's simple name, which is looked for as `record <name>(`
 * @returns its components, sorted, or nothing for a name the file does not declare
 */
export function componentsOf(record: string): string[] {
  const source = readFileSync(
    join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web', 'MeApi.java'),
    'utf-8',
  )
  const opens = source.indexOf(`record ${record}(`)

  if (opens === -1) {
    return []
  }

  let depth = 0
  let closes = opens

  for (let at = opens + `record ${record}`.length; at < source.length; at += 1) {
    if (source[at] === '(') {
      depth += 1
    } else if (source[at] === ')') {
      depth -= 1

      if (depth === 0) {
        closes = at
        break
      }
    }
  }

  return source
    .slice(opens + `record ${record}(`.length, closes)
    .replace(/@\w+\([^)]*\)/g, ' ')
    .split(',')
    .map((one) => one.trim().split(/\s+/).slice(-1)[0] ?? '')
    .filter((one) => one !== '')
    .sort()
}
