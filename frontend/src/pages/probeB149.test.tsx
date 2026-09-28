import { screen, act } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { appendFileSync } from 'node:fs'
import { renderAt } from '../test/render'
import { serverThat, type Asked } from '../test/serverAnswers'

const OUT = 'C:/Users/nmini/AppData/Local/Temp/claude/C--Users-nmini-OneDrive-Desktop-Claude-Playground-btl/e92dc0db-99c7-49a6-852a-9b959452182d/scratchpad/probe-out.txt'
function say(a: string, b?: string) { appendFileSync(OUT, a + ' ' + (b ?? '') + String.fromCharCode(10)) }

/* PROBE ONLY - measures today's behaviour on an English address. Deleted before any commit. */

let stop: (() => void) | null = null

afterEach(() => {
  stop?.()
  stop = null
})

const SERBIAN = [
  {
    slug: 'uslovi-koriscenja',
    title: 'Uslovi korišćenja',
    sections: [{ heading: 'Srpski naslov sekcije', body: 'Srpsko telo sekcije.', gallery: null }],
  },
]

const ENGLISH = [
  {
    slug: 'uslovi-koriscenja',
    title: 'Terms of use',
    sections: [{ heading: 'English section heading', body: 'English section body.', gallery: null }],
  },
]

function aServerThatKnowsBothLanguages(): Asked[] {
  const it = serverThat((path) => {
    if (!path.startsWith('/api/pages')) {
      return null
    }

    const english = path.includes('lang=en')

    return new Response(JSON.stringify(english ? ENGLISH : SERBIAN), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })

  stop = it.stop

  return it.asked
}

test('PROBE 1: what is asked for, and what is drawn, at an English address', async () => {
  const asked = aServerThatKnowsBothLanguages()

  renderAt('/en/uslovi-koriscenja')

  const heading = await screen.findByRole('heading', { level: 1 })

  say('PROBE1 asked for pages:', JSON.stringify(asked.filter((one) => one.path.includes('pages')).map((one) => one.path)))
  say('PROBE1 heading drawn:', JSON.stringify(heading.textContent))
  say('PROBE1 html lang attribute:', JSON.stringify(document.documentElement.lang))

  expect(heading).toBeInTheDocument()
})

test('PROBE 2: switching language in place, on a mounted screen', async () => {
  const asked = aServerThatKnowsBothLanguages()

  const { router } = renderAt('/sr/uslovi-koriscenja')

  const first = await screen.findByRole('heading', { level: 1 })
  say('PROBE2 before switch:', JSON.stringify(first.textContent))

  await act(async () => {
    await router.navigate('/en/uslovi-koriscenja')
  })

  const after = await screen.findByRole('heading', { level: 1 })
  say('PROBE2 after switch:', JSON.stringify(after.textContent))
  say('PROBE2 asked for pages:', JSON.stringify(asked.filter((one) => one.path.includes('pages')).map((one) => one.path)))
  say('PROBE2 html lang attribute:', JSON.stringify(document.documentElement.lang))

  expect(after).toBeInTheDocument()
})
