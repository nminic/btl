/* Line icons for the header and for the buttons of the editor of a text, drawn
 * rather than loaded: no request, no licence, and they take the colour of whatever
 * they sit in. Each is hidden from a screen reader, because the button it stands
 * in carries the name (`components/markdownEditor/MarkdownEditor.tsx`). */

type IconProps = { className?: string }

function Stroke({ className, children }: IconProps & { children: React.ReactNode }) {
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
    >
      {children}
    </svg>
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
