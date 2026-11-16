/* Line icons for the header, for the buttons of the editor of a text and for the
 * buttons that act on one thing, drawn rather than loaded: no request, no licence,
 * and they take the colour of whatever they sit in. Each is hidden from a screen
 * reader, because the button it stands in carries the name
 * (`components/markdownEditor/MarkdownEditor.tsx`, `components/ActionButton.tsx`). */

import type { ActionSymbol } from './actionSymbol'
import type { NavSymbol } from './navSymbol'

type IconProps = { className?: string }

function Stroke({
  className,
  symbol,
  children,
}: IconProps & { symbol?: ActionSymbol | NavSymbol; children: React.ReactNode }) {
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
  /* The envelope the header's messages carry (`MailIcon` below), drawn the same, so a letter looks
     like one letter wherever the portal shows it. */
  envelope: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M3 7l9 6 9-6" />
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

/** What each symbol of the header is drawn with (`app/navSymbol.ts`), on the same grid of 24. */
const NAV_DRAWN: Record<NavSymbol, React.ReactNode> = {
  /* Two people: the one in front whole, the one behind showing only the edge of his head and of his
     shoulder past the first. */
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20.5a6.5 6.5 0 0 1 13 0" />
      <path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18 14.2a6.5 6.5 0 0 1 3.5 6.3" />
    </>
  ),
  /* Three rows, and in front of each its place: a one, a two and a three. */
  ranking: (
    <>
      <path d="M11 6h10M11 12h10M11 18h10" />
      <path d="M4 4.5l1.5-1v5" />
      <path d="M3.5 10.6a1.5 1.5 0 0 1 2.9.6c0 1-2.9 2.3-2.9 3.3h3" />
      <path d="M3.5 17h3l-1.6 1.8a1.6 1.6 0 1 1-1.4 2.4" />
    </>
  ),
  /* A podium: the middle step highest, the left one lower and the right one lowest. */
  steps: (
    <>
      <path d="M3 20.5V13h6V8h6v7h6v5.5z" />
      <path d="M9 13v7.5M15 15v5.5" />
    </>
  ),
  /* A cup with two handles, on its stem and its foot. */
  trophy: (
    <>
      <path d="M7 3.5h10v5.5a5 5 0 0 1-10 0z" />
      <path d="M7 5.5H4.5a3 3 0 0 0 3 4.5M17 5.5h2.5a3 3 0 0 1-3 4.5" />
      <path d="M12 14v3.5M8 20.5h8M9.5 17.5h5" />
    </>
  ),
  /* A sheet of a calendar: the page, the line under its head and the two rings it hangs from. */
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  /* Three sliders standing up, each knob at its own height. */
  sliders: (
    <>
      <path d="M6 3.5v4.5M6 12v8.5M12 3.5v9M12 16.5v4M18 3.5v1.5M18 9v11.5" />
      <circle cx="6" cy="10" r="2" />
      <circle cx="12" cy="14.5" r="2" />
      <circle cx="18" cy="7" r="2" />
    </>
  ),
  /* An arrow from the left going in through the door at the right. */
  signIn: (
    <>
      <path d="M14 3.5h4.5a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H14" />
      <path d="M3.5 12h10M10 8l4 4-4 4" />
    </>
  ),
  /* A person, and the plus of somebody joining beside him. */
  join: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20.5a6.5 6.5 0 0 1 13 0" />
      <path d="M19 8v6M16 11h6" />
    </>
  ),
}

/** One of the symbols of the header, drawn. It carries no name: the link or the button it stands in
 *  carries the word (owner, 16.11.2026, answer 5: „reč ostaje ime za čitač ekrana”). */
export function NavSymbolIcon({ of, className }: IconProps & { of: NavSymbol }) {
  return (
    <Stroke className={className} symbol={of}>
      {NAV_DRAWN[of]}
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
