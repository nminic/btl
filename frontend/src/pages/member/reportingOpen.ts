import { whatTheServerSaysOfTheSeasonsOpenForAReport } from '../../session/theServer'
import { useHeldRead } from './useHeldRead'

/**
 * WHETHER A MEMBER MAY SEE THE WAY TO REPORT A RESULT AT ALL: only while the server names a season
 * open for his report.
 *
 * <p>PDL P9, owner, 24.11.2026, chosen among the outcomes offered, against my recommendation:
 * „Onemoguci clanovima prijave rezultata individualno do 1.1!", and of what exactly, „Sakrij i formu
 * članovima". Corrected the same day by the owner: „Marko treba da ostane jedini koji moze", so the
 * testers of 21.11.2026 keep the form. And chosen the same day between the outcomes offered: the
 * correction of a counted result („Izmeni", `?ispravka=`) stays as it was.
 *
 * <p><b>One condition, and it is the server's.</b> `GET /api/me` carries `seasonsOpenForAReport`
 * (`MeApi.WhoIAm`), worked out by `SeasonClock.seasonsOpenForAReport(now, tester)` on the server's
 * clock in the league's zone, with the tester asked of `ReportTesters`, the same list
 * `ResultWriteApi` refuses a run by. Before 1 January 2027 at 00:00 in Belgrade it is empty for every
 * member who is not a tester, and from then it always holds the year he is in, so the form comes back
 * by itself, with no deploy and no second clock or list on this side. An empty answer is exactly the
 * moment the server would refuse every run he could send (PDL P9, 19.10.2026, „Pre 2027 forma i
 * predlozi ne nude ništa, a server odbija svaku prijavu").
 */
export function aReportIsOpen(seasons: number[]): boolean {
  return seasons.length > 0
}

/**
 * Whether the links into the form are drawn: only once the server has answered, and only when it
 * named a season. A link is not offered while the answer is on its way or could not be read; the
 * screen it leads to says either of those itself (`WhileAReportIsOpen`).
 *
 * <p>Nobody is asked about when nobody is signed in: a visitor reads an event page too, and the
 * server would only answer him that nobody is there.
 *
 * @param asked whose the answer is, as `useSeasonsOpenForAReport` takes it, or nobody
 */
export function useAReportIsOpen(asked: number | string | null): boolean {
  const open = useHeldRead(
    asked === null ? nobodyIsAsked : whatTheServerSaysOfTheSeasonsOpenForAReport,
    asked ?? '',
    'The seasons open for a report could not be read',
  )

  return open.status === 'ready' && aReportIsOpen(open.data)
}

/** The read for nobody, one function for every render as `useHeldRead` asks. */
async function nobodyIsAsked(): Promise<number[] | null> {
  return null
}
