import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Competitor } from '../../data/types'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, serverThat, type Asked } from '../../test/serverAnswers'
import { hisCategoryFromMe, myOwnRecordFromMe } from '../../test/theAnswer'
import { setupUser } from '../../test/user'
import sr from '../../i18n/sr.json'

/**
 * THE BOX FOR THE LEAGUE'S COMMUNITY ON VIBER ON „MOJI PODACI".
 *
 * <p>Owner, PDL P36, 20.11.2026: „Isti kvadratić stoji i na strani „Moji podaci”, pa se postojeći članovi sami
 * prijavljuju i odjavljuju." And from the same decision: „Kad je kvadratić štikliran, telefon je obavezan:
 * ispod telefona piše „Za Viber zajednicu upišite broj telefona.”". Personal data take effect at once (PDL
 * P28b, 1), so a tick is sent and kept, with nothing waiting for anybody.
 *
 * <p><b>The member is not the first of the file</b>, so a screen that drew the first row's wish would be told
 * apart; and the cases open the box both ticked and empty, so a screen that opened it the same way whatever the
 * server said would be too.
 */

const members: Competitor[] = JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'))

const ME = must(
  members.find((one) => one.memberNumber === '000007'),
  'the seed still has member 000007',
)

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, the shape of `pages/admin/saveWhileSaving.test.tsx`
   (review of PR 814, finding on „will not save a tick with no telephone"). A case here has what Vitest gives it,
   five seconds, and the global wait is twenty (`test/setup.ts`), so a wait that never succeeds ended by the clock
   of the case (`Test timed out in 5012ms`) and by nothing the case asserts. Set here, and so for this file
   alone. */
const THE_TIME_A_CASE_HAS = 5000

configure({ asyncUtilTimeout: THE_TIME_A_CASE_HAS / 2 })

const PAGE = '/sr/moji-podaci'
const THE_BOX = sr.registration.viberCommunity

/** `GET /api/me` for him, with the telephone and the wish given. */
function hisAnswer(held: { phone?: string; viberCommunity: boolean }): Response {
  const withoutTheTelephone = Object.fromEntries(Object.entries(myOwnRecordFromMe).filter(([name]) => name !== 'phone'))

  return new Response(
    JSON.stringify({
      role: 'competitor',
      account: 1,
      mailLanguage: 'sr',
      member: {
        ...withoutTheTelephone,
        memberNumber: ME.memberNumber,
        firstName: ME.firstName,
        lastName: ME.lastName,
        gender: ME.gender,
        city: ME.city,
        ...hisCategoryFromMe(ME),
        ...(held.phone === undefined ? {} : { phone: held.phone }),
        viberCommunity: held.viberCommunity,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

async function thePanel(): Promise<HTMLElement> {
  await screen.findByRole('heading', { level: 2, name: sr.account.personalTitle })

  return must(
    screen.getByRole('heading', { level: 2, name: sr.account.personalTitle }).closest('section'),
    'the panel of his data',
  )
}

/**
 * THE SAVE BUTTON IS LIVE, asked at once and before anything is waited for: a tick the screen did not take as a
 * change leaves the button held (`sendIsHeld`, `aria-disabled`), and a case that only waited for „Sačuvano”
 * would then fail on the clock and say nothing about why.
 */
function expectSomethingToSave(panel: HTMLElement): void {
  expect(within(panel).getByRole('button', { name: sr.account.save })).not.toHaveAttribute('aria-disabled', 'true')
}

function whatWasPut(asked: Asked[]): unknown[] {
  return asked.filter((one) => one.path === '/api/me' && one.init?.method === 'PUT').map((one) => JSON.parse(String(one.init?.body)))
}

describe('the box for the community on Viber on „Moji podaci”', () => {
  let stop = (): void => {}

  afterEach(() => {
    stop()
  })

  function aServer(held: { phone?: string; viberCommunity: boolean }): Asked[] {
    const server = serverThat((path, init) => {
      if (path !== '/api/me') {
        return null
      }

      return init?.method === 'PUT' ? answeredWith(200) : hisAnswer(held)
    })

    stop = server.stop

    return server.asked
  }

  it('opens as the server holds it, and the box beside his telephone is the registration’s', async () => {
    aServer({ phone: '+381 64 765 4321', viberCommunity: true })
    renderAt(PAGE, 'competitor', ME.memberNumber)

    const panel = await thePanel()
    const box = within(panel).getByRole('checkbox', { name: THE_BOX })

    expect(box).toBeChecked()
    expect(box).not.toBeRequired()
    expect(within(panel).getByRole('textbox', { name: /^Telefon/ })).toHaveValue('+381 64 765 4321')
  })

  it('sends the tick alone when he joins, and keeps the telephone where it was', async () => {
    const user = setupUser()
    const asked = aServer({ phone: '+381 64 765 4321', viberCommunity: false })

    renderAt(PAGE, 'competitor', ME.memberNumber)

    const panel = await thePanel()
    const box = within(panel).getByRole('checkbox', { name: THE_BOX })

    expect(box).not.toBeChecked()

    await user.click(box)
    expectSomethingToSave(panel)
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    expect(await within(panel).findByText(sr.account.saved)).toBeInTheDocument()
    expect(whatWasPut(asked)).toEqual([{ viberCommunity: true }])
  })

  it('sends the tick taken back when he leaves, and nothing more', async () => {
    const user = setupUser()
    const asked = aServer({ phone: '+381 64 765 4321', viberCommunity: true })

    renderAt(PAGE, 'competitor', ME.memberNumber)

    const panel = await thePanel()

    expect(within(panel).getByRole('checkbox', { name: THE_BOX })).toBeChecked()
    await user.click(within(panel).getByRole('checkbox', { name: THE_BOX }))
    expectSomethingToSave(panel)
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    expect(await within(panel).findByText(sr.account.saved)).toBeInTheDocument()
    expect(whatWasPut(asked)).toEqual([{ viberCommunity: false }])

    /* Saved, the box stands as it was sent, so a second press has nothing to send. */
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))
    expect(whatWasPut(asked)).toHaveLength(1)
  })

  it('will not save a tick with no telephone, and says why under the telephone', async () => {
    const user = setupUser()
    const asked = aServer({ viberCommunity: false })

    renderAt(PAGE, 'competitor', ME.memberNumber)

    const panel = await thePanel()

    await user.click(within(panel).getByRole('checkbox', { name: THE_BOX }))
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    const phone = within(panel).getByRole('textbox', { name: /^Telefon/ })

    await waitFor(() => {
      expect(phone).toHaveAccessibleDescription(sr.registration.phoneForViber)
    })
    expect(whatWasPut(asked)).toEqual([])
  })

  it('will not empty the telephone under a tick, and lets both go together', async () => {
    const user = setupUser()
    const asked = aServer({ phone: '+381 64 765 4321', viberCommunity: true })

    renderAt(PAGE, 'competitor', ME.memberNumber)

    const panel = await thePanel()
    const phone = within(panel).getByRole('textbox', { name: /^Telefon/ })

    /* Asked at once, so a box that is not drawn or opens empty fails here and not on the clock below. */
    expect(within(panel).getByRole('checkbox', { name: THE_BOX })).toBeChecked()

    await user.clear(phone)
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    await waitFor(() => {
      expect(phone).toHaveAccessibleDescription(sr.registration.phoneForViber)
    })
    expect(whatWasPut(asked)).toEqual([])

    expect(within(panel).getByRole('checkbox', { name: THE_BOX })).toBeChecked()
    await user.click(within(panel).getByRole('checkbox', { name: THE_BOX }))
    await user.click(within(panel).getByRole('button', { name: sr.account.save }))

    /* Asked of the request and not of „Sačuvano”, which a request refused by the form never earns. */
    await waitFor(() => {
      expect(whatWasPut(asked)).toHaveLength(1)
    }, { timeout: 2000 })
    expect(whatWasPut(asked)).toEqual([{ phone: '', viberCommunity: false }])
    expect(await within(panel).findByText(sr.account.saved)).toBeInTheDocument()
  })
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    /* The floor under the paragraph at the head of the file: take the `configure` there away and the wait is
       twenty seconds again (`test/setup.ts`) against a case of five. Asked of the number that decides. */
    expect(getConfig().asyncUtilTimeout).toBeLessThan(THE_TIME_A_CASE_HAS)
  })
})
