/**
 * Whether the development controls are drawn: the role switch, and the switch
 * that moves the day the portal thinks it is.
 *
 * Both exist for the same reason, and the first half of it changed on 20.09.2026.
 * This said „the flows have to be walked and approved before there is any
 * authentication to reach them with"; there is authentication now (`/api/sign-in`,
 * and a real session sets the role through the same `become` the switch calls).
 * It then said what keeps the switch is the MEMBER NUMBER rather than the want of a sign
 * in - every screen behind these roles draws a member, and a real session carried no
 * number to draw one by - and before that it said „the mock", until 21.09.2026.
 * **Both are spent: on 24.09.2026 `session/theServer.ts` began reading the number off
 * `GET /api/me`, so a real session names a member and those screens draw him.** What is
 * left of the reason is a question rather than an answer, and `roles/RoleSwitch.tsx`
 * carries it in full so there is one home for it.
 *
 * The second half is untouched. Half of what the portal does depends on the date:
 * registration opens on 15 October, the price changes three times, renewal only
 * opens inside its window, the calendar opens on the first month still ahead. None
 * of that can be looked at on the day it is being built without moving the clock.
 *
 * That is useful in local development and on QA, which is behind a password and
 * is never indexed, and it must never appear in production. There the role
 * switch would let any visitor draw themselves an administration menu, and the
 * date would let them read a portal that says things which are not yet true.
 *
 * QA is a production build, so `DEV` is false there. The QA image is therefore
 * built with VITE_DEV_TOOLS=1 (deploy/compose.qa.yml); production sets nothing.
 *
 * The value has to be exactly `1`. Not "true", not "yes": anything else leaves
 * the controls off, which is the safe way round to be wrong but is a confusing
 * hour on QA if nobody says so.
 */
export function devToolsEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === '1'
}

/**
 * THE SAME ANSWER, FIXED WHEN THE BUNDLE IS BUILT, AND IT IS THE ONLY ONE OF THE TWO THE
 * BUNDLER CAN DELETE WHAT STANDS BEHIND.
 *
 * <p><b>Measured 09.10.2026, on the production bundle of `9791aae4`:</b> both switches were
 * in it, with their stylesheets and the name of the slot the day is kept in. Built with and
 * without `VITE_DEV_TOOLS`, the two bundles were the same length and differed in ONE byte,
 * the body of `devToolsEnabled` above (`return!1` against `return!0`). A function is not
 * inlined into whoever calls it, so everything behind a call to it went to production
 * switched off rather than left out - which is what ADL A15 (01.08.2026) refuses in as many
 * words: „Gašenje nije isto što i brisanje ... ugašena kontrola je i dalje kod koji putuje u
 * paketu skripti". A constant is inlined, and a branch behind `false` is dropped.
 *
 * <p><b>Spelt out again rather than written as a call to the function, and that is
 * measured too:</b> written as `devToolsEnabled()` the constant is a call like any other
 * and nothing behind it goes. The function stays because it is asked at the moment of
 * drawing, which is what lets a case move the environment under a component already
 * imported; the two are one rule, and `tools.test.ts` holds that they answer the same for
 * every way a build can be asked.
 */
export const DEV_TOOLS_IN_THIS_BUILD: boolean =
  import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === '1'

/**
 * THE TWO DEVELOPMENT CONTROLS, FOR A BUILD THAT CARRIES THEM, AND NOTHING AT ALL FOR ONE
 * THAT DOES NOT.
 *
 * <p><b>Written here, beside the constant, and not in `app/Shell.tsx` where they are drawn,
 * because the bundler drops an `import()` only when the condition in front of it is known
 * in the SAME module.</b> Measured 09.10.2026 on Vite 8.1.5: the identical condition written
 * in the shell with the constant imported from here left the date switch's chunk and its
 * stylesheet in the production bundle, to be fetched by nobody; written here, or with the
 * condition spelt out in the shell itself, neither was there. Here it has one home.
 *
 * <p><b>Loaded rather than imported, because an import is a stylesheet as well.</b> A
 * switch imported normally and drawn behind the constant loses its script in production
 * and keeps its stylesheet: the import of `DateSwitch.css` is a side effect, and the bundler
 * keeps side effects of everything that is imported. Measured the same day: drawn that way,
 * the production stylesheet still named `date-switch` nine times.
 *
 * <p><b>And the place that draws them asks the constant as well as the loader's answer</b>
 * (`app/Shell.tsx`). The answer is a variable, so the bundler cannot know it is `null` where it
 * is read, and a branch behind it stays in the package with the names of both switches in it:
 * the two properties read off it are not shortened. Measured the same day, by `grep -a -o -F`
 * over the production `dist/`: `DateSwitch` once and `RoleSwitch` once until the constant stood
 * in front of the answer, none of either after.
 *
 * <p>What holds it is `productionPackage.test.ts`, which asks the bundler what it built.
 */
export const loadTheDevControls = DEV_TOOLS_IN_THIS_BUILD
  ? async () => {
      const [day, role] = await Promise.all([
        import('../clock/DateSwitch'),
        import('../roles/RoleSwitch'),
      ])

      return { DateSwitch: day.DateSwitch, RoleSwitch: role.RoleSwitch }
    }
  : null
