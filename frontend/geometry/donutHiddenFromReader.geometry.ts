import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { test } from './support/harness.ts'
import type { Answers } from './support/harness.ts'

/**
 * THE RING IS READ ONCE, AS CHROME'S OWN ACCESSIBILITY TREE HAS IT (ADL A7, 31.07.2026; review of PR 785,
 * 21.11.2026).
 *
 * <p>Chrome does not treat the children of an `img` as presentational, so a named drawing was read out in
 * full and then the table said the same thing again; the ring is therefore hidden from a reader as a whole
 * (`aria-hidden` on the `svg`), and the table beside it is the one place the numbers are read. jsdom reads
 * the attribute; this asks the browser what it makes of it: the ring's block holds no button and no image
 * in the tree Chrome builds, and holds the table.
 *
 * <p>The slices once carried `role="button"`, `tabindex` and a label with the count, and a build that
 * takes `aria-hidden` off the `svg` fails here and not only in jsdom.
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

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

test('the ring is hidden from a reader in Chrome and the table is the one reading', async ({ open }) => {
  const { page } = await open({ width: 1280, text: 100 }, '/sr/takmicar/000002-relja-momcilovic?sezona=sve', '#profile-results', ANSWERS)

  const block = page.locator('.donut-block')

  await expect(block, 'the ring is on the page').toHaveCount(1)

  const tree = await block.ariaSnapshot()

  expect(tree, 'the table is in the tree').toContain('table')
  expect(tree, 'a slice is read as a button').not.toContain('button')
  expect(tree, 'the drawing is read as a picture').not.toMatch(/\b(img|graphics-)/)
  expect(tree, 'a slice is read by its title').not.toContain('Kraća trka:')
})
