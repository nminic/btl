import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recordKey } from '../../session/context'
import { RESOURCE_NAMES, type ResourceName } from '../../data/client'
import {
  ENTITY_FORMS,
  EVENTS,
  LEAGUES,
  MEMBERS,
  MODERATORS,
  numbersItsRecords,
  PAGES,
  PRICING,
  RACES,
  recordsOf,
  TEAMS,
  type EntityDef,
} from './entityForms'

/**
 * WHOSE NUMBER IS IT, when two families of record carry the same one.
 *
 * Every record this portal serves under the name `id` is identified by a
 * `bigserial` since 20.09.2026, and a `bigserial` is only unique inside its own
 * table: event 1116 and race 1116 are two different things answering to one
 * number, and so are team 1 and league 1. Until that day the generator wrote
 * `evt-…` on an event and `evt-…-1000` on a race, so one flat overlay of changes
 * could be keyed by the identity alone.
 *
 * **Measured on the administration's own screen before this was written.** Saving
 * an event writes every one of its races back (`AdminEvents`, `alsoSave`), a race
 * that was never renamed carries its event's name, and the change filed under the
 * race's number reached the EVENT of that number as well: two events read „Provera
 * unosa", one of them in the wrong town and carrying `event.kind.length`, which is
 * the kind of a race.
 */

type Named = { id: number; name: string }

const wrote = (under: string, id: number, values: Record<string, string>) => ({
  edits: { [recordKey(under, id)]: values },
  creations: {},
  deletions: {},
})

describe('a change filed under one family of record', () => {
  it('reaches the record of that family which carries the number', () => {
    /* The half that must go on working, written first: without it the case below
       passes on an overlay that reaches nothing at all. */
    const events: Named[] = [{ id: 1116, name: 'Fruškogorski maraton' }]

    expect(
      recordsOf(EVENTS, events, wrote(EVENTS.id, 1116, { name: 'Provera unosa' })),
    ).toEqual([{ id: 1116, name: 'Provera unosa' }])
  })

  it('reaches no record of another family carrying the same number', () => {
    /* The fault itself, from the side it was found on: the change belongs to the
       race and the event must not take it. */
    const events: Named[] = [{ id: 1116, name: 'Fruškogorski maraton' }]

    expect(recordsOf(EVENTS, events, wrote(RACES.id, 1116, { name: 'Provera unosa' }))).toEqual(
      events,
    )
  })

  it('reaches no record of another family whichever way round the two stand', () => {
    /* And from the other side, because the two halves are not one case: written
       to read the family off the record rather than off the key, the first of
       these passes and this one does not. */
    const races: Named[] = [{ id: 1116, name: 'Polumaraton' }]

    expect(recordsOf(RACES, races, wrote(EVENTS.id, 1116, { name: 'Provera unosa' }))).toEqual(
      races,
    )
  })

  it('tells a team from a league, which carry the smallest numbers of all', () => {
    /* One and one. Whatever an event and a race do, these two are the pair a
       reader meets first: the administration lists four teams and three
       competitions, and both are numbered from one. */
    const teams: Named[] = [{ id: 1, name: 'Dunavski trkači' }]

    expect(recordsOf(TEAMS, teams, wrote(LEAGUES.id, 1, { name: 'Provera unosa' }))).toEqual(teams)
    expect(recordsOf(TEAMS, teams, wrote(TEAMS.id, 1, { name: 'Provera unosa' }))).toEqual([
      { id: 1, name: 'Provera unosa' },
    ])
  })
})

/** Which file the portal serves the records of an entity as, or nothing where it
 *  serves none. Walked below, so an entity added without a line here fails rather
 *  than going unmeasured. */
const SERVED_AS: [EntityDef, ResourceName | null][] = [
  [MEMBERS, 'competitors'],
  [EVENTS, 'events'],
  [RACES, 'races'],
  [TEAMS, 'teams'],
  [LEAGUES, 'leagues'],
  [PAGES, 'pages'],
  [MODERATORS, 'moderators'],
  /* The price list is the one entity nothing serves: its rows are the four windows
     of the year and they live in `data/pricing.ts`. `fixed` says the same thing
     from the other side - nothing is added to it and nothing removed. */
  [PRICING, null],
]

describe('the entities whose records are numbered', () => {
  it('is every one of them and nothing else, held against the files they are served as', () => {
    /* `numbersItsRecords` reads the NAME of the identity, which is the schema's own
       shape rather than a coincidence: everything the backend files under `id` is a
       `bigserial` it hands out, and everything with a natural key is named for that
       key instead. This is the floor under that sentence: what the portal actually
       serves. */
    for (const [entity, served] of SERVED_AS) {
      if (served === null) {
        expect(RESOURCE_NAMES.some((name) => name === entity.id), entity.id).toBe(false)
        continue
      }

      const file = readFileSync(join(process.cwd(), 'public', 'mock', `${served}.json`), 'utf8')
      const rows: unknown = JSON.parse(file)

      if (!Array.isArray(rows)) {
        throw new Error(`${served}.json is not a list`)
      }

      const row: unknown = rows[0]

      if (row === null || typeof row !== 'object') {
        throw new Error(`${served}.json has no first row`)
      }

      const identity: unknown = Reflect.get(row, entity.idField)

      expect(typeof identity === 'number', `${entity.id} under ${entity.idField}`).toBe(
        numbersItsRecords(entity),
      )
    }
  })

  it('reads every entity the portal has, plus the races, which have no screen of their own', () => {
    /* Without this the walk above passes on a list somebody shortened. The races
       are not on `ENTITY_FORMS` since 06.08.2026 - they are entered under their
       event - and they are the very pair this whole file is about. */
    expect(SERVED_AS.map(([entity]) => entity.id).sort()).toEqual(
      [...ENTITY_FORMS.map((entity) => entity.id), RACES.id].sort(),
    )
  })
})
