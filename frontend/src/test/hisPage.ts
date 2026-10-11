import { serverThat, type Asked } from './serverAnswers'

/**
 * THE ANSWER `GET /api/me` GIVES A MEMBER WHOSE FEE HAS LAPSED, with the page his own profile is
 * drawn from inside it.
 *
 * <p>PDL P8a, 25.09.2026: he opens his own profile, and he is on no row of `/api/competitors`, so
 * this answer is where his name, his town, his category, his biography and his portrait come
 * from (`MeApi.MyOwnRecord`).
 *
 * <p><b>It is written out here, field by field, and it is the lapsed member of the generated
 * data</b> (000032, `test/mock/competitors.json`) - not read off that file, for the reason
 * `session/theServer.test.ts` gives about the same sample: a case about what a body is BELIEVED
 * as must not take its body from the place the screens take theirs. He is in no team and has no
 * portrait, which is the common answer, so the four names that may honestly be absent are absent
 * ({@link WHAT_MAY_BE_LEFT_OUT}).
 *
 * <p><b>What holds it to the server is a case and not this comment</b>:
 * `pages/profile/hisOwnProfile.test.tsx` requires the names here, with the four, to be exactly
 * the components `MeApi.MyOwnRecord` declares, read off the backend's own source.
 */
export const aLapsedMembersPage = {
  memberNumber: '000032',
  country: 'RS',
  firstSeason: 2016,
  membershipBasis: 'payment',
  referralCode: 'a92a9c8493cecc3e',
  referredCount: 0,
  firstName: 'Vojislav',
  lastName: 'Antonijević',
  gender: 'M',
  city: 'Zaječar',
  ageBand: '40-54',
  firstSeason2027: false,
  bio: '',
  profileHidden: false,
  birthdayShown: 'none',
}

/**
 * THE FOUR NAMES `MeApi.MyOwnRecord` LEAVES OUT RATHER THAN CARRY AS NULL (`@JsonInclude
 * (NON_NULL)`), because a member may honestly have none of what they say: no club, and with it
 * no year in it, and no portrait, and with it no square. `memberNumber` is the fifth annotated
 * component and is present in the sample, because a member has one.
 */
export const WHAT_MAY_BE_LEFT_OUT = ['teamId', 'teamSince', 'photo', 'crop']

/**
 * `GET /api/me` AS THE SERVER ANSWERS THE LAPSED MEMBER, for the length of one case.
 *
 * <p>In front of the disc reader, as every `serverThat` is, so everything the case does not name
 * is answered as it always was. The cookie is not looked at: this stands in for the server's
 * answer to ONE caller, and what the caller is, is the case's to arrange (`renderAt`).
 *
 * @param changes what this case changes in the record, over {@link aLapsedMembersPage}; a name
 *                given as `undefined` is left out of the answer, which is how a real server
 *                says „none" for the four names that may be absent
 * @param role    what the answer calls him, which is `competitor` for a member
 * @returns what was asked for, and the way to put the disc reader back
 */
export function hisPageAsServed(
  changes: Record<string, unknown> = {},
  role = 'competitor',
): { asked: Asked[]; stop: () => void } {
  return serverThat((path) =>
    path === '/api/me'
      ? new Response(
          JSON.stringify({ role, account: 1, member: { ...aLapsedMembersPage, ...changes } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      : null,
  )
}

/**
 * A `GET /api/me` THAT ANSWERS ONLY WHEN IT IS TOLD TO, one request at a time and in any order.
 *
 * <p>For the cases about the moments between the questions: the server has not said who is
 * reading, it has said that and not yet what his page is, one answer is late and another is not.
 * Each call of the portal to `/api/me` becomes a pending request, numbered in the order it was
 * made, and the case answers it by that number - with a response, or with an error for a server
 * that cannot be reached.
 *
 * <p>The numbering is the arrangement: the first request is the shell's own question (who is
 * asking), and the second is the page asking for the reader's record; a case that wants to hold
 * the second back answers the first and does not answer the second.
 *
 * @returns `answer` to answer request number `which`, `count` for how many were made, `asked` for
 *          everything the visit asked for (not only this address), and the way to put the disc
 *          reader back
 */
export function aServerThatAnswersWhenTold(): {
  answer: (which: number, response: Response | Error) => void
  count: () => number
  asked: Asked[]
  stop: () => void
} {
  const pending: ((answer: Response | Error) => void)[] = []

  const { asked, stop } = serverThat((path) =>
    path === '/api/me'
      ? new Promise<Response>((resolve, reject) => {
          pending.push((answer) => {
            if (answer instanceof Error) {
              reject(answer)
            } else {
              resolve(answer)
            }
          })
        })
      : null,
  )

  return {
    answer: (which, response) => {
      const answers = pending[which]

      if (answers === undefined) {
        throw new Error(`nothing was asked at /api/me as number ${which}`)
      }

      answers(response)
    },
    count: () => pending.length,
    asked,
    stop,
  }
}
