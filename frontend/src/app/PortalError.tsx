import { useI18n } from '../i18n/useI18n'

/* The portal's own answer to a failure, in the place of the screen: the one the boundary around the
 * outlet draws for an error thrown while a screen is drawn (`Shell.tsx`), and the one a route draws as its
 * `errorElement` for a screen whose piece never arrived (`app/screens.tsx`). One element, so the two
 * cannot come to say different things. */
export function PortalError() {
  const { t } = useI18n()

  return (
    <div role="alert">
      <h1>{t('error.title')}</h1>
      <p>{t('error.text')}</p>
    </div>
  )
}
