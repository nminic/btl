import type { BtlEvent, Competitor } from '../../data/types'

/* "Red za proveru" was one queue for results. It is now one story, because a
 * moderator approves a great deal more than results, and every one of these
 * comes from a decision that was already written down (PDL P28a).
 *
 * `path` is set only where the screen exists. The rest are here so the work is
 * visible and countable before the database can feed them; a queue nobody
 * listed is a queue nobody builds. */
export type Queue = {
  id: string
  labelKey: string
  sourceKey: string
  path?: string
}

export const QUEUES: Queue[] = [
  {
    id: 'results',
    labelKey: 'verification.results',
    sourceKey: 'verification.fromResults',
    path: 'administracija/verifikacija/rezultati',
  },
  { id: 'payments', labelKey: 'verification.payments', sourceKey: 'verification.fromPayments' },
  { id: 'leagues', labelKey: 'verification.leagues', sourceKey: 'verification.fromLeagues' },
  { id: 'teams', labelKey: 'verification.teams', sourceKey: 'verification.fromTeams' },
  { id: 'bios', labelKey: 'verification.bios', sourceKey: 'verification.fromBios' },
  { id: 'photos', labelKey: 'verification.photos', sourceKey: 'verification.fromPhotos' },
  { id: 'comments', labelKey: 'verification.comments', sourceKey: 'verification.fromComments' },
  { id: 'schedule', labelKey: 'verification.schedule', sourceKey: 'verification.fromSchedule' },
]

/** What each queue holds today. Three of them can already be counted from the
 *  data the prototype has; the rest wait for tables that do not exist yet. */
export function countsFor(
  pendingResults: number,
  competitors: Competitor[],
  events: BtlEvent[],
): Record<string, number> {
  return {
    results: pendingResults,
    payments: competitors.filter((one) => !one.active).length,
    schedule: events.filter((one) => one.status === 'checking').length,
    leagues: 0,
    teams: 0,
    bios: 0,
    photos: 0,
    comments: 0,
  }
}
