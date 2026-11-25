import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configure, getConfig, screen } from '@testing-library/react'
import type { BtlEvent, ShownText } from '../../data/types'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'

/**
 * THE DESCRIPTION OF AN EVENT, AS ITS READER IS SHOWN IT (owner, PDL P18, 25.11.2026, „Automatski prevod sadržaja
 * koji posetilac vidi”): what the server says that reader is shown (`descriptionShown`), marked with the language it
 * is really in, and said to be the machine's where it is.
 *
 * <p><b>Its own server in front, answering the two languages differently</b>, for the reason `test/setup.ts` gives:
 * the served file is one answer whatever was asked, so a case that reads it cannot tell a translation from a
 * fallback. The answer with no language carries the original only, so a page that asked in no language draws the
 * original and the cases about the translation fail.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, the shape of `pages/admin/saveWhileSaving.test.tsx`
   and for its reason (CLAUDE.md, section 25): a description that is never drawn fails on the wait that looked for it,
   and not on the clock of the case, which would read as nothing measured. */
configure({ asyncUtilTimeout: SLOW / 2 })

const EVENT = 'maraton-maratona-2015'
const WRITTEN = 'Kroz grad i nazad, uz reku.'

const mock = (name: string) => JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock', `${name}.json`), 'utf-8'))

/** The events, with this one described, and what each language is shown of it. */
function serving(shown: Record<string, ShownText>, real: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const asked = /^\/api\/events(?:\?lang=([a-z]+))?$/.exec(String(input))

    if (asked === null || (init?.method ?? 'GET') !== 'GET') {
      return real(input, init)
    }

    const language = asked[1]
    const events: BtlEvent[] = mock('events')

    return new Response(
      JSON.stringify(
        events.map((one) =>
          one.slug !== EVENT
            ? one
            : {
                ...one,
                description: WRITTEN,
                ...(language === undefined ? {} : { descriptionShown: must(shown[language], 'a language asked') }),
              },
        ),
      ),
      { status: 200 },
    )
  }
}

describe('the description of an event', () => {
  const real = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = real
  })

  it('waits for half of the time a case has, so a wait that fails is a failure and not the clock', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })

  it("is the machine's English on /en, marked as English and as the machine's", async () => {
    globalThis.fetch = serving(
      {
        en: { text: 'Through the town and back, along the river.', language: 'en', machine: true },
        sr: { text: WRITTEN, language: 'sr', machine: false },
      },
      real,
    )
    renderAt(`/en/kalendar/${EVENT}`, 'visitor', null)

    const words = await screen.findByText('Through the town and back, along the river.')

    expect(words.closest('[lang]')).toHaveAttribute('lang', 'en')
    expect(screen.getByText('Automatic translation')).toBeVisible()
    expect(screen.queryByText(WRITTEN)).toBeNull()
  }, SLOW)

  it('is the words as written on /sr, marked as Serbian, with nothing said beside them', async () => {
    globalThis.fetch = serving(
      {
        en: { text: 'Through the town and back, along the river.', language: 'en', machine: true },
        sr: { text: WRITTEN, language: 'sr', machine: false },
      },
      real,
    )
    renderAt(`/sr/kalendar/${EVENT}`, 'visitor', null)

    const words = await screen.findByText(WRITTEN)

    expect(words.closest('.markdown')).toHaveAttribute('lang', 'sr')
    expect(screen.queryByText('Automatski prevod')).toBeNull()
    expect(screen.queryByText('Automatic translation')).toBeNull()
  }, SLOW)

  it('is Serbian on /en where there is no translation yet, and marked as Serbian', async () => {
    globalThis.fetch = serving(
      {
        en: { text: WRITTEN, language: 'sr', machine: false },
        sr: { text: WRITTEN, language: 'sr', machine: false },
      },
      real,
    )
    renderAt(`/en/kalendar/${EVENT}`, 'visitor', null)

    const words = await screen.findByText(WRITTEN)

    expect(words.closest('.markdown')).toHaveAttribute('lang', 'sr')
    expect(screen.queryByText('Automatic translation')).toBeNull()
  }, SLOW)

  it('carries no language of its own where nobody knows yet what it is written in', async () => {
    globalThis.fetch = serving(
      {
        en: { text: WRITTEN, language: null, machine: false },
        sr: { text: WRITTEN, language: null, machine: false },
      },
      real,
    )
    renderAt(`/en/kalendar/${EVENT}`, 'visitor', null)

    const words = await screen.findByText(WRITTEN)

    expect(words.closest('.markdown')).not.toHaveAttribute('lang')
  }, SLOW)
})
