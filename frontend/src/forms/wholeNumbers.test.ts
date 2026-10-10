import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { must } from '../test/at'
import { formDef } from './definitions'

/**
 * A NUMBER THE SERVER KEEPS WHOLE IS A NUMBER THE FORM WILL NOT TAKE A SEPARATOR IN, AND THE
 * TWO ARE HELD TOGETHER HERE.
 *
 * <p><b>Why the form says it at all.</b> Owner, 02.10.2026: „Polje za broj prima i zarez i
 * tacku, a portal salje tacku." Once a number box took a comma, „30,5" seconds no longer
 * stopped at „obavezno" and travelled to a route that reads an `Integer`, and „1.200" metres of
 * climb - twelve hundred, written with a separator for the thousands - was already quietly one
 * point two. So a field the server keeps whole says so in its definition (`types.ts`,
 * `integer`), and the form refuses a separator in it. That reasoning is the coordinator's, not
 * the owner's words.
 *
 * <p><b>The server decides and the definition copies</b>, the same arrangement
 * `passwordLength.test.ts` keeps for the length of a password: the type a route reads a field
 * into is read out of the Java source, and the definition is checked against it. So the pair
 * falls apart whichever side moves - a definition that drops `integer` fails, and a route that
 * starts keeping a decimal fails too.
 *
 * <p><b>The table below is written by hand, and it is the join between the two layers, so it
 * has a floor and it is measured on its own.</b> The floor: its rows are exactly the number
 * fields of the forms on disk, in both directions, so a seventeenth number field arrives here
 * as a red gate. The join: pointing one row at the wrong component - the climb at the length,
 * say - has to fail, and it does because the length is kept with decimals.
 */

const DEFINITIONS = join(process.cwd(), 'src', 'forms', 'definitions')
const MAIN = join(process.cwd(), '..', 'backend', 'src', 'main')
const WEB = join(MAIN, 'java', 'com', 'btl', 'portal', 'web')

/** Where a value lands on the server: a component of the record a route reads it into, or a
 *  column, where no route writes it at all. */
type Landing =
  | { file: string; record: string; component: string }
  | { file: string; table: string; column: string }

const RESULTS = join(WEB, 'ResultWriteApi.java')
const RACES = join(WEB, 'RaceWriteApi.java')
const DECISIONS = join(WEB, 'VerificationWriteApi.java')

/**
 * WHERE EVERY NUMBER FIELD OF EVERY FORM LANDS.
 *
 * <p>Hours, minutes and seconds land in ONE component, `seconds`, because the route takes their
 * sum: each box has to be whole for the sum to be whole by construction (0,01 of a minute is
 * six tenths of a second). A result is written by two routes, `POST /api/results` (`Ran`) and
 * `PUT /api/results/{id}` (`Correction`), and the form that asks for it reaches both. A member's
 * first season has no route that writes it, so it is held to its column.
 *
 * <p>And a third road since R1 of the results flows: a moderator approving a run at figures of his
 * own (`POST /api/verification/{id}/decision`, `Amended`) is handed the very boxes the member's
 * form on a race of that kind asks (`pages/admin/amendFields.ts`, through
 * `pages/event/reportForm.ts`), which are the three measurements of `unos-rezultata` and the time
 * of `prijava-sa-trke`. So those six land in `Amended` as well, and a figure kept whole on one road
 * and with decimals on the other fails here.
 */
const LANDS_IN: Record<string, Landing[]> = {
  'admin-cena.eur': [{ file: join(WEB, 'PricingWriteApi.java'), record: 'TheForm', component: 'eur' }],
  'admin-cena.rsd': [{ file: join(WEB, 'PricingWriteApi.java'), record: 'TheForm', component: 'rsd' }],
  'admin-clan.firstSeason': [
    {
      file: join(MAIN, 'resources', 'db', 'migration', 'V7__competitor_event_race_result.sql'),
      table: 'competitor',
      column: 'first_season',
    },
  ],
  'admin-liga.season': [{ file: join(WEB, 'LeagueWriteApi.java'), record: 'Upsert', component: 'season' }],
  'admin-trka.distanceKm': [{ file: RACES, record: 'Upsert', component: 'distanceKm' }],
  'admin-trka.ascentM': [{ file: RACES, record: 'Upsert', component: 'ascentM' }],
  'admin-trka.descentM': [{ file: RACES, record: 'Upsert', component: 'descentM' }],
  'prijava-sa-trke.hours': [
    { file: RESULTS, record: 'Ran', component: 'seconds' },
    { file: DECISIONS, record: 'Amended', component: 'seconds' },
  ],
  'prijava-sa-trke.minutes': [
    { file: RESULTS, record: 'Ran', component: 'seconds' },
    { file: DECISIONS, record: 'Amended', component: 'seconds' },
  ],
  'prijava-sa-trke.seconds': [
    { file: RESULTS, record: 'Ran', component: 'seconds' },
    { file: DECISIONS, record: 'Amended', component: 'seconds' },
  ],
  'unos-rezultata.distanceKm': [
    { file: RESULTS, record: 'Ran', component: 'distanceKm' },
    { file: RESULTS, record: 'Correction', component: 'distanceKm' },
    { file: DECISIONS, record: 'Amended', component: 'distanceKm' },
  ],
  'unos-rezultata.ascentM': [
    { file: RESULTS, record: 'Ran', component: 'ascentM' },
    { file: RESULTS, record: 'Correction', component: 'ascentM' },
    { file: DECISIONS, record: 'Amended', component: 'ascentM' },
  ],
  'unos-rezultata.descentM': [
    { file: RESULTS, record: 'Ran', component: 'descentM' },
    { file: RESULTS, record: 'Correction', component: 'descentM' },
    { file: DECISIONS, record: 'Amended', component: 'descentM' },
  ],
  'unos-rezultata.hours': [
    { file: RESULTS, record: 'Ran', component: 'seconds' },
    { file: RESULTS, record: 'Correction', component: 'seconds' },
  ],
  'unos-rezultata.minutes': [
    { file: RESULTS, record: 'Ran', component: 'seconds' },
    { file: RESULTS, record: 'Correction', component: 'seconds' },
  ],
  'unos-rezultata.seconds': [
    { file: RESULTS, record: 'Ran', component: 'seconds' },
    { file: RESULTS, record: 'Correction', component: 'seconds' },
  ],
}

/** The types a whole number is kept as, on either side of the server. */
const WHOLE = ['Integer', 'int', 'Long', 'long', 'integer', 'bigint', 'smallint']

/** And the ones a number with decimals is kept as. Anything else is a row pointing at
 *  something that is not a number at all, which is a mistake in the table. */
const DECIMAL = ['BigDecimal', 'numeric']

/** Every number field of every form on disk, as `form.field`, read off the files. */
function numberFieldsOnDisk(): Map<string, boolean> {
  const found = new Map<string, boolean>()

  for (const name of readdirSync(DEFINITIONS).filter((one) => one.endsWith('.form.json'))) {
    const form = formDef(JSON.parse(readFileSync(join(DEFINITIONS, name), 'utf-8')))

    for (const field of form.fields.filter((one) => one.type === 'number')) {
      found.set(`${form.id}.${field.name}`, field.integer === true)
    }
  }

  return found
}

/** The declared type of one component of a Java record, read off the declaration itself. */
function componentType(source: string, record: string, component: string): string {
  const start = must(
    new RegExp(`\\brecord\\s+${record}\\s*\\(`).exec(source),
    `record ${record} is not declared`,
  )
  let depth = 0
  let end = start.index + start[0].length

  /* To the parenthesis that closes the list, counting the ones opened inside it. */
  for (; end < source.length; end += 1) {
    const at = source[end]

    if (at === '(') {
      depth += 1
    } else if (at === ')') {
      if (depth === 0) {
        break
      }

      depth -= 1
    }
  }

  const components = source
    .slice(start.index + start[0].length, end)
    .split(',')
    .map((one) => one.trim().split(/\s+/))

  return must(
    components.find((words) => words.at(-1) === component)?.at(-2),
    `record ${record} has no component ${component}`,
  )
}

/** The declared type of one column, read off the `create table` that declares it. */
function columnType(source: string, table: string, column: string): string {
  const declared = must(
    new RegExp(`create table ${table}\\s*\\(([\\s\\S]*?)\\n\\);`).exec(source),
    `table ${table} is not created here`,
  )[1]

  return must(
    new RegExp(`^\\s*${column}\\s+([a-z]+)`, 'm').exec(must(declared, 'its columns'))?.[1],
    `table ${table} has no column ${column}`,
  )
}

function typeAt(landing: Landing): string {
  const source = readFileSync(landing.file, 'utf-8')

  return 'record' in landing
    ? componentType(source, landing.record, landing.component)
    : columnType(source, landing.table, landing.column)
}

describe('a number the server keeps whole', () => {
  it('is said for every number field on disk and for nothing else', () => {
    expect(Object.keys(LANDS_IN).sort()).toEqual([...numberFieldsOnDisk().keys()].sort())
  })

  it.each(Object.entries(LANDS_IN))('is whole in %s exactly where the server keeps it whole', (name, landings) => {
    const whole = must(numberFieldsOnDisk().get(name), `no number field ${name} on disk`)

    for (const landing of landings) {
      const type = typeAt(landing)

      expect([...WHOLE, ...DECIMAL], `${name} lands in ${type}, which is not a number`).toContain(type)
      expect(whole, `${name} is ${whole ? '' : 'not '}whole on the form and lands in ${type}`).toBe(
        WHOLE.includes(type),
      )
    }
  })
})
