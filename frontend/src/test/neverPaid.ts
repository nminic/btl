import { serverThat, type Asked } from './serverAnswers'

/**
 * THE ANSWER `GET /api/me` GIVES SOMEBODY WHO REGISTERED AND HAS NOT PAID, written out field by
 * field.
 *
 * <p>PDL P8, the entry „Šta sme neplaćen član" (10.10.2026): such a person has a record of his
 * own and no member number, because registration hands out none (30.07.2026, ADL A44) and the
 * league gives it when the payment is recorded. What `MeApi.MyOwnRecord` therefore leaves out for
 * him is not four names but five - the number is the fifth annotated component, and it is the
 * one he does not have ({@link WHAT_HE_DOES_NOT_HAVE_YET}). His fee does not stand
 * (`active: false`), he holds no basis of the season on sale and no season with it, because since
 * V62 a basis is a membership of a season and he holds none (PDL P8, 18.10.2026; until that day he
 * was answered the per-person word `payment` registration wrote), and his first season is the one
 * being paid for. He has an address, which registration requires, and no telephone, which it does
 * not ({@link WHAT_HE_DOES_NOT_HAVE_YET}).
 *
 * <p><b>Written out here, and not read off the generated members</b>, for the reason
 * `test/hisPage.ts` gives about the lapsed member: a case about what a body is BELIEVED as must
 * not take its body from the place the screens take theirs. Nobody in `test/mock/competitors.json`
 * is in this state - every row there has a number - so there is nothing on the disc to read.
 *
 * <p><b>What holds it to the server is a case and not this comment</b>:
 * `pages/member/neverPaid.test.tsx` requires these names, with the five, to be exactly the
 * components `MeApi.MyOwnRecord` declares, read off the backend's own source.
 */
export const aNeverPaidRecord = {
  country: 'RS',
  firstSeason: 2027,
  active: false,
  referralCode: '3d6b1f0a9c2e4478',
  referredCount: 0,
  firstName: 'Tek',
  lastName: 'Stigao',
  gender: 'M',
  city: 'Beograd',
  ageBand: '25-39',
  firstSeason2027: false,
  bio: '',
  profileHidden: false,
  birthdayShown: 'none',
  address: 'Ulica Nova 3',
}

/**
 * THE SEVEN NAMES `MeApi.MyOwnRecord` LEAVES OUT RATHER THAN CARRY AS NULL (`@JsonInclude
 * (NON_NULL)`), all seven of them absent for him: the number he has not been given, the team, the
 * year in it, the portrait and its square, none of which he has, the telephone, which
 * registration does not ask for, and the words that wait for a moderator, of which he has none.
 */
export const WHAT_HE_DOES_NOT_HAVE_YET = [
  'memberNumber',
  /* The basis of the season on sale and that season, absent together for somebody who holds no
     membership of it (`MeApi.MyOwnRecord`, since V62). */
  'membershipBasis',
  'membershipSeason',
  'teamId',
  'teamSince',
  'photo',
  'crop',
  'smallPhoto',
  'phone',
  'bioWaiting',
]

/**
 * `GET /api/me` AS THE SERVER ANSWERS SOMEBODY WHO HAS NOT PAID, for the length of one case.
 *
 * <p>In front of the disc reader, as every `serverThat` is, so everything the case does not name
 * is answered as it always was. The cookie is not looked at: this stands in for the server's
 * answer to ONE caller, and what the caller is, is the case's to arrange.
 *
 * @param changes what this case changes in the record, over {@link aNeverPaidRecord}; a name given
 *                as `undefined` is left out of the answer, which is how a real server says „none"
 * @param role    what the answer calls him, which is `competitor` for anybody with a record
 */
export function neverPaidAsServed(
  changes: Record<string, unknown> = {},
  role = 'competitor',
): { asked: Asked[]; stop: () => void } {
  return serverThat((path) =>
    path === '/api/me'
      ? new Response(
          JSON.stringify({
            role,
            account: 1,
            member: { ...aNeverPaidRecord, ...changes },
            /* The third name of the answer (`MeApi.WhoIAm`), which the language panel of the settings
               reads. The server sends it to every account, so a stand-in that left it out would make
               every case below a case about a panel that cannot read its language. */
            mailLanguage: 'sr',
            /* And the seasons open for a report, which the server answers every account as well. */
            seasonsOpenForAReport: [2027],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      : null,
  )
}
