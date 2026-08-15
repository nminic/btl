/**
 * Whether the visitor has said yes to the measurement that needs saying yes to.
 *
 * Two kinds of measurement run on this portal and only one of them is a question
 * (ADL A9). Umami is hosted on the league's own server, sets no cookie and builds
 * no profile of anybody, so it needs no consent and asks for none. Google
 * Analytics 4 cannot measure without cookies at all, so it is not loaded until
 * somebody says it may.
 *
 * There is a yes and there is the absence of one, and no third thing. The bar
 * carries no „Odbij sve" (PDL P8, question 368, confirmed 28.07.2026): the owner
 * decided against it, knowing what it costs, on the grounds that the first
 * season has no members resident in the EU. Closing the bar is therefore not a
 * refusal that gets written down, it is simply not a yes, and the privacy policy
 * says as much in those words: „zatvaranje trake nije pristanak."
 *
 * The consequence, which is the decision and not an oversight: somebody who
 * closes the bar meets it again on their next visit. If members from the EU
 * arrive, this comes back to the table and the cost of the change is one button
 * and one more state here.
 */

/**
 * Kept in `localStorage` and not in a cookie, deliberately.
 *
 * A consent record is itself personal data of the strictly necessary kind, and
 * the lightest way to hold it is the one that never travels: `localStorage` is
 * not sent with any request, so it cannot leak into a server log the way a
 * cookie does. The portal already keeps the chosen theme this way
 * (app/themeContext.ts).
 */
export const CONSENT_KEY = 'btl.consent'

/**
 * Whether measurement with cookies has been agreed to.
 *
 * Anything that is not the one word written by `remember` is read as „no
 * agreement", which covers the ordinary empty case and also a value somebody has
 * edited by hand. That is the safe way round to be wrong.
 */
export function consentGiven(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'yes'
}

/** A word rather than `true`, so a record read out of the store says what it
 *  means to whoever is looking at it in a browser's console. */
export function remember(): void {
  localStorage.setItem(CONSENT_KEY, 'yes')
}

/** Withdrawing, which is what „Podešavanja kolačića" in the footer does. The
 *  record goes and the bar comes back, so the withdrawal is as few clicks as the
 *  agreement was (član 15 ZZPL, član 7 GDPR). */
export function forget(): void {
  localStorage.removeItem(CONSENT_KEY)
}
