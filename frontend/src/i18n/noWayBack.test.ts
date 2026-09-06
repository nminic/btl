import sr from './sr.json'

/**
 * The portal has no „Nazad" links, and this is what keeps it that way.
 *
 * Owner, 05.09.2026: „Obriši sve Nazad linkove koje si pomenuo, ne želim da imam ni jedan
 * takav slučaj na portalu... Default Back akcija mi je OK". That is a rule about the whole
 * portal, not about the four screens that had one, and a removal without a floor is a list
 * that the next screen quietly leaves off.
 *
 * **The floor is the whole dictionary, not a list of screens.** Nine of these went in one
 * change: two under a heading, four out of the flows of an event, two off the screens that
 * confirm something was sent, and one out of a message. What is written here is the one
 * that stays, and the query it is held against reads all 1075 keys. The day somebody writes
 * a tenth, this fails and asks for a decision once, rather than waiting for a reader to
 * notice the portal disagreeing with itself.
 *
 * **What it knows, and what it does not.** It knows the word. A link back whose words avoid
 * „Nazad" walks past it, and that is stated rather than pretended: a rule about where a link
 * points cannot be read off one call, and a guard that must follow a value through the code
 * has no bottom (`CLAUDE.md`).
 *
 * **Two of the nine did avoid it**, and saying otherwise would be this guard claiming more
 * than it holds: the way out of a message read „Sve poruke", and the way off a day of the
 * calendar read „Kalendar". Both are gone, and both are held elsewhere, by
 * `pages/memberFlows.test.tsx` and `pages/Calendar.test.tsx`. Complete here is the word,
 * not the class; the class is held by those two and by `pages/backAfterSending.test.tsx`,
 * which reads its list of screens off the imports rather than off a memory.
 */

/** The one the owner kept, and why: it is not a way back but the way out of a form.
 *
 *  Owner, 05.09.2026, choosing „opcija 3 plus B": „Ostaju samo dva dugmeta u
 *  administraciji (D), koja i nisu veze nego zatvaraju formu." Both draw this one word.
 */
const KEPT = 'admin.form.back'

function every(node: object, prefix = ''): [string, string][] {
  return Object.entries(node).flatMap(([key, value]: [string, unknown]): [string, string][] => {
    const name = prefix === '' ? key : `${prefix}.${key}`

    if (typeof value === 'string') {
      return [[name, value]]
    }

    return typeof value === 'object' && value !== null ? every(value, name) : []
  })
}

describe('the portal offers no way back of its own', () => {
  it('says „Nazad" in one sentence only, the one that closes a form', () => {
    const saying = every(sr)
      .filter(([, value]) => value.includes('Nazad'))
      .map(([name]) => name)

    expect(saying).toEqual([KEPT])
  })

  it('is not vacuous: the sentence it allows is really there', () => {
    /* Without this, the case above would pass just as well on a dictionary that had lost
       the admin control too, and would then be measuring nothing at all. */
    const kept = every(sr).find(([name]) => name === KEPT)

    expect(kept?.[1]).toBe('Nazad na spisak')
  })
})
