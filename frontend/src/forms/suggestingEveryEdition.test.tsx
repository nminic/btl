import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ClockProvider } from '../clock/ClockProvider'
import type { BtlEvent } from '../data/types'
import { I18nProvider } from '../i18n/I18nProvider'
import { everyEventToOffer } from '../pages/member/eventsToOffer'
import { setupUser } from '../test/user'
import { Suggesting } from './Suggesting'
import type { Suggestion } from './types'

/**
 * A NAME TYPED OUT WHOLE OFFERS EVERY ENTRY OF THAT NAME, AND A NAME TYPED IN PART THE NEWEST EIGHT (owner,
 * 22.10.2026, PDL „Predlozi događaja pri upisu rezultata: ime pa godina”: „Kad otkucano ime ima više izdanja,
 * nudi se spisak SVIH godina tog imena i moderator bira godinu; nijedno izdanje nije nedostižno”, and refused:
 * „sva izdanja u jednom spisku bez granice od 8”). Review of PR 621, measured on the files: „Beogradski
 * maraton” has more editions than eight, and the older ones could not be chosen.
 *
 * <p>Asked of the files the portal is served, through the list the moderator's screen builds, and of lists
 * made here where the count of entries named exactly is on either side of eight and other names begin the
 * same, so the eight a partial name keeps and the entries an exact name adds are each a different answer.
 */

const EVENTS: BtlEvent[] = JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock/events.json'), 'utf-8'))

/** A day after every event of the files, so each edition has begun and is offered. */
const LATE = '2099-12-31'

function TheBox({ list }: { list: readonly Suggestion[] }) {
  const [value, setValue] = useState('')

  return (
    <Suggesting
      shared={{ id: 'box', 'aria-label': 'Događaj' }}
      value={value}
      suggestions={list}
      onType={setValue}
      onChoose={(one) => setValue(one.value)}
    />
  )
}

function stand(list: readonly Suggestion[]) {
  render(
    <ClockProvider>
      <I18nProvider locale="sr">
        <TheBox list={list} />
      </I18nProvider>
    </ClockProvider>,
  )
}

const offered = (): string[] => screen.queryAllByRole('button').map((one) => one.textContent ?? '')

const entry = (id: string, value: string): Suggestion => ({ id, value, said: `${value} ${id}`, fills: {} })

describe('the entries a box offers for a name', () => {
  it('offers every edition of a name typed out whole, in any case, newest first, and eight for a part of it', async () => {
    const list = everyEventToOffer(EVENTS, LATE)
    const editions = list.filter((one) => one.value === 'Beogradski maraton')

    expect(editions.length, 'the files hold more editions of the name than eight').toBeGreaterThan(8)

    const user = setupUser()

    stand(list)
    await user.type(screen.getByLabelText('Događaj'), 'beogradski MARATON')

    expect(offered()).toEqual(editions.map((one) => one.said))

    await user.clear(screen.getByLabelText('Događaj'))
    await user.type(screen.getByLabelText('Događaj'), 'Beogradski')

    expect(offered()).toHaveLength(8)
  })

  it('fills what is left of the eight with the names that only begin with it, in the order handed in', async () => {
    const list = [
      entry('a', 'Trka oko jezera'),
      entry('b', 'Trka'),
      entry('c', 'Trka kroz šumu'),
      entry('d', 'Trka'),
      ...['e', 'f', 'g', 'h', 'i', 'j'].map((id) => entry(id, `Trka ${id}`)),
      entry('k', 'Trka'),
    ]
    const user = setupUser()

    stand(list)
    await user.type(screen.getByLabelText('Događaj'), 'Trka')

    expect(offered()).toEqual(['Trka oko jezera a', 'Trka b', 'Trka kroz šumu c', 'Trka d', 'Trka e e', 'Trka f f', 'Trka g g', 'Trka k'])
  })

  it('offers only the entries named exactly when there are more of them than eight', async () => {
    const named = Array.from({ length: 10 }, (_, at) => entry(String(at), 'Trka'))
    const user = setupUser()

    stand([entry('x', 'Trka pre svih'), ...named])
    await user.type(screen.getByLabelText('Događaj'), 'Trka')

    expect(offered()).toEqual(named.map((one) => one.said))
  })
})
