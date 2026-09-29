import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import sr from '../../i18n/sr.json'
import { useSession } from '../../session/useSession'
import { renderAt } from '../../test/render'

/**
 * THE SETTINGS SCREEN OFFERS NOTHING THAT SWITCHES A MAIL OFF, AND THAT IS A DECISION.
 *
 * <p><b>Why this file exists.</b> Until 28.09.2026 this screen ended in a panel of three
 * checkboxes, and every one of them was a promise the portal cannot keep. PDL P22
 * (11.08.2026) says „Sest mejlova iz spiska su obavezni i clan ih ne moze iskljuciti", and
 * two of the three - „Kad mi rezultat bude odobren" and „Kad mi neko izmeni rezultat" - were
 * on exactly that list of six; the third offered a newsletter, and the same decision struck
 * the one thing near it („obavestenja o predstojecem dogadjaju nema uopste"). The owner chose
 * on 28.09.2026 to take the panel rather than leave an empty one: „Ekran za podesavanja
 * obavestenja se sklanja u celini", with the reason „Ekran koji ne radi nista je obecanje da
 * negde postoji izbor."
 *
 * <p><b>What brings the panel back is named in the same decision, and this file is what makes
 * that return deliberate:</b> „ako sutra nastane mejl koji sme da se iskljuci, ekran se pravi
 * ponovo." Nothing here forbids a switch. It fails the day one appears, so that whoever adds
 * it answers P22 first instead of restoring the prototype's mock by habit.
 *
 * <p><b>THE QUESTION IS ASKED OF THE DRAWN SCREEN AND OF THE WHOLE DICTIONARY, never of the
 * source text.</b> „Is this value a mail switch" would have to follow a value through the
 * code and has no bottom; „what does the screen draw" and „what names does the book answer
 * to" are both read off the thing itself and cannot be incomplete in any direction. What each
 * case may therefore NOT see is written on it.
 *
 * <p><b>WHAT THIS FILE DOES NOT SAY, AND IT MATTERS.</b> P22 of 11.08.2026 gave a member six
 * switches over the BELL's mail: „Zvono uvek, mejl podrazumevano ISKLJUCEN, clan ga sam pali:
 * sve drustveno i sporedno." They were not the three that were here, and they lived on the
 * server (`notification_setting`, V13, and `GET`/`PUT /api/me/notifications`) until V48
 * removed them, on the owner's decision of 29.09.2026: „Ako su ovo prekidaci, ja bih da se u
 * potpunosti za njih izbace mailovi i da funkcionise samo kao poruke u inbox portala." PDL
 * records that the second half of that P22 sentence stopped holding that day, „Mejla nema
 * uopste, pa nema ni prekidaca", so nothing on the server offers a switch any more either.
 * This file does not test that. It claims this screen and this session offer none, which is
 * what the owner decided on 28.09.2026.
 *
 * <p><b>TWO THINGS THIS CANNOT SEE, MEASURED RATHER THAN GUESSED, so that the next reader
 * does not take the file for wider than it is.</b> Both were written as mutations and both
 * survived:
 *
 * <ul>
 * <li><b>A heading written straight into the JSX as a Serbian literal</b>, bypassing the
 * dictionary. Nothing in the portal catches raw Serbian in a `.tsx` - looked for and not
 * found - and a rule over the drawn prose would have to be right in advance about sentences
 * nobody has written, which is the shape that has never converged here. What makes the gap
 * narrow rather than wide is that no screen in this portal writes its own words: every
 * heading comes through `t(...)`, so the way a panel actually returns goes through the book
 * and is caught above.</li>
 * <li><b>The `NotificationKey` type coming back with nothing behind it.</b> A type draws
 * nothing and promises a member nothing; what was worth guarding was the panel and the
 * session field, and both fail their mutations. This one is recorded as a boundary rather
 * than guarded, because a rule over a dead export would measure tidiness and not the
 * decision.</li>
 * </ul>
 */

/** Any member, and deliberately not the first row of the served list: „the screen drew a
 *  checkbox" must not be satisfied by „it drew the first man's". */
const ME = '000007'

/** Every name the dictionary answers to, branches and leaves alike, walked rather than
 *  listed. This is the floor under the case below: a rule written over `myProfile` would be
 *  a second list and would say nothing about a family re-added under another parent. */
function everyNameIn(node: object, stem = ''): string[] {
  return Object.entries(node).flatMap(([key, value]: [string, unknown]) => {
    const name = stem === '' ? key : `${stem}.${key}`

    return typeof value === 'object' && value !== null
      ? [name, ...everyNameIn(value, name)]
      : [name]
  })
}

/** Reads the live session out of the running portal, so the case below asks the object the
 *  screens are handed rather than the file it is declared in. */
function WhatTheSessionHolds() {
  return <span data-testid="session-keys">{Object.keys(useSession()).join(' ')}</span>
}

describe('the settings screen', () => {
  it('draws one checkbox, and it is the one about who sees the profile', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME)

    /* WAITED FOR FIRST, AND THAT IS THE WHOLE POINT OF THE ORDER. The visibility panel
       arrives behind `Resource`, so a count taken straight away is zero while the screen is
       still loading - and „no notification box" would then be satisfied by „nothing has
       drawn yet", which is a different fact wearing the same number. Waiting for the box
       that SHOULD be there splits the two before anything is counted. */
    const survivor = await screen.findByRole('checkbox', { name: sr.settings.hideProfile })

    /* Read off the DOM and complete by construction: it names no key and no sentence, so a
       panel put back under any name at all fails here. */
    expect(screen.getAllByRole('checkbox')).toEqual([survivor])
  })

  it('says nothing about notifications at all, in either book', () => {
    const books = [
      ['sr.json', everyNameIn(sr)],
      ['en.json', everyNameIn(en)],
    ] as const

    for (const [book, named] of books) {
      /* That the walk read something at all, so the rule below is not a check over an empty
         list - the shape a rewrite of `everyNameIn` would most easily take. Two witnesses,
         the second deep enough that a walk which stops recursing fails on it. */
      expect(named, `${book} was not read`).toContain('settings')
      expect(named, `${book} was not read deeply`).toContain('settings.hideProfile')

      /* THE WHOLE PANEL SPOKE THROUGH THREE KINDS OF NAME and this is one rule over all
         three, rather than three rules: the heading (`settings.notifications`), the note
         under it (`myProfile.notificationsNote`) and the family of labels
         (`myProfile.notify.*`). The stem and not the whole name, so a panel re-added under
         another parent is the same panel and is caught here just the same.

         <p>Matched on the NAME of a key and never on the sentence it holds. A rule over the
         prose would have to be right in advance about sentences nobody has written and gets
         it wrong in both directions at once; a key name is ours, is English, and is read off
         the book itself.

         <p><b>Yes, this fails the day somebody builds a switch, and that is the point.</b>
         The decision names that day („ako sutra nastane mejl koji sme da se iskljuci, ekran
         se pravi ponovo"), so it should cost a deliberate look at this file rather than
         passing quietly. */
      const said = named.filter((name) =>
        name.split('.').some((part) => part.toLowerCase().startsWith('notif')),
      )

      expect(said, `${book} speaks of notifications again`).toEqual([])
    }
  })

  it('hands the screens a session with nothing to remember a switch in', async () => {
    renderAt('/sr/podesavanja', 'competitor', ME, undefined, undefined, <WhatTheSessionHolds />)

    const held = (await screen.findByTestId('session-keys')).textContent?.split(' ') ?? []

    /* THAT THE SESSION WAS READ AT ALL, and the count is here because naming `notify` alone
       was not enough: a first draft asserted only that, and a mutation replacing the whole
       read with the literal `['notify']` SATISFIED IT AND PASSED - the floor was answered by
       the very thing it was meant to catch. The real session hands down ninety-eight names,
       so a stub would have to reproduce the portal to get past this, while any honest read
       clears it by a wide margin. `notify` is still named because it is the neighbour that
       stays: it writes a line into the inbox and is a switch over nothing. */
    expect(held.length, 'the session was not read').toBeGreaterThan(20)
    expect(held, 'the session was not read').toContain('notify')

    /* The pair the panel kept its state in. It went with the panel, and there is no server
       preference left to keep in step with: V48 drops the six bell switches and their route
       (PDL, 29.09.2026: „Mejla nema uopste, pa nema ni prekidaca"), so a pair like this one
       coming back would be a switch over nothing. */
    expect(held).not.toContain('notifications')
    expect(held).not.toContain('setNotification')
  })
})
