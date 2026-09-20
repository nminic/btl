import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ACCOUNT_ROUTES, FOOTER_ROUTES, NAV } from './routes'

/**
 * THE ADDRESS IN A POSTED MESSAGE HAS TWO HOMES, AND THIS IS THE FLOOR BETWEEN THEM.
 *
 * `WhatTheMessageSays.Message` hangs a path on the portal's own address and posts it, so
 * every message already in somebody's mailbox carries that exact path. The screen that
 * answers on it lives here, in `routes.ts`. Neither side reads the other, and the comment
 * beside those two routes says only that they are "not ours to rename" - a sentence, not a
 * guard.
 *
 * MEASURED BEFORE THIS CASE WAS WRITTEN, on review of PR 317: renaming
 * `SET_A_NEW_PASSWORD` to a path the portal does not serve left
 * `WhatTheMessageSaysTest`, `HowLongALinkLastsMatchesTheSchemaTest`, `PasswordResetApiTest`,
 * `ModeratorWriteApiTest` and `EmailConfirmationApiTest` green - `Tests run: 124,
 * Failures: 0`. The mail still goes out, the reader still clicks, and `navigation.test.tsx`
 * documents what he then gets: an address the portal has no screen for lands on the FRONT
 * PAGE. No error, no sentence, and an invitation that is quietly dead.
 *
 * NOTHING IS LISTED HERE. The paths come out of the Java file itself, so a third message
 * added tomorrow is measured the day it arrives. The shape is the one this same branch
 * already uses twice - `passwordRule.test.ts` reads `PasswordPolicy.SHORTEST` and
 * `refusals.test.ts` reads the refusal names - so no new machinery is introduced.
 *
 * WHAT IT CLAIMS is only that a route with that path EXISTS. Whether that screen does the
 * right thing with the token is what `newPassword.test.tsx` and `confirmAddress.test.tsx`
 * measure, and they stay the place for it.
 */
describe('every address the server posts in a message', () => {
  const messageJava = () =>
    readFileSync(
      join(
        process.cwd(),
        '..',
        'backend',
        'src',
        'main',
        'java',
        'com',
        'btl',
        'portal',
        'domain',
        'mail',
        'WhatTheMessageSays.java',
      ),
      'utf-8',
    )

  /* Every enum member carries its path as the second argument:
     NAME("key", "/path", Duration.ofHours(n)). Read off the declaration rather than
     from a list, which is the whole point of this case. */
  const pathsThePortalPosts = (java: string) =>
    [...java.matchAll(/^\s*[A-Z_]+\("[^"]+",\s*"(\/[^"]*)"/gm)].map((found) => found[1])

  const everyPath = () =>
    [...NAV.flatMap((section) => [section, ...(section.children ?? [])]), ...ACCOUNT_ROUTES, ...FOOTER_ROUTES]
      .map((route) => `/${route.path}`)

  it('is read off the Java that posts it, not off a list kept by hand', () => {
    const posted = pathsThePortalPosts(messageJava())

    expect(
      posted,
      'WhatTheMessageSays no longer declares its members the way this reads them, so the'
        + ' addresses in posted messages are held to nothing at all',
    ).not.toHaveLength(0)
  })

  it('has a screen on this portal', () => {
    const known = everyPath()

    for (const posted of pathsThePortalPosts(messageJava())) {
      expect(
        known,
        `WhatTheMessageSays posts ${posted}, and no route on this portal answers there.`
          + ' Every message already sent carries that address; a reader who clicks it lands'
          + ' on the front page with nothing said, so the invitation is dead and silent.',
      ).toContain(posted)
    }
  })
})
