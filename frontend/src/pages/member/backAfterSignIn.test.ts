import { describe, expect, it } from 'vitest'
import { TEAM_DELETED } from '../teamDeleted'
import { backAfterSignIn, cameFrom } from './backAfterSignIn'

/**
 * WHERE THE SIGN IN PAGE SENDS A READER BACK TO (owner, 07.11.2026, PDL „Prijava vraća čitaoca na adresu sa
 * koje je došao”): „ali samo na adrese portala (bez preusmerenja na tuđe sajtove)".
 *
 * <p><b>THE AXES</b>: an address of the portal, with a query and a part after `#`, or without; an address of
 * another host, written each way a browser reads as one (a scheme, two slashes, a backslash, a tab or a
 * newline between the slashes, an address the parser refuses); an address that is not a path at all; the
 * sign in page itself in either language; and a state that carries nothing, carries something else, or is
 * not an object.
 */
const ORIGIN = 'https://balkanskatrkackaliga.net'

describe('an address of the portal', () => {
  it.each([
    ['/sr/moji-podaci', '/sr/moji-podaci'],
    ['/sr/moji-podaci?x=1#slika', '/sr/moji-podaci?x=1#slika'],
    ['/en/poruke/12', '/en/poruke/12'],
    /* Read as the browser reads it, so what goes back is the path it would open. */
    ['/sr/kalendar/../moji-podaci', '/sr/moji-podaci'],
  ])('sends him back to %s', (said, back) => {
    expect(backAfterSignIn(cameFrom(said), ORIGIN)).toBe(back)
  })

  it('hands back the path and never the host, so nothing of an origin travels on', () => {
    expect(backAfterSignIn(cameFrom('/sr/moji-podaci'), ORIGIN)).not.toContain(ORIGIN)
  })
})

describe('an address that is not one of the portal', () => {
  it.each([
    'https://zlo.example/sr/moji-podaci',
    '//zlo.example',
    '//zlo.example/sr/moji-podaci',
    '/\\zlo.example',
    '/\\/zlo.example',
    '/\t/zlo.example',
    '/\n/zlo.example',
    '//[',
    'javascript:alert(1)',
    'moji-podaci',
    '',
  ])('sends him nowhere back from %j', (said) => {
    expect(backAfterSignIn(cameFrom(said), ORIGIN)).toBeNull()
  })
})

describe('the sign in page itself', () => {
  it.each(['/sr/prijava', '/en/prijava', '/sr/prijava/', '/sr/prijava?x=1'])('is no way back: %s', (said) => {
    expect(backAfterSignIn(cameFrom(said), ORIGIN)).toBeNull()
  })

  it('is told apart from an address that only begins with its name', () => {
    expect(backAfterSignIn(cameFrom('/sr/prijava-za-trku'), ORIGIN)).toBe('/sr/prijava-za-trku')
  })
})

describe('a state that carries no address', () => {
  it.each([
    ['nothing at all', null],
    ['no state', undefined],
    ['a word', 'nesto'],
    ['the word of another screen', TEAM_DELETED],
    ['an address that is not text', { signInBack: 5 }],
  ])('sends him nowhere back: %s', (_what, state) => {
    expect(backAfterSignIn(state, ORIGIN)).toBeNull()
  })
})
