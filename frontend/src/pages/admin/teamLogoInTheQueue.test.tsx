import { configure, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { timesDropped } from '../../data/client'
import type { PendingItem } from '../../data/types'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { did, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { thePictureArrives } from '../../test/waitingPicture'
import { QUEUE, returned } from './queues'
import { isChange, isTeamLogo } from './teamProposal'
import { decisionPath } from './verificationWrites'

/* Every wait of this file is given half of the time a case has (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * A TEAM'S LOGO ON THE TEAMS QUEUE (owner, PDL 25.11.2026, „Urednik tima postavlja znak tima slikom”, and the
 * derivation of the same day: „Znak koji pošalje urednik tima ide moderatoru na odobrenje”): a picture, decided as a
 * portrait is, never made into a team, and held to the one rule of who sent it.
 *
 * Two logos of one team in the served files' Dunavski trkači (team 1, run by 000001): one sent by 000001, and one
 * sent by 000007, who does not run it, so a card that took the second for the first is told apart.
 */
const RATING = { organisation: 0, value: 0, ambience: 0 }
const CROP = { x: 0.3, y: 0.7, size: 0.45 }

function aLogo(id: number, memberNumber: string, who: string, photoId: number): PendingItem {
  return {
    queue: 'teams',
    id: String(id),
    date: '2026-11-25',
    memberNumber,
    who,
    subject: 'Dunavski trkači',
    subjectId: '1',
    body: '',
    picture: '',
    currentDate: '',
    proposedDate: '',
    email: '',
    kind: 'teamLogo',
    city: '',
    country: '',
    photoId,
    crop: CROP,
    rating: RATING,
  }
}

const HIS = aLogo(41, '000001', 'Marko Marković', 17)
const NOT_HIS = aLogo(42, '000007', 'Jovan Jovanović', 19)
/* A logo of a team the list no longer has: its row left the queue with the team (`verification_team_fk`), so the
   screen does not refuse it and the route answers the decision. */
const OF_A_TEAM_GONE = { ...aLogo(43, '000007', 'Jovan Jovanović', 23), subject: 'Obrisan tim', subjectId: '99' }

const asTheList = (rows: unknown[]): Response =>
  new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } })

describe('a team’s logo, told from a team', () => {
  it('is its own sort of item, and neither a change nor a new team', () => {
    expect(isTeamLogo(HIS)).toBe(true)
    expect(isChange(HIS)).toBe(false)
    expect(isTeamLogo({ ...HIS, kind: 'teamEdit' })).toBe(false)
  })

  it('is handed back under a heading of its own', () => {
    expect(returned(QUEUE.teams, { kind: 'teamLogo' })).toBe('verification.teamLogoReturned')
    expect(returned(QUEUE.teams, { kind: 'teamEdit' })).toBe('verification.teamChangeReturned')
  })
})

describe('a team’s logo on the queue of teams', () => {
  it('is drawn as a picture of the team, approved by the picture it drew, and the teams are read again', async () => {
    const { asked, stop } = serverThat((path) =>
      path === '/api/verification' ? asTheList([HIS]) : path === decisionPath('41') ? did() : null,
    )

    try {
      const user = setupUser()

      renderAt(`/sr/${QUEUE.teams.path}`, 'superadmin')
      await screen.findByRole('list', { name: /Čeka/ })

      const card = within(must(screen.getByRole('heading', { name: 'Dunavski trkači' }).closest('li'), 'the card'))

      expect(card.getByText(sr.verification.teamLogo)).toBeVisible()
      expect(card.queryByLabelText(/Naziv/), 'the fields of a team were drawn on a logo').toBeNull()

      thePictureArrives(card)

      const dropped = timesDropped('teams')

      await user.click(card.getByRole('button', { name: 'Odobri' }))

      const sent = asked.find((one) => one.path === decisionPath('41'))

      expect(JSON.parse(String(sent?.init?.body))).toEqual({ approved: true, reason: '', seenPhotoId: 17, seenCrop: CROP })
      expect(timesDropped('teams'), 'the teams were not read again after the logo was approved').toBe(dropped + 1)
    } finally {
      stop()
    }
  }, SLOW)

  it('is handed back by the picture it drew, with the reason beside it', async () => {
    const { asked, stop } = serverThat((path) =>
      path === '/api/verification' ? asTheList([HIS]) : path === decisionPath('41') ? did() : null,
    )

    try {
      const user = setupUser()

      renderAt(`/sr/${QUEUE.teams.path}`, 'superadmin')
      await screen.findByRole('list', { name: /Čeka/ })

      const card = within(must(screen.getByRole('heading', { name: 'Dunavski trkači' }).closest('li'), 'the card'))

      thePictureArrives(card)
      await user.click(card.getByRole('button', { name: 'Odbij' }))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Logo je mutan.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      expect(JSON.parse(String(asked.find((one) => one.path === decisionPath('41'))?.init?.body))).toEqual({
        approved: false,
        reason: 'Logo je mutan.',
        seenPhotoId: 17,
        seenCrop: CROP,
      })
    } finally {
      stop()
    }
  }, SLOW)

  it('says why the logo of a member who no longer runs the team cannot be approved, and the sweep leaves it', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { asked, stop } = serverThat((path) =>
      path === '/api/verification'
        ? asTheList([NOT_HIS, HIS, OF_A_TEAM_GONE])
        : [decisionPath('41'), decisionPath('42'), decisionPath('43')].includes(path)
          ? did()
          : null,
    )

    try {
      const user = setupUser()

      renderAt(`/sr/${QUEUE.teams.path}`, 'superadmin')
      await screen.findByRole('list', { name: /Čeka/ })

      expect(screen.getByText(sr.verification.teamLogoNotYours)).toBeVisible()

      for (const one of [...screen.getAllByRole('heading', { name: 'Dunavski trkači' }), screen.getByRole('heading', { name: 'Obrisan tim' })]) {
        thePictureArrives(within(must(one.closest('li'), 'a card')))
      }

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      await screen.findByText(sr.verification.teamLogoNotYours)
      expect(
        asked.filter((one) => one.path.endsWith('/decision')).map((one) => one.path),
        'the sweep approved the logo of a member who no longer runs the team',
      ).toEqual([decisionPath('41'), decisionPath('43')])
    } finally {
      stop()
      confirm.mockRestore()
    }
  }, SLOW)
})
