import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE LIFT OF A SLICE OF THE RING, ASKED OF CHROME WHILE IT MOVES (owner, 21.11.2026, PDL „Prsten radi
 * suptilno i bez seckanja").
 *
 * <p>The slices used to be dashed circles whose radius and width were animated together; while the radius
 * moved the dash did not, so slices overlapped or parted at the joins and the colour of a neighbour showed
 * through. The slices are true sectors now, and the chosen one lifts by its outer edge alone.
 *
 * <p>What is asked, on every frame of the movement and after it, by asking the browser itself whether a
 * point is inside a slice (`isPointInFill`) and not by reading the numbers the component computed:
 *
 * <ul>
 *   <li>the hole in the middle never changes: no slice contains a point nearer the centre than the inner
 *       edge, and every slice reaches it, chosen or not;</li>
 *   <li>no point of the ring is inside two slices at once, on any frame (an overlap is where one colour
 *       is drawn over another), and no point between the inner and the resting outer edge is inside none
 *       (a gap is where the track shows through);</li>
 *   <li>the chosen slice does grow, and the movement is seen: some frame lies strictly between resting
 *       and grown, so a build that jumped would be read as not measured and not as a pass.</li>
 * </ul>
 *
 * <p><b>Relations, never pixels</b>, as in `settings.geometry.ts`. The numbers 55 and 85 are the ring's own
 * (`CategoryDonut.tsx`), and what is held is that they are the same on every frame.
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers (`/api/results/runners` from `results/runners.json`). */
function everyAnswer(dir = MOCK, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(
    readdirSync(dir, { withFileTypes: true }).flatMap((entry): [string, unknown][] => {
      const at = join(dir, entry.name)

      if (entry.isDirectory()) {
        return Object.entries(everyAnswer(at, `${prefix}${entry.name}/`))
      }

      return entry.name.endsWith('.json')
        ? [[`/api/${prefix}${entry.name.slice(0, -'.json'.length)}`, JSON.parse(readFileSync(at, 'utf-8'))]]
        : []
    }),
  )
}

const ANSWERS: Answers = { ...everyAnswer(), '/api/frozen-seasons': [] }

/** A member with more than one length, so there are joins to look at. */
const PAGE = '/sr/takmicar/000002-relja-momcilovic?sezona=sve'

const WIDTHS: At[] = [
  { width: 360, text: 100, motion: 'no-preference' },
  { width: 1280, text: 100, motion: 'no-preference' },
]

type Frame = { holes: number; overlaps: number; gaps: number; reach: number }

for (const at of WIDTHS) {
  test(`a slice lifts outwards only and never overlaps or parts from its neighbours, ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, PAGE, '#profile-results', ANSWERS)

    const hits = page.locator('.donut__hit')

    expect(await hits.count(), 'a ring with joins to look at').toBeGreaterThan(1)

    /* The recorder is started before the pointer arrives and read after it has settled. Every frame asks the
       browser whether each point of a polar grid over the ring is inside which slice. */
    const recording = page.evaluate(
      () =>
        new Promise<Frame[]>((resolve) => {
          const slices = [...document.querySelectorAll<SVGGeometryElement>('.donut__seg')]
          const frames: Frame[] = []
          const begun = performance.now()

          const look = () => {
            let holes = 0
            let overlaps = 0
            let gaps = 0
            let reach = 0

            for (let degrees = 0; degrees < 360; degrees += 1) {
              const angle = ((degrees + 0.37) * Math.PI) / 180

              for (let radius = 20; radius <= 99; radius += 1) {
                const point = new DOMPoint(100 + radius * Math.cos(angle), 100 + radius * Math.sin(angle))
                const inside = slices.filter((one) => one.isPointInFill(point)).length

                if (radius < 55 && inside > 0) {
                  holes += 1
                }

                if (inside > 1) {
                  overlaps += 1
                }

                /* Between the inner edge and the resting outer edge every point belongs to a slice. The
                   grid skips the half degree either side of a join, where antialiasing owns the pixel. */
                if (radius > 55.5 && radius < 84.5 && inside === 0) {
                  gaps += 1
                }

                if (inside > 0) {
                  reach = Math.max(reach, radius)
                }
              }
            }

            frames.push({ holes, overlaps, gaps, reach })

            if (performance.now() - begun < 500) {
              requestAnimationFrame(look)
            } else {
              resolve(frames)
            }
          }

          requestAnimationFrame(look)
        }),
    )

    const box = await hits.first().boundingBox()

    if (box === null) {
      throw notMeasured('the first slice of the ring has no box')
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2 + 1)

    const frames = await recording

    expect(frames.length, 'the movement was watched').toBeGreaterThan(5)
    expect(frames.reduce((sum, one) => sum + one.holes, 0), 'a slice reached into the hole').toBe(0)
    expect(frames.reduce((sum, one) => sum + one.overlaps, 0), 'two slices at one point').toBe(0)
    expect(frames.reduce((sum, one) => sum + one.gaps, 0), 'a point of the ring that no slice holds').toBe(0)

    const reaches = frames.map((one) => one.reach)

    expect(Math.max(...reaches), 'the chosen slice grew').toBeGreaterThan(Math.min(...reaches) + 8)
    expect(
      reaches.some((one) => one > Math.min(...reaches) + 1 && one < Math.max(...reaches) - 1),
      'the lift was seen part of the way, not only before and after',
    ).toBe(true)
  })
}
