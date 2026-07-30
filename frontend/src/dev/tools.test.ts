import { devToolsEnabled } from './tools'

describe('devToolsEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is on in development', () => {
    vi.stubEnv('DEV', true)
    expect(devToolsEnabled()).toBe(true)
  })

  it('is on when the build asked for it, which is what QA does', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEV_TOOLS', '1')
    expect(devToolsEnabled()).toBe(true)
  })

  it('is off in a production build that did not ask for it', () => {
    /* The one that matters. With it on in production any visitor could draw
       themselves an administration menu, and read a portal that says things
       which are not true yet. */
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEV_TOOLS', '')
    expect(devToolsEnabled()).toBe(false)
  })
})
