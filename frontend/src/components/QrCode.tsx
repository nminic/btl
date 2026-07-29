import qrcode from 'qrcode-generator'
import './QrCode.css'

/* Draws whatever text it is given as a QR code, in SVG.
 *
 * SVG rather than a canvas or an image: it stays sharp at any size, it prints
 * cleanly on a payment slip, and it needs no request. The encoder picks its own
 * version, so the same component handles the short IPS payload and the longer
 * EPC one without being told which is which.
 *
 * Error correction is set to M. A payment code is usually read off a screen or
 * a clean print rather than a crumpled page, and M keeps the pattern coarse
 * enough for a phone camera to catch quickly.
 */
export function QrCode({ text, label, size = 180 }: { text: string; label: string; size?: number }) {
  const code = qrcode(0, 'M')
  code.addData(text)
  code.make()

  const cells = code.getModuleCount()
  // One module of quiet zone on each side; the standard asks for four, and the
  // border around the figure supplies the rest visually.
  const span = cells + 2

  const path: string[] = []
  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      if (code.isDark(row, column)) {
        path.push(`M${column + 1} ${row + 1}h1v1h-1z`)
      }
    }
  }

  return (
    <svg
      className="qr"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#ffffff" />
      <path d={path.join('')} fill="#000000" />
    </svg>
  )
}
