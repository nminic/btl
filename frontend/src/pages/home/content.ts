/* News and sponsors, for as long as there is no content model behind them.
 *
 * Both lists are empty, and that is the rule rather than an omission: the old
 * front page was showing a news item from May 2016 in November 2020, which
 * announced "abandoned" far louder than an empty space would have. A widget
 * with nothing fresh to say does not appear at all.
 */

export type NewsItem = {
  id: string
  date: string
  titleKey: string
  textKey: string
}

export type SponsorEntry = {
  id: string
  name: string
  url: string
}

/** Older than this and the news widget disappears. */
export const FRESH_DAYS = 60

export const NEWS: NewsItem[] = []

export const SPONSORS: SponsorEntry[] = []

export function freshNews(items: NewsItem[], today: string): NewsItem[] {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - FRESH_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10)

  return items
    .filter((item) => item.date >= cutoff)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 3)
}

/**
 * The counters carry the running season once it has results. Until then they
 * show the fullest season there is, and say so, rather than five zeros.
 */
export function seasonLabelKey(season: number, runningSeason: number): string {
  return season === runningSeason ? 'home.season' : 'home.seasonSample'
}
