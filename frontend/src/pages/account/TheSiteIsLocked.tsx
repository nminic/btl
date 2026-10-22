import { useId } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { wordsFor } from './serverWords'

/**
 * THE WAY OUT OF A LOCKED SITE, AS A LINK TO A NEW TAB AND NOTHING ELSE (owner, 22.10.2026,
 * `btl-produkt/ADL.md`, „portal to kaže i nudi novu karticu").
 *
 * <p>While the site is locked at the edge, a browser asks for the access word when a PAGE loads
 * and opens no window for a `fetch`. A tab that has forgotten the word is therefore answered 401
 * by the proxy on its first write, and the only thing that makes the browser ask again is a
 * NAVIGATION. A new tab is that navigation, and it leaves this one where it is, with the form
 * exactly as it was typed: the owner turned down both a refresh, which loses the form, and keeping
 * the form in the browser, because the privacy policy says the browser keeps the choice of theme and
 * nothing else. <b>Nothing here is written anywhere</b>; the form survives because this page stays
 * open (`theSiteIsLocked.test.tsx` sweeps the places a value could land).
 *
 * <p><b>The address is the portal's front page in the reader's language, never the address he is on.</b>
 * The screens that take a link out of a message (`ConfirmAddress`, `NewPassword`) carry a token in
 * theirs that is spent when it is read, and a second tab opened on the same address would read it
 * again. The front page carries nothing to spend, asks the proxy for the word like any other page
 * would, and once the browser has it, it is sent with this tab's next request too.
 *
 * <p>`rel="noopener"`, so the new tab gets no handle on this one. The words are the owner's:
 * „Otvori u novoj kartici".
 *
 * @param describedBy the id of the sentence this stands under, where there is one on the screen, so
 *                    that the link is read with what it is for and not on its own (WCAG 2.2 SC 2.4.4)
 */
export function NewTabForTheAccess({ describedBy }: { describedBy?: string }) {
  const { locale, t } = useI18n()

  return (
    <p>
      <a
        className="button button--secondary"
        href={`/${locale}`}
        target="_blank"
        rel="noopener"
        aria-describedby={describedBy}
      >
        {t('server.lockedOpen')}
      </a>
    </p>
  )
}

/**
 * WHAT AN ANSWER OF „THE SITE IS LOCKED" IS DRAWN AS: the owner's sentence as an alert, and the
 * link to a new tab under it. The one home for both, because two screens draw an answer by name
 * (`ServerSaid`, and `WhatTheServerSaid` in the queues of administration) and a copy would be a
 * second place for a sentence that has to be word for word the owner's. <b>The sentence itself is
 * asked of `wordsFor`</b>, where every other sentence an answer gets is chosen, so the key is held in
 * one module (`serverWords.test.ts` reads that off the parser).
 *
 * <p>`role="alert"` like every other sentence of this kind (`field__error`): a press has already
 * happened, and an answer nobody is told about is a reader looking at a form that did nothing
 * (WCAG 2.2 SC 4.1.3).
 */
export function TheSiteIsLocked() {
  const { t } = useI18n()
  const sentence = useId()

  return (
    <>
      <p id={sentence} className="field__error" role="alert">
        {wordsFor({ got: 'locked' }, {}, t)}
      </p>
      <NewTabForTheAccess describedBy={sentence} />
    </>
  )
}
