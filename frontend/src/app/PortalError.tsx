import { useI18n } from '../i18n/useI18n'

/* The portal's own answer to a failure, in the place of the screen. It is drawn by the router's own
 * boundary (`ErrorBoundary: PortalError` on the group of screens in `app/routeObjects.tsx`) for a screen of
 * that group whose piece never arrived or whose drawing threw, and by the `ErrorBoundary` around the outlet
 * in `Shell.tsx` for an error thrown while a screen outside the group, the front page, is drawn. One
 * element, so the two cannot come to say different things. */
export function PortalError() {
  const { t } = useI18n()

  return (
    <div role="alert">
      <h1>{t('error.title')}</h1>
      <p>{t('error.text')}</p>
    </div>
  )
}
