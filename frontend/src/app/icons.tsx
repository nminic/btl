/* Line icons for the header, for the buttons of the editor of a text and for the
 * buttons that act on one thing, drawn rather than loaded: no request, no licence,
 * and they take the colour of whatever they sit in. Each is hidden from a screen
 * reader, because the button it stands in carries the name
 * (`components/markdownEditor/MarkdownEditor.tsx`, `components/ActionButton.tsx`). */

import type { ActionSymbol } from './actionSymbol'

type IconProps = { className?: string }

function Stroke({
  className,
  symbol,
  children,
}: IconProps & { symbol?: ActionSymbol; children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      /* Which symbol this is, for whoever has to tell one from another without
         looking at the drawing: a test, or somebody reading the page in the
         browser's inspector. Nothing reads it to a visitor, and the icons above
         the action symbols leave it out. */
      data-symbol={symbol}
    >
      {children}
    </svg>
  )
}

/** What each symbol is drawn with, on the grid of 24 every icon here uses. */
const DRAWN: Record<ActionSymbol, React.ReactNode> = {
  /* A pencil lying from the lower left to the upper right, and the line it draws. */
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  cross: <path d="M18 6L6 18M6 6l12 12" />,
  /* The two sheets the copy button has drawn since 26.09.2026
     (`components/CopyField.tsx`), on its grid of 20 brought over to this one of 24:
     every coordinate times 1.2, so the shape is the one members already know. */
  copy: (
    <>
      <rect x="9" y="9" width="10.8" height="10.8" rx="1.8" />
      <path d="M5.4 15H4.2A1.2 1.2 0 0 1 3 13.8V4.2A1.2 1.2 0 0 1 4.2 3h9.6A1.2 1.2 0 0 1 15 4.2v1.2" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  /* An arrow pointing back the way a thing came. */
  back: <path d="M19 12H5M12 19l-7-7 7-7" />,
  /* An arrow that turns back on itself: what was done is taken back. */
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  /* A banknote: the sheet, the coin in its middle and a point at each end. */
  banknote: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 12h.01M17.5 12h.01" />
    </>
  ),
  down: <path d="M6 9l6 6 6-6" />,
  up: <path d="M18 15l-6-6-6 6" />,
  /* A circle that is not closed, with the head of an arrow where it opens: sent
     round once more. */
  again: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </>
  ),
}

/** One of the action symbols, drawn. */
export function ActionSymbolIcon({ of, className }: IconProps & { of: ActionSymbol }) {
  return (
    <Stroke className={className} symbol={of}>
      {DRAWN[of]}
    </Stroke>
  )
}

export function MailIcon({ className }: IconProps) {
  return (
    <Stroke className={className}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M3 7l9 6 9-6" />
    </Stroke>
  )
}

/** A list: three points, each with its line. */
export function ListIcon({ className }: IconProps) {
  return (
    <Stroke className={className}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </Stroke>
  )
}

/** A link: two links of a chain. */
export function LinkIcon({ className }: IconProps) {
  return (
    <Stroke className={className}>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </Stroke>
  )
}
