import { loadTheDevControls } from '../dev/tools'

/** The two development controls, as the loader in `dev/tools.ts` hands them out. */
export type DevControls = Awaited<ReturnType<NonNullable<typeof loadTheDevControls>>>

let loaded: DevControls | null = null

/**
 * THE TWO DEVELOPMENT CONTROLS, LOADED BEFORE THE PORTAL IS FIRST DRAWN, AND BY THE ONE WHO DRAWS IT
 * (`main.tsx`), NOT BY A MODULE THAT IS WAITED FOR.
 *
 * <p><b>Why not a top-level `await`, which is what `app/Shell.tsx` had until 25.11.2026.</b> On QA, the one
 * build that carries the controls, the page stayed blank: no error in the console and no request to the
 * server. Measured the same day on a clean `origin/main` (`8404e35e`), built with `VITE_DEV_TOOLS=1` and run
 * in headless Chromium and in Node: the import of the entry never finished. Since 22.11.2026 every module
 * `main.tsx` reaches by a static import is cut into one piece, `portal` (`vite.config.ts`), so the shell and
 * its `await` were in that piece; and the piece of each switch imports the portal's own modules (the clock,
 * the role, the session) from it. A module that awaits the import of a module that imports it waits for
 * itself: the language says so, not the bundler, and a top-level `await` anywhere in that piece on the two
 * switches does the same, `main.tsx` included. Whether it happens depends on how the bundle is cut (the
 * `await` stood since 10.10.2026, #499, and the piece came on 22.11.2026, #794), which is why it is not
 * answered by cutting it differently.
 *
 * <p><b>So the wait is a promise the entry keeps, and drawing starts when it is kept.</b> Nothing is drawn
 * before the controls are here, which is what the `await` was for: a control that arrived after the first
 * paint would shift the row of tools under the reader's pointer, and on QA that row is the header of every
 * screen. In a build that carries no controls the loader is `null` and nothing is waited for.
 *
 * <p><b>And a failure to load them is not a failure of the portal (PENDING 28870).</b> When the import of
 * either switch is refused (a piece the server no longer holds after a deploy, a connection that dropped
 * while it was fetched), the portal is drawn without them, which is how it already reads in a build that has
 * none, and the failure is said once in the console, the way `ErrorBoundary` says what it caught. It is
 * `null` for either switch failing, because the two come from one `Promise.all` (`dev/tools.ts`) and a header
 * with one of the two would be a row that changes shape under the reader's pointer.
 *
 * <p>What holds it: `dev/productionPackage.test.ts` runs the QA package it builds and asks that it draws both
 * switches in its first paint, and `app/devControlsThatFailToLoad.test.tsx` the failure.
 */
export async function loadTheDevControlsBeforeDrawing(): Promise<void> {
  if (loadTheDevControls === null) {
    return
  }

  loaded = await loadTheDevControls().catch((failure: unknown) => {
    console.error('The development controls did not load, so the header is drawn without them', failure)

    return null
  })
}

/** The two controls `loadTheDevControlsBeforeDrawing` brought, or `null` in a build without them or when they failed. */
export function theDevControls(): DevControls | null {
  return loaded
}
