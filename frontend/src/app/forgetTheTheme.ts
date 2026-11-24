/**
 * THE CHOICE OF A THEME THAT NO LONGER EXISTS, TAKEN OUT OF THE BROWSER.
 *
 * <p>The portal has one theme, the dark one, since 24.11.2026 (owner, PDL „Portal ima samo tamnu temu;
 * svetla se izbacuje": „Da, izbaci"). Until that day a member could choose the light one in his settings,
 * and the choice was kept in `localStorage` under this name. Nothing reads it any more, so a reader who
 * chose light is drawn dark like everybody else whether it is there or not.
 *
 * <p><b>Taken out rather than left behind</b>, the way the gold strip takes its own mark out of the
 * browser on the day the strip stops being shown (`app/NoticeBar.tsx`, `forgetIt`): a browser should not
 * keep a note about a choice that no longer exists. It is asked on every start and costs nothing once the
 * key is gone. Inside a `try`, as every touch of the store is in that strip: a browser told not to keep
 * site data throws on the very first access, and that is no reason for the portal not to start.
 */
export const THE_OLD_THEME_KEY = 'btl-theme'

export function forgetTheChosenTheme(where: Pick<Window, 'localStorage'>): void {
  try {
    where.localStorage.removeItem(THE_OLD_THEME_KEY)
  } catch {
    /* Nothing to take out of a store that cannot be reached. */
  }
}
