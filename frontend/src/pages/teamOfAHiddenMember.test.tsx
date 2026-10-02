import { screen, within } from '@testing-library/react'
import { formatPoints } from '../i18n/format'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { aCompetitor, aTeam } from '../test/theAnswer'

/**
 * A MEMBER WHO HIDES HIS PROFILE, ON HIS TEAM'S PAGE AND IN THE TABLE OF TEAMS, ON THE ANSWERS THE
 * SERVER REALLY GIVES.
 *
 * **What changed on the server, since 02.10.2026.** PDL, odeljak 16, [ODLUKA 27.09.2026, owner]:
 * the team leaves a hidden member's record for a reader who is not signed in, „isto kao biografija i
 * fotografija" - so `/api/competitors` answers his `teamId` and `teamSince` as null to a visitor -
 * and the owner's own limit on it the same day: „Samo da se razumemo, mozda on sakrije profil, ali
 * ako je deo tima, njegovo ime se vidi u timu i bodovi koje je doneo." So `/api/teams` names him on
 * his team instead (`alsoInTheTeam`), to exactly that reader.
 *
 * **What these cases hold is that nothing a visitor sees moved.** The team's page names him, with
 * his points, among the members; the table of teams adds his points to the team's sum and counts
 * him. Both screens used to read him off his record, which no longer carries the link, so read
 * that way they would lose him and the league's arithmetic with him.
 *
 * **The generated files cannot say any of this**: `test/setup.ts` answers every reader out of them
 * alike, and no member there hides his profile. So each case puts the server in front of the disc
 * (`test/serverAnswers.ts`) with the two answers in the shape the server gives them, and the shapes
 * are built off the records the server declares (`test/theAnswer.ts`), not written field by field.
 *
 * **Every case is read as a visitor**, because the roster does not ask who is reading: what differs
 * between a visitor and somebody signed in is the SHAPE of the two answers, and the case that
 * matters is that both shapes draw one team.
 */

const THE_TEAM = 41
const ITS_ADDRESS = 'tim-sa-skrivenim'
const ITS_NAME = 'Tim sa skrivenim'

/** The member who does not hide, in the team from 2027. */
const OPEN = '000101'

/** The member who hides his profile, in the same team. */
const HIDDEN = '000102'

/** And somebody in another team, so a team's sum is never everybody's sum. */
const ELSEWHERE = '000103'

/**
 * A member as `/api/competitors` answers him, off the record the server declares.
 *
 * @param team null for a member whose record names no team to this reader, which since 02.10.2026
 *             is also a member who hides his profile read by a visitor
 */
function aMember(
  memberNumber: string,
  firstName: string,
  lastName: string,
  team: { id: number; since: number } | null,
  hidden = false,
) {
  return {
    ...aCompetitor,
    memberNumber,
    firstName,
    lastName,
    teamId: team === null ? null : team.id,
    teamSince: team === null ? null : team.since,
    profileHidden: hidden,
    photo: null,
    crop: null,
    bio: hidden ? null : '',
  }
}

/** A team as `/api/teams` answers it to a visitor: no seat, and whoever it is owed. */
function aTeamNaming(
  id: number,
  slug: string,
  name: string,
  alsoInTheTeam: { memberNumber: string; since: number }[],
) {
  return { ...aTeam, id, slug, name, organizerMemberNumber: undefined, alsoInTheTeam }
}

/** One result, the fields the server answers a result with and nothing else. */
let resultsMade = 900_000

function aResult(memberNumber: string, date: string, points: number) {
  resultsMade += 1

  return {
    id: resultsMade,
    memberNumber,
    raceId: 275,
    raceName: 'Trka',
    eventName: 'Trka',
    eventSlug: 'trka',
    date,
    distanceKm: 10,
    ascentM: 100,
    descentM: 100,
    seconds: 3000,
    points,
    category: 'short',
  }
}

/** The three resources both screens read, answered as given, and the disc for everything else. */
function answering(members: unknown[], teams: unknown[], results: unknown[]) {
  const answers = new Map<string, unknown[]>([
    ['/api/competitors', members],
    ['/api/teams', teams],
    ['/api/results', results],
  ])

  return serverThat((path) => {
    const answer = answers.get(path)

    return answer === undefined
      ? null
      : new Response(JSON.stringify(answer), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
  })
}

/** The rows of the team's table of members, by the name each one carries. */
async function rowsOfTheMembers(): Promise<HTMLElement[]> {
  const table = await screen.findByRole('table', { name: 'Članovi' })

  return within(table).getAllByRole('row').slice(1)
}

function rowOf(rows: HTMLElement[], name: string): HTMLElement | undefined {
  return rows.find((row) => (row.textContent ?? '').includes(name))
}

/** The last cell of a row, which is where both tables put the points. */
function pointsIn(row: HTMLElement): string {
  return must(within(row).getAllByRole('cell').at(-1), 'the points of a row').textContent ?? ''
}

describe("a member who hides his profile, on his team's page", () => {
  it('is named among the members with his points, off the team, where his record names no team', async () => {
    const { stop } = answering(
      [
        aMember(OPEN, 'Jovan', 'Javni', { id: THE_TEAM, since: 2027 }),
        aMember(HIDDEN, 'Skriven', 'Skrivenic', null, true),
        aMember(ELSEWHERE, 'Drugi', 'Drugic', { id: 42, since: 2027 }),
      ],
      [
        aTeamNaming(THE_TEAM, ITS_ADDRESS, ITS_NAME, [{ memberNumber: HIDDEN, since: 2027 }]),
        aTeamNaming(42, 'drugi-tim', 'Drugi tim', []),
      ],
      [
        aResult(OPEN, '2027-05-01', 10),
        aResult(HIDDEN, '2027-05-02', 7),
        aResult(ELSEWHERE, '2027-05-03', 12),
      ],
    )

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, '2027-06-01')

      expect(await screen.findByRole('heading', { level: 1, name: ITS_NAME })).toBeVisible()

      const rows = await rowsOfTheMembers()
      const his = must(rowOf(rows, 'Skriven Skrivenic'), 'his row among the members')

      expect(rows).toHaveLength(2)
      expect(pointsIn(his)).toBe(formatPoints(7, 'sr'))
      /* By his name and as TEXT, which is the hiding itself still working: the record the
         team's answer led to is his whole record, flag and all (PDL, 06.09.2026). */
      expect(within(his).queryByRole('link')).toBeNull()
      expect(within(must(rowOf(rows, 'Jovan Javni'), 'the other member')).getByRole('link')).toBeVisible()
      /* And he is counted in the head of the page as well as listed under it. */
      expect(screen.getByText(/2 člana/)).toBeVisible()
    } finally {
      stop()
    }
  })

  it('is drawn the same where the record names the team and the team names nobody', async () => {
    /* The shape somebody signed in is answered: the link on his record and an empty list on the
       team. One team on the screen either way, which is the claim the two doors are worth. */
    const { stop } = answering(
      [
        aMember(OPEN, 'Jovan', 'Javni', { id: THE_TEAM, since: 2027 }),
        aMember(HIDDEN, 'Skriven', 'Skrivenic', { id: THE_TEAM, since: 2027 }, true),
        aMember(ELSEWHERE, 'Drugi', 'Drugic', { id: 42, since: 2027 }),
      ],
      [aTeamNaming(THE_TEAM, ITS_ADDRESS, ITS_NAME, []), aTeamNaming(42, 'drugi-tim', 'Drugi tim', [])],
      [
        aResult(OPEN, '2027-05-01', 10),
        aResult(HIDDEN, '2027-05-02', 7),
        aResult(ELSEWHERE, '2027-05-03', 12),
      ],
    )

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}`, 'visitor', null, undefined, '2027-06-01')

      const rows = await rowsOfTheMembers()

      expect(rows).toHaveLength(2)
      expect(pointsIn(must(rowOf(rows, 'Skriven Skrivenic'), 'his row'))).toBe(formatPoints(7, 'sr'))
      expect(pointsIn(must(rowOf(rows, 'Jovan Javni'), 'the other row'))).toBe(formatPoints(10, 'sr'))
      expect(screen.getByText(/2 člana/)).toBeVisible()
    } finally {
      stop()
    }
  })

  it('counts him from the season his team gives with him and not before', async () => {
    /* He is in the team from 2028 and raced in both seasons; the member who does not hide is in
       it from 2027. So 2027 is the season that tells „from the season it gives" apart from
       „always": a page that ignored it would list him in a year he was not in the team. */
    const { stop } = answering(
      [
        aMember(OPEN, 'Jovan', 'Javni', { id: THE_TEAM, since: 2027 }),
        aMember(HIDDEN, 'Skriven', 'Skrivenic', null, true),
      ],
      [aTeamNaming(THE_TEAM, ITS_ADDRESS, ITS_NAME, [{ memberNumber: HIDDEN, since: 2028 }])],
      [
        aResult(OPEN, '2027-05-01', 10),
        aResult(HIDDEN, '2027-05-02', 7),
        aResult(OPEN, '2028-05-01', 10),
        aResult(HIDDEN, '2028-05-02', 7),
      ],
    )

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}?sezona=2027`, 'visitor', null, undefined, '2028-06-01')

      const in2027 = await rowsOfTheMembers()

      expect(in2027).toHaveLength(1)
      expect(rowOf(in2027, 'Skriven Skrivenic')).toBeUndefined()
    } finally {
      stop()
    }
  })

  it('offers a season only he raced in', async () => {
    /* The seasons on offer are the running one and every season anybody in the team has raced
       in. Here 2027 was raced by him alone, so a picker that knew only the members on their
       records would not offer it, and the page would fall back to the running season. */
    const { stop } = answering(
      [
        aMember(OPEN, 'Jovan', 'Javni', { id: THE_TEAM, since: 2028 }),
        aMember(HIDDEN, 'Skriven', 'Skrivenic', null, true),
      ],
      [aTeamNaming(THE_TEAM, ITS_ADDRESS, ITS_NAME, [{ memberNumber: HIDDEN, since: 2027 }])],
      [aResult(HIDDEN, '2027-05-02', 7), aResult(OPEN, '2028-05-01', 10)],
    )

    try {
      renderAt(`/sr/tim/${ITS_ADDRESS}?sezona=2027`, 'visitor', null, undefined, '2028-06-01')

      const in2027 = await rowsOfTheMembers()

      expect(in2027).toHaveLength(1)
      expect(pointsIn(must(rowOf(in2027, 'Skriven Skrivenic'), 'his row in 2027'))).toBe(
        formatPoints(7, 'sr'),
      )
    } finally {
      stop()
    }
  })
})

describe('a member who hides his profile, in the table of teams', () => {
  it("is in his team's sum and its head count, off the team, where his record names no team", async () => {
    /* The other team stands on 12, between his team with him (17) and without him (10), so
       leaving him out moves the ORDER of the table and not only one number in it. */
    const { stop } = answering(
      [
        aMember(OPEN, 'Jovan', 'Javni', { id: THE_TEAM, since: 2027 }),
        aMember(HIDDEN, 'Skriven', 'Skrivenic', null, true),
        aMember(ELSEWHERE, 'Drugi', 'Drugic', { id: 42, since: 2027 }),
      ],
      [
        aTeamNaming(THE_TEAM, ITS_ADDRESS, ITS_NAME, [{ memberNumber: HIDDEN, since: 2027 }]),
        aTeamNaming(42, 'drugi-tim', 'Drugi tim', []),
      ],
      [
        aResult(OPEN, '2027-05-01', 10),
        aResult(HIDDEN, '2027-05-02', 7),
        aResult(ELSEWHERE, '2027-05-03', 12),
      ],
    )

    try {
      renderAt('/sr/timovi', 'visitor', null, undefined, '2027-06-01')

      const table = await screen.findByRole('table', { name: 'Timovi' })
      const rows = within(table).getAllByRole('row').slice(1)
      const first = must(rows[0], 'the first team in the table')
      const cells = within(first).getAllByRole('cell')

      expect(first.textContent).toContain(ITS_NAME)
      expect(pointsIn(first)).toBe(formatPoints(17, 'sr'))
      /* The head count is the fourth cell: place, team, town, members, points. */
      expect(must(cells[3], 'the head count').textContent).toBe('2')
    } finally {
      stop()
    }
  })
})
