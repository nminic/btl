import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../test/render'
import {
  DICTIONARY_LOADERS,
  dictionaryFor,
  forgetTheDictionaries,
  loadDictionary,
  loadedDictionary,
  localeOfTheAddress,
  LOCALES,
  startTheFirstDictionary,
  type Locale,
} from './config'
import en from './en.json'
import sr from './sr.json'
import type { Dictionary } from './translate'

/**
 * ONLY THE BOOK OF THE LANGUAGE BEING READ IS LOADED (inkrement „Poboljšanje performansi”, owner,
 * 22.11.2026: „rečnik samo jezika koji se čita ide kao ZASEBAN POSAO”), and these are the cases about the
 * moment BEFORE a book arrives.
 *
 * <p>Every other case in the suite runs with both books already on the shelf (`test/setup.ts`), which is
 * exactly the state in which waiting and not waiting look the same. So each case here empties the shelf
 * first and holds the row of the language it is about back with `vi.spyOn`, and every case puts both books
 * back after itself.
 *
 * <p>The address is never the default language where the case is about which language is asked for: a
 * case that starts on `/sr` cannot tell „the language of the address" from „Serbian".
 */

type Answer = { default: Dictionary } | undefined

/** A book held back until the case lets it go, or lets it fail. */
function heldBack() {
  let arrive: (answer: Answer) => void = () => undefined
  let fail: (error: Error) => void = () => undefined
  const promise = new Promise<Answer>((resolve, reject) => {
    arrive = resolve
    fail = reject
  })

  return { promise, arrive, fail }
}

/** The shelf as a visit begins, with only the books named here put back on it. */
async function onlyOnTheShelf(...locales: Locale[]): Promise<void> {
  forgetTheDictionaries()
  await Promise.all(locales.map((one) => loadDictionary(one)))
}

afterEach(async () => {
  vi.restoreAllMocks()
  forgetTheDictionaries()
  await Promise.all(LOCALES.map((one) => loadDictionary(one)))
})

describe('the language a page is read in, from its address', () => {
  it('is the language the address starts with', () => {
    expect(localeOfTheAddress('/en/kalendar')).toBe('en')
    expect(localeOfTheAddress('/en')).toBe('en')
    expect(localeOfTheAddress('/sr/takmicar/000001')).toBe('sr')
  })

  it('is Serbian for every address that does not start with a language, the way the layout sends it on', () => {
    for (const address of ['/', '', '/kalendar', '/de/kalendar', '/EN/kalendar', '/english']) {
      expect(localeOfTheAddress(address), address).toBe('sr')
    }
  })
})

describe('the shelf of books', () => {
  it('asks for the book of the address being opened, and for no other', async () => {
    forgetTheDictionaries()
    const english = vi.spyOn(DICTIONARY_LOADERS, 'en')
    const serbian = vi.spyOn(DICTIONARY_LOADERS, 'sr')

    expect(await startTheFirstDictionary({ location: { pathname: '/en/kalendar' } })).toEqual(en)
    expect(english).toHaveBeenCalledTimes(1)
    expect(serbian).not.toHaveBeenCalled()
  })

  it('keeps each language its own book, whichever arrived last', async () => {
    await onlyOnTheShelf('sr')
    await loadDictionary('en')

    expect(dictionaryFor('sr')).toEqual(sr)
    expect(dictionaryFor('en')).toEqual(en)
    expect(dictionaryFor('sr')).not.toEqual(dictionaryFor('en'))
  })

  it('says a book has not arrived rather than handing out an empty one', () => {
    forgetTheDictionaries()

    expect(loadedDictionary('en')).toBeUndefined()
    expect(() => dictionaryFor('en')).toThrow('the dictionary for en has not arrived yet')
  })

  it('asks the server once for a book that two readers wait for', async () => {
    forgetTheDictionaries()
    const english = vi.spyOn(DICTIONARY_LOADERS, 'en')

    await Promise.all([loadDictionary('en'), loadDictionary('en')])
    await loadDictionary('en')

    expect(english).toHaveBeenCalledTimes(1)
  })

  it('asks again after a failure, so one dropped request does not lose the language for the visit', async () => {
    forgetTheDictionaries()
    const english = vi
      .spyOn(DICTIONARY_LOADERS, 'en')
      .mockRejectedValueOnce(new Error('the connection dropped'))

    await expect(loadDictionary('en')).rejects.toThrow('the connection dropped')
    expect(loadedDictionary('en')).toBeUndefined()

    expect(await loadDictionary('en')).toEqual(en)
    expect(english).toHaveBeenCalledTimes(2)
  })

  it('keeps nothing and waits when the piece is gone and the page is being read again', async () => {
    forgetTheDictionaries()
    vi.spyOn(DICTIONARY_LOADERS, 'en').mockResolvedValue(undefined)
    const settled = vi.fn()

    loadDictionary('en').then(settled, settled)
    await act(async () => {
      await new Promise((done) => setTimeout(done, 50))
    })

    expect(settled).not.toHaveBeenCalled()
    expect(loadedDictionary('en')).toBeUndefined()
  })
})

describe('the first page of a visit', () => {
  it('draws nothing at all until the book of its language arrives, and then the page in it', async () => {
    await onlyOnTheShelf('sr')
    const held = heldBack()
    vi.spyOn(DICTIONARY_LOADERS, 'en').mockReturnValue(held.promise)

    const { container } = renderAt('/en/kalendar')

    await waitFor(() => expect(DICTIONARY_LOADERS.en).toHaveBeenCalled())
    expect(container.textContent).toBe('')
    expect(screen.queryByRole('banner')).toBeNull()

    await act(async () => {
      held.arrive({ default: en })
      await held.promise
    })

    expect(await screen.findByRole('button', { name: 'Language, EN' })).toBeInTheDocument()
  })

  it('stays empty when the book does not arrive, rather than drawing keys or the other language', async () => {
    await onlyOnTheShelf('sr')
    vi.spyOn(DICTIONARY_LOADERS, 'en').mockRejectedValue(new Error('the connection dropped'))

    const { container } = renderAt('/en/kalendar')

    await waitFor(() => expect(DICTIONARY_LOADERS.en).toHaveBeenCalled())
    await act(async () => {
      await new Promise((done) => setTimeout(done, 50))
    })

    expect(container.textContent).toBe('')
    expect(loadedDictionary('en')).toBeUndefined()
  })
})

describe('a change of language during a visit', () => {
  it('keeps the screen it was pressed on until the book arrives, and then moves to the language whole', async () => {
    await onlyOnTheShelf('sr')
    const held = heldBack()
    vi.spyOn(DICTIONARY_LOADERS, 'en').mockReturnValue(held.promise)
    const user = userEvent.setup()
    const { router } = renderAt('/sr/kalendar')

    await user.click(await screen.findByRole('button', { name: 'Jezik, SR' }))
    await user.click(screen.getByRole('option', { name: 'English' }))

    expect(router.state.location.pathname).toBe('/sr/kalendar')
    expect(screen.getByRole('button', { name: 'Jezik, SR' })).toBeInTheDocument()

    await act(async () => {
      held.arrive({ default: en })
      await held.promise
    })

    expect(await screen.findByRole('button', { name: 'Language, EN' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/en/kalendar')
  })

  it('asks for the other book when the list opens, never for its own, and asks again on the press after a failure', async () => {
    await onlyOnTheShelf('sr')
    const english = vi
      .spyOn(DICTIONARY_LOADERS, 'en')
      .mockRejectedValueOnce(new Error('the connection dropped'))
    const serbian = vi.spyOn(DICTIONARY_LOADERS, 'sr')
    const user = userEvent.setup()
    const { router } = renderAt('/sr/kalendar')
    const button = await screen.findByRole('button', { name: 'Jezik, SR' })

    await user.click(button)
    await waitFor(() => expect(english).toHaveBeenCalledTimes(1))

    /* Closing the list asks for nothing. */
    await user.click(button)
    expect(english).toHaveBeenCalledTimes(1)

    await user.click(button)
    await user.click(screen.getByRole('option', { name: 'English' }))

    expect(await screen.findByRole('button', { name: 'Language, EN' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/en/kalendar')
    expect(english).toHaveBeenCalledTimes(2)
    expect(serbian).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Something broke' })).toBeNull()
  })

  it('says in the language still being read that the book did not arrive, in the place of the screen', async () => {
    await onlyOnTheShelf('sr')
    const held = heldBack()
    vi.spyOn(DICTIONARY_LOADERS, 'en').mockReturnValue(held.promise)
    const user = userEvent.setup()
    const { router } = renderAt('/sr/kalendar')

    await user.click(await screen.findByRole('button', { name: 'Jezik, SR' }))
    await user.click(screen.getByRole('option', { name: 'English' }))
    await act(async () => {
      held.fail(new Error('the connection dropped'))
      await held.promise.catch(() => undefined)
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Nešto je puklo' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Ovaj deo strane se nije učitao kako treba.')
    expect(router.state.location.pathname).toBe('/sr/kalendar')
    expect(screen.getByRole('button', { name: 'Jezik, SR' })).toBeInTheDocument()

    /* And only there: the next address is drawn as it always is. */
    await act(async () => {
      await router.navigate('/sr/tabela')
    })

    expect(screen.queryByRole('heading', { name: 'Nešto je puklo' })).toBeNull()
  })

  it('takes the reader nowhere when he has gone somewhere else before the book arrived', async () => {
    await onlyOnTheShelf('sr')
    const held = heldBack()
    vi.spyOn(DICTIONARY_LOADERS, 'en').mockReturnValue(held.promise)
    const user = userEvent.setup()
    const { router } = renderAt('/sr/kalendar')

    await user.click(await screen.findByRole('button', { name: 'Jezik, SR' }))
    await user.click(screen.getByRole('option', { name: 'English' }))
    await act(async () => {
      await router.navigate('/sr/tabela')
    })
    await act(async () => {
      held.arrive({ default: en })
      await held.promise
    })

    expect(router.state.location.pathname).toBe('/sr/tabela')
    expect(screen.getByRole('button', { name: 'Jezik, SR' })).toBeInTheDocument()
  })

  it('says nothing failed where the reader has gone on to, when the book he left behind does not arrive', async () => {
    await onlyOnTheShelf('sr')
    const held = heldBack()
    vi.spyOn(DICTIONARY_LOADERS, 'en').mockReturnValue(held.promise)
    const user = userEvent.setup()
    const { router } = renderAt('/sr/kalendar')

    await user.click(await screen.findByRole('button', { name: 'Jezik, SR' }))
    await user.click(screen.getByRole('option', { name: 'English' }))
    await act(async () => {
      await router.navigate('/sr/tabela')
    })
    await act(async () => {
      held.fail(new Error('the connection dropped'))
      await held.promise.catch(() => undefined)
    })

    expect(router.state.location.pathname).toBe('/sr/tabela')
    expect(screen.queryByRole('heading', { name: 'Nešto je puklo' })).toBeNull()
  })

  it('comes back to Serbian whole after English, both books on the shelf', async () => {
    const user = userEvent.setup()
    const { router } = renderAt('/sr/kalendar')

    await user.click(await screen.findByRole('button', { name: 'Jezik, SR' }))
    await user.click(screen.getByRole('option', { name: 'English' }))
    await user.click(await screen.findByRole('button', { name: 'Language, EN' }))
    await user.click(screen.getByRole('option', { name: 'Srpski' }))

    expect(await screen.findByRole('button', { name: 'Jezik, SR' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/sr/kalendar')
  })
})
