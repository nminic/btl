import { useState } from 'react'
import type { ReactNode } from 'react'
import { cropIn, frameOf, holeOf, UNKNOWN } from './crop'
import type { Crop, Shape } from './crop'
import { useI18n } from '../i18n/useI18n'
import './Crop.css'

/**
 * A picture with the chosen square lit and everything else still visible.
 *
 * Owner, 12.08.2026: „Korisnik treba da može da sačuva kropovan format ali da se
 * nazire ispod u njegovim podešavanjima i ono što se neće videti, a
 * Administrator kad odobrava i timsku sliku (unutar odobravanja tima) i profilnu
 * sliku učesnika (kad se prijavljuje profil ili menja slika) treba da vidi isto
 * fokus na vidljiv deo slike i zatamnjen ali dovoljno vidljiv ostatak."
 *
 * The rest dimmed and not the rest removed, which is the whole of what he asked
 * for and is the opposite of what a cropping tool usually leaves behind. A
 * moderator looking at a face cut out of a photograph cannot tell whether the
 * member cropped out somebody else's child, a competitor's number, or nothing at
 * all; a member cannot tell what they lost. Shown whole, with the square lit,
 * both questions answer themselves without a second control.
 *
 * The same component on both screens, deliberately. „Isto" in his sentence is
 * the requirement: what the member arranges is what the moderator judges, and
 * two components drawing the same three numbers is two chances to draw them
 * differently.
 */
export function CropWindow({ picture, crop, alt, children }: {
  /** The picture itself. In the prototype this is what the browser read off the
   *  member's own disc; after F5 it is a path, and nothing here changes. */
  picture: string
  crop: Crop
  /** What the picture is of, for anybody who cannot see it. Never guessed and
   *  never a file name: a moderator hearing „slika-1.jpg" learns nothing, and
   *  the caller is the only one who knows whose face this is. */
  alt: string
  /** The sliders, on the screen where the crop is being chosen rather than
   *  looked at. They sit under the picture inside the same group so that what
   *  moves and what is moved are one thing to a screen reader. */
  children?: ReactNode
}) {
  const { t } = useI18n()
  /* What the browser knows about the file, which is nothing until it has
     actually read one. Held here rather than asked of the caller because only
     the browser can answer it, and answered late: a photograph arrives after
     the first drawing either way. */
  const [shape, setShape] = useState<Shape>(UNKNOWN)
  /* The same check, for the same reason: what a waiting item carries came out
     of a file on this portal today and out of a database tomorrow. */
  const frame = frameOf(cropIn(crop), shape)
  const hole = holeOf(frame)

  return (
    <div className="crop">
      <div className="crop__picture" style={{ aspectRatio: `${shape.width} / ${shape.height}` }}>
        <img
          className="crop__whole"
          src={picture}
          alt={alt}
          onLoad={(event) => {
            /* Both or neither. A picture that failed to decode reports nought
               for each, and a box of nought height collapses to a line with a
               frame drawn over nothing. */
            const { naturalWidth, naturalHeight } = event.currentTarget

            if (naturalWidth > 0 && naturalHeight > 0) {
              setShape({ width: naturalWidth, height: naturalHeight })
            }
          }}
        />

        {/* The shade, as a sheet over the whole picture with the circle cut out
            of it. A sheet has no corners to miss, which is the whole reason it
            is a sheet: the shade used to spread out of the frame itself, and a
            shadow's corners are rounded by the radius plus the spread, so the
            moment the frame became a circle the corners of a tall picture were
            left with no shade at all (`holeOf` in components/crop.ts carries the
            measurement).

            What shows through the hole is the photograph itself rather than a
            second copy of it laid over the first, exactly as before: nothing can
            drift out of register, and the file is downloaded once. */}
        <span
          className="crop__shade"
          aria-hidden="true"
          style={{
            maskImage: `radial-gradient(ellipse ${hole.across} ${hole.down} at ${hole.x} ${hole.y}, transparent 99.5%, #000 100%)`,
          }}
        />

        {/* And the edge of what is kept, so the boundary is a line and not only
            a change of brightness.

            Said out loud as well as drawn, because dimming is a colour and a
            curve is a curve, and neither is anything at all to a screen
            reader. */}
        <span
          className="crop__frame"
          style={{
            insetInlineStart: frame.left,
            insetBlockStart: frame.top,
            inlineSize: frame.width,
            blockSize: frame.height,
          }}
        >
          <span className="visually-hidden">{t('crop.framed')}</span>
        </span>
      </div>

      {children}
    </div>
  )
}
