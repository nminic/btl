import { useState } from 'react'

/**
 * A labelled value with a button that copies it, and a confirmation that says whether
 * the copy actually worked.
 *
 * Pulled out of `pages/member/Membership.tsx` on 27.09.2026, the day a second value
 * needed the same button (the referral link had it since 26.09.2026; the PayPal
 * address, amount and note needed it next, PR 385 round 2). One copy of the shape
 * rather than four, so the fix this file already carries cannot be applied to one of
 * the four and missed on the other three.
 *
 * **The fix, said once here rather than four times at each call site.** The
 * confirmation used to be `.visually-hidden` - present for a screen reader and clipped
 * to a pixel for everyone else - which was the right shape for `admin/AdminPricing.tsx`
 * (a table cell changes where a sighted reader is already looking, and the hidden
 * region only adds the sentence that says so) and the wrong one here: pressing this
 * button changes nothing else on the screen, so a sighted member who pressed it and
 * saw nothing had no way to tell a copy that succeeded from one the browser silently
 * refused, and on failure believed the value was on their clipboard when it was not.
 * `member__note` is a plain, visible paragraph; `aria-live="polite"` stays, so a screen
 * reader still hears it, and the region is present from the first render and empty
 * until pressed, so the first real change is not the region's own first mount - a live
 * region that only exists once there is something to say can miss saying it.
 *
 * Text and not a key: this component does not read the dictionary, so its own tests
 * can pass it plain strings without an `I18nProvider` around them, and the caller
 * stays the one place that decides what language a member reads.
 */
export function CopyField({
  label,
  value,
  copyButtonLabel,
  copiedMessage,
  failedMessage,
}: {
  /** What the value is, read above it. Left out where the value already reads as
   *  itself, which is the referral link's own case: the heading and the sentence
   *  above it already say what the box holds, and a label added on top of that
   *  would be the same fact said twice rather than once. */
  label?: string
  /** The text the button copies, and the text shown for a member to read or type by
   *  hand if copying does not work for them. */
  value: string
  /** The button's own name, since an icon with no name is a button a screen reader
   *  announces as just "button" (WCAG 2.2 AA). Names the FIELD rather than the action
   *  alone ("Copy the payment amount" and not "Copy"), because a member tabbing
   *  through several of these buttons hears only the name and never the label beside
   *  it. */
  copyButtonLabel: string
  /** Said once the value is actually on the clipboard. */
  copiedMessage: string
  /** Said when the browser refuses or has no clipboard to copy through - a rejected
   *  promise either way, and both get a sentence rather than silence. */
  failedMessage: string
}) {
  const [status, setStatus] = useState('')

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      setStatus(copiedMessage)
    } catch {
      setStatus(failedMessage)
    }
  }

  return (
    <>
      {label !== undefined && <p className="member__note">{label}</p>}
      <p className="pay__payload">
        <span className="pay__link">{value}</span>
        <button
          type="button"
          className="copyLink"
          aria-label={copyButtonLabel}
          onClick={() => {
            void copy()
          }}
        >
          <svg
            className="copyLink__icon"
            viewBox="0 0 20 20"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" />
            <path d="M4.5 12.5h-1a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1" />
          </svg>
        </button>
      </p>
      <p aria-live="polite" className="member__note">
        {status}
      </p>
    </>
  )
}
