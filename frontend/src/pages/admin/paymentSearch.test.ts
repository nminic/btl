import { matching } from './paymentSearch'
import type { MembershipDue } from '../../data/types'

/**
 * FINDING ONE NAMED MAN ON THE LIST OF WHOEVER IS NOT A MEMBER YET.
 *
 * <p>Its own file rather than cases inside the screen's, which is what the portal does
 * everywhere (`moderatorWrites.test.ts`, `priceWrites.test.ts`, `leagueWrites.test.ts`): a
 * question about a filter should not need React mounted to be asked.
 *
 * <p><b>Why these cases matter more than they look.</b> The rule lives in two homes - here and
 * in the route's own `search` parameter - and this one is the one that decides what the
 * moderator sees, because the portal never sends the parameter. So the cases below are the only
 * measurement of the behaviour the owner asked for.
 */
describe('finding one man on the list', () => {
  const due = (
    competitorId: number,
    memberNumber: string,
    firstName: string,
    lastName: string,
  ): MembershipDue => ({
    competitorId,
    memberNumber,
    firstName,
    lastName,
    city: 'Beograd',
    /* THE SAME FOR EVERYBODY HERE, AND THAT IS THE POINT RATHER THAN LAZINESS. This file
       measures the SEARCH, and the owner named what it searches by: „po clanskom broju, imenu
       ili prezimenu". A currency, an expected amount or a balance differing between these four
       would let a case pass by telling them apart on something the search must not read. */
    currency: 'RSD',
    expected: 4800,
    balance: 0,
  })

  /**
   * FOUR PEOPLE, AND NOT ONE OF THEM IS THE ONLY ONE OF HIS KIND.
   *
   * <p>Two share a surname, so a surname is not an identity. Two hold a number and two hold
   * none, so the blank is exercised rather than assumed away. And „Marko" is one man's GIVEN
   * name and another man's SURNAME, which is the case a search written as two separate
   * readings of the two columns answers differently from one written over the pair.
   */
  const LIST = [
    due(41, '', 'Ana', 'Ilić'),
    due(23, '000031', 'Jovana', 'Ilić'),
    due(58, '', 'Petar', 'Marko'),
    due(17, '000009', 'Marko', 'Marković'),
  ]

  const found = (term: string) => matching(LIST, term).map((one) => one.competitorId)

  it('narrows nothing at all for a blank term, which is not the same as matching nothing', () => {
    /* ADL A54 asks every route to say which of the two meanings omission has, and this one
       says „do not narrow". The screen has to agree with it: read the other way, an empty
       search box would empty the screen on the one morning of the year the list matters. */
    expect(found('')).toEqual([41, 23, 58, 17])
    expect(found('   ')).toEqual([41, 23, 58, 17])
  })

  it('leaves the order exactly as the server sorted it', () => {
    /* By surname then given name, in the league's own alphabet, which is how somebody looks
       for a name he has just read off a bank statement. A screen that sorted its own copy
       would pass a fixture already in order and fail the next one. */
    expect(found('i')).toEqual([41, 23, 17])
  })

  it('finds a man by a piece of his member number', () => {
    expect(found('0009')).toEqual([17])
    expect(found('31')).toEqual([23])
  })

  it('finds him by his given name, by his surname, and by the two together', () => {
    expect(found('Jovana')).toEqual([23])
    expect(found('Marković')).toEqual([17])
    expect(found('Marko Marković')).toEqual([17])
  })

  it('answers both men for a word that is one name of each', () => {
    /* „Marko" is Marković's given name and Petar's surname. Both are real answers and the
       moderator picks by eye, which is what the town on the row is for; a search that
       returned one of them would hide the other behind a guess nobody asked it to make. */
    expect(found('Marko')).toEqual([58, 17])
  })

  it('does not care about case, and does not fold Serbian diacritics either way', () => {
    /* The second half is the server's own boundary written down on this side: `ilike` does
       not strip accents, V1 creates no `unaccent`, and `toLowerCase` strips none. So „Cacic"
       finds nothing for „Čačić" on both sides, which is at least the same nothing. */
    expect(found('marković')).toEqual([17])
    expect(found('MARKOVIĆ')).toEqual([17])
    expect(found('Markovic')).toEqual([])
  })

  it('finds nobody for a term nobody carries, and says so with an empty list', () => {
    expect(found('Nikola')).toEqual([])
  })

  it('takes a wildcard as a plain character, which is where the two rules differ', () => {
    /* MEASURED, AND IT IS THE ONE DIFFERENCE BETWEEN THIS RULE AND THE ROUTE'S. The route
       assembles a `like` pattern, so `%` there matches anything; here it is a per cent sign
       and matches nobody, because nobody's name holds one. Held as a case rather than as a
       sentence in a comment, so the day this portal starts sending `?search=` the difference
       is a red case and not an archaeology problem. */
    expect(found('%')).toEqual([])
    expect(found('Mark%')).toEqual([])
  })

  it('reads the number and the names, and nothing else on the row', () => {
    /* THE TOWN IS NOT SEARCHED, and that is a decision rather than an omission. The owner
       named three keys - „po clanskom broju, imenu ili prezimenu" - and the route reads those
       three and no more. A town in the rule would make the two homes disagree on the first
       moderator who typed „Beograd" and got everybody, and the town is on the row to be READ
       when two names collide, not to be matched on. */
    expect(found('Beograd')).toEqual([])
  })
})
