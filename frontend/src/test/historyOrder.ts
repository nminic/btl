import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * THE ORDER OF MEMBERS WITHOUT POINTS IN THE SEASON SHOWN, worked out here from the served file and
 * not from `derive.ts` (PDL, 12.11.2026: the points of all their history, descending, then the
 * member number). A case that asked the code for the order it is checking would be satisfied by any
 * order the code produced. The sum is kept in whole hundredths, as `plusHundredths` keeps it.
 */
export function inHistoryOrder(memberNumbers: string[]): string[] {
  const rows: { memberNumber: string; points: number }[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/test/mock/results.json'), 'utf-8'),
  )
  const hundredths = new Map<string, number>()

  for (const row of rows) {
    hundredths.set(row.memberNumber, (hundredths.get(row.memberNumber) ?? 0) + Math.round(row.points * 100))
  }

  const of = (memberNumber: string) => hundredths.get(memberNumber) ?? 0

  return [...memberNumbers].sort((left, right) => of(right) - of(left) || left.localeCompare(right))
}
