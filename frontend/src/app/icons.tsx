/* Line icons for the header, drawn rather than loaded: no request, no licence,
 * and they take the colour of whatever they sit in. */

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
