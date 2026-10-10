import { must } from '../test/at'
import { DEV_TOOLS_IN_THIS_BUILD, devToolsEnabled, loadTheDevControls } from './tools'

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

/* The constant is the same rule as the function, spelt out a second time so the bundler can
   see it (dev/tools.ts). Two spellings of one rule are two homes, and this is what keeps them
   one: for every way a build can be asked, the module is read afresh under that environment
   and the two have to agree - with each other, and with the answer written here, so that two
   spellings wrong in the same way do not agree their way through. */
describe('the same answer, fixed when the bundle is built', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it.each([
    { build: 'production', dev: false, flag: '', on: false },
    { build: 'QA', dev: false, flag: '1', on: true },
    { build: 'one whose flag is not exactly 1', dev: false, flag: 'true', on: false },
    { build: 'development', dev: true, flag: '', on: true },
  ])('agrees with the function in a $build build', async ({ dev, flag, on }) => {
    vi.stubEnv('DEV', dev)
    vi.stubEnv('VITE_DEV_TOOLS', flag)
    vi.resetModules()

    const fresh = await import('./tools')

    expect(fresh.DEV_TOOLS_IN_THIS_BUILD).toBe(on)
    expect(fresh.devToolsEnabled()).toBe(on)
    /* And the controls exist exactly where the constant says: in a build without them there
       is nothing to load, not a loader that answers nothing. */
    expect(fresh.loadTheDevControls === null).toBe(!on)
  })
})

describe('loadTheDevControls', () => {
  it('hands out the two switches the header draws, and not copies of them', async () => {
    /* This suite is a development build, so the constant is on and the loader is there. */
    expect(DEV_TOOLS_IN_THIS_BUILD).toBe(true)

    const controls = await must(loadTheDevControls, 'the loader of a development build')()

    expect(controls.DateSwitch).toBe((await import('../clock/DateSwitch')).DateSwitch)
    expect(controls.RoleSwitch).toBe((await import('../roles/RoleSwitch')).RoleSwitch)
  })
})
