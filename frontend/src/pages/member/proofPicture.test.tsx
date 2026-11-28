import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { BtlEvent, Race } from '../../data/types'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { must } from '../../test/at'
import { SLOW } from '../../test/slow'
import { did, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { thePictureTheFormHolds, withItsPicture } from './resultWrites'

/**
 * THE PICTURE SENT AS PROOF LEAVES THE BROWSER, ON EVERY ROAD A RUN IS SENT BY.
 *
 * <p>The owner, 28.11.2026: „Odradi i sliku kao dokaz uz rezultat", which carries out his choice of
 * 28.09.2026, „polje šalje bajtove, server ih prima i čuva", on „svim slanjima rezultata" (03.10.2026) and „na
 * obe forme" (22.08.2026): the event's page, and the member's own form, for a run away from the calendar and for
 * the correction of a counted one. Until this the box held the file's NAME and no bytes ever left.
 *
 * <p><b>Two sources of one value, kept apart:</b> the file is named differently from anything the form
 * writes, and its content is a word no other value carries, so a body that held the name, or a file of the
 * wrong box, is told apart from the one the member chose.
 */

/* EVERY WAIT HAS HALF THE CASE'S CLOCK (`saveWhileSaving.test.tsx`'s arrangement, CLAUDE.md section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

const ME = '000007'

const HIS = '000001'

const SOON = { timeout: 4_000 }

const allRaces: Race[] = JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock/races.json'), 'utf-8'))
const allEvents: BtlEvent[] = JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock/events.json'), 'utf-8'))

let server: { asked: Asked[]; stop: () => void } | null = null

afterEach(() => {
  server?.stop()
  server = null
})

function listening(answering: () => Response = did) {
  server = serverThat((path, init) =>
    path.startsWith('/api/results') && init?.method !== undefined ? answering() : null,
  )
}

function writes(): Asked[] {
  return (server?.asked ?? []).filter((one) => one.path.startsWith('/api/results') && one.init?.method !== undefined)
}

/** The picture a case chooses: its name is no word of the form, its bytes no word of the run. */
function aPictureOfTheWatch(): File {
  return new File(['sat-pokazuje-tri-sata'], 'snimak-sata.png', { type: 'image/png' })
}

/** The file a body carries as its part `picture`, and a failure where it carries none. */
function theFileIn(body: FormData): File {
  const picture = body.get('picture')

  if (!(picture instanceof File)) {
    throw new Error('the body carries no file as its picture')
  }

  return picture
}

/** What a request with a picture carried: the run as JSON, and the file. */
function partsOf(one: Asked): { run: Record<string, unknown>; picture: File } {
  const body = one.init?.body

  if (!(body instanceof FormData)) {
    throw new Error('the run went without its picture')
  }

  const run: unknown = JSON.parse(String(body.get('run')))

  return { run: typeof run === 'object' && run !== null ? { ...run } : {}, picture: theFileIn(body) }
}

/** An event with a race that has been run, and not the first race of the file. */
function reportable() {
  const race = must(
    allRaces.find(
      (one) =>
        one.id !== allRaces[0]?.id &&
        one.kind !== 'time' &&
        one.date <= '2026-08-23' &&
        (allEvents.find((held) => held.id === one.eventId)?.date ?? '9999') <= '2026-08-23',
    ),
    'a race that has been run',
  )

  return { race, event: must(allEvents.find((one) => one.id === race.eventId), 'its event') }
}

describe('the picture sent as proof', () => {
  it(
    'goes from the event page with its run, and a comment stands in for the link',
    async () => {
      const user = setupUser()
      const { race, event } = reportable()
      const picture = aPictureOfTheWatch()

      listening()
      renderAt(`/sr/kalendar/${event.slug}/prijava?trka=${String(race.id)}`, 'competitor', ME, undefined, '2026-08-23')

      await user.upload(await screen.findByLabelText(/^Slika kao dokaz/), picture)
      await user.type(screen.getByLabelText(/^Komentar/), 'Sat pokazuje 0:44:02')
      await user.type(screen.getByLabelText('Sati'), '0')
      await user.type(screen.getByLabelText('Minuti'), '44')
      await user.type(screen.getByLabelText('Sekunde'), '2')
      await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')
      const { run, picture: carried } = partsOf(sent)

      expect(sent.path).toBe('/api/results')
      expect(sent.init?.method).toBe('POST')
      expect(run.raceId).toBe(race.id)
      expect(run.link).toBe('')
      expect(run.comment).toBe('Sat pokazuje 0:44:02')
      expect(Object.hasOwn(run, 'photo'), 'the name of the file travelled inside the run').toBe(false)
      expect(carried.name).toBe('snimak-sata.png')
      expect(await carried.text()).toBe('sat-pokazuje-tri-sata')
    },
    SLOW,
  )

  it(
    'goes from the member’s own form with a run away from the calendar',
    async () => {
      const user = setupUser()

      listening()
      renderAt('/sr/rezultat/novi', 'competitor', ME, undefined, '2027-08-23')

      await user.type(await screen.findByLabelText(/^Događaj/), 'Trka kroz šumu')
      await user.type(screen.getByLabelText(/Datum trke/), '10052027')
      await user.type(screen.getByLabelText('Mesto'), 'Niš')
      await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
      await user.type(screen.getByLabelText(/Dužina/), '21.1')
      await user.type(screen.getByLabelText(/Uspon/), '540')
      await user.type(screen.getByLabelText(/Spust/), '540')
      await user.type(screen.getByLabelText('Sati'), '1')
      await user.type(screen.getByLabelText('Minuti'), '52')
      await user.type(screen.getByLabelText('Sekunde'), '10')
      await user.upload(screen.getByLabelText(/^Slika kao dokaz/), aPictureOfTheWatch())
      await user.type(screen.getByLabelText(/^Komentar/), 'Diploma sa trke')
      await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const { run, picture } = partsOf(must(writes()[0], 'the request'))

      expect(run.raceName).toBe('Trka kroz šumu')
      expect(run.comment).toBe('Diploma sa trke')
      expect(await picture.text()).toBe('sat-pokazuje-tri-sata')
    },
    SLOW,
  )

  it(
    'goes with the correction of a counted result, to the address of that result',
    async () => {
      const user = setupUser()

      listening()
      const { router } = renderAt('/sr/moji-rezultati', 'competitor', HIS, undefined, '2026-08-23')

      const table = within(await screen.findByRole('table', { name: 'Uračunato' }, SOON))
      const row = within(must(table.getAllByRole('row')[1], 'the first counted result'))

      await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
      await screen.findByText(/Menjaš rezultat koji je već uračunat/, undefined, SOON)

      const corrected = must(/^\?ispravka=(\d+)$/.exec(router.state.location.search)?.[1], 'the address names a result')

      await user.upload(screen.getByLabelText(/^Slika kao dokaz/), aPictureOfTheWatch())
      await user.type(screen.getByLabelText(/^Komentar/), 'Sat je stao')
      await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const sent = must(writes()[0], 'the request')
      const { run } = partsOf(sent)

      expect(sent.path).toBe(`/api/results/${corrected}`)
      expect(sent.init?.method).toBe('PUT')
      expect(run.comment).toBe('Sat je stao')
    },
    SLOW,
  )

  it(
    'does not go once the member has thrown it away, and the run goes as it always did',
    async () => {
      const user = setupUser()
      const { race, event } = reportable()

      listening()
      renderAt(`/sr/kalendar/${event.slug}/prijava?trka=${String(race.id)}`, 'competitor', ME, undefined, '2026-08-23')

      await user.upload(await screen.findByLabelText(/^Slika kao dokaz/), aPictureOfTheWatch())
      await user.click(screen.getByRole('button', { name: /Obriši/ }))
      await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
      await user.type(screen.getByLabelText('Sati'), '0')
      await user.type(screen.getByLabelText('Minuti'), '44')
      await user.type(screen.getByLabelText('Sekunde'), '2')
      await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

      await waitFor(() => {
        expect(writes()).toHaveLength(1)
      }, SOON)

      const body = must(writes()[0], 'the request').init?.body

      expect(body).not.toBeInstanceOf(FormData)
      expect(JSON.parse(String(body))).toMatchObject({ raceId: race.id, link: 'https://primer.rs/rezultati' })
    },
    SLOW,
  )

  it(
    'is refused with a sentence of its own where the server says it is not a picture',
    async () => {
      const user = setupUser()
      const { race, event } = reportable()

      listening(() => refused('thisIsNotAPicture'))
      renderAt(`/sr/kalendar/${event.slug}/prijava?trka=${String(race.id)}`, 'competitor', ME, undefined, '2026-08-23')

      await user.upload(await screen.findByLabelText(/^Slika kao dokaz/), aPictureOfTheWatch())
      await user.type(screen.getByLabelText(/^Komentar/), 'Sat')
      await user.type(screen.getByLabelText('Sati'), '0')
      await user.type(screen.getByLabelText('Minuti'), '44')
      await user.type(screen.getByLabelText('Sekunde'), '2')
      await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

      expect(
        await screen.findByText('Ovaj fajl nije slika. Pošalji fotografiju, na primer u JPG ili PNG obliku.', undefined, SOON),
      ).toBeVisible()
    },
    SLOW,
  )
})

describe('the two halves of a body with a picture', () => {
  it('carries the run as JSON in its own part and the file in another', async () => {
    const sent = withItsPicture({ raceId: 7, link: '' }, aPictureOfTheWatch())

    expect(JSON.parse(String(sent.get('run')))).toEqual({ raceId: 7, link: '' })
    expect(await theFileIn(sent).text()).toBe('sat-pokazuje-tri-sata')
  })

  it('sends the file only while the box names one', () => {
    const file = aPictureOfTheWatch()

    expect(thePictureTheFormHolds({ photo: 'snimak-sata.png' }, file)).toBe(file)
    expect(thePictureTheFormHolds({ photo: '' }, file)).toBeNull()
    expect(thePictureTheFormHolds({ photo: '  ' }, file)).toBeNull()
    expect(thePictureTheFormHolds({}, file)).toBeNull()
    expect(thePictureTheFormHolds({ photo: 'snimak-sata.png' }, null)).toBeNull()
  })
})
