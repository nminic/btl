import { Navigate } from 'react-router'
import { useI18n } from '../i18n/useI18n'

/**
 * An address the portal does not have sends the reader to the front page
 * (owner, 30.07.2026).
 *
 * It used to be a screen saying so, with a link back. A mistyped address is
 * almost always a typed or a copied one, and a page that says "this is not
 * here" leaves somebody looking at a dead end and deciding what to do; the front
 * page is what they would have chosen. The address that asks for a screen the
 * reader may not open ends the same way and for the same reason (Guard.tsx).
 *
 * Replaced rather than pushed, so the back button goes where they came from
 * instead of back onto the address that does not exist.
 *
 * Worth knowing, not worth changing: a search engine now meets a redirect where
 * it used to meet a page saying the address is gone, which is weaker for getting
 * a stale link dropped from an index. The portal is new and has no stale links
 * yet, and the server is where a real 404 would have to come from in any case,
 * since this is one page and every address on it is served the same file.
 */
export function NotFound() {
  const { locale } = useI18n()

  return <Navigate to={`/${locale}`} replace />
}
