import { describe, expect, it } from 'vitest'
import { arrivedResource, clearResourceCache, loadResource } from './client'

/**
 * A NAME DROPPED WITH NO LANGUAGE IS DROPPED IN EVERY LANGUAGE, since 25.11.2026.
 *
 * <p>The page of an event reads `events` in the reader's language (`useEventsInTheReadersLanguage`, owner, PDL P18,
 * „Automatski prevod sadržaja koji posetilac vidi"), and the seven writes that drop `events` name no language. A drop
 * that reached only `/api/events` would leave `/api/events?lang=en` standing, and the page of an event would go on
 * drawing it as it was before the administration saved it.
 */
describe('a drop of a name', () => {
  it('with no language takes the answer of every language with it', async () => {
    await loadResource('events')
    await loadResource('events', 'en')
    await loadResource('events', 'sr')

    expect(arrivedResource('events', 'en')).toBeDefined()

    clearResourceCache('events')

    expect(arrivedResource('events')).toBeUndefined()
    expect(arrivedResource('events', 'en')).toBeUndefined()
    expect(arrivedResource('events', 'sr')).toBeUndefined()
  })

  it('in one language takes that language and leaves the others', async () => {
    await loadResource('events', 'en')
    await loadResource('events', 'sr')

    clearResourceCache('events', 'sr')

    expect(arrivedResource('events', 'sr')).toBeUndefined()
    expect(arrivedResource('events', 'en')).toBeDefined()
  })

  it('takes the answers of that name and of no other', async () => {
    await loadResource('events', 'en')
    await loadResource('pages', 'en')

    clearResourceCache('events')

    expect(arrivedResource('pages', 'en')).toBeDefined()
  })
})
