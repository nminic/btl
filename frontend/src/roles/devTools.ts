/**
 * Whether the role switch is shown.
 *
 * It exists so the member and administration flows can be walked and approved
 * before authentication is built. That is useful in local development and on
 * QA, which is behind a password and never indexed, and it must never appear
 * in production, where it would let any visitor draw an administration menu.
 *
 * QA is a production build, so `DEV` is false there. The QA image is therefore
 * built with VITE_ROLE_SWITCH=1; the production image sets nothing.
 */
export function roleSwitchEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ROLE_SWITCH === '1'
}
