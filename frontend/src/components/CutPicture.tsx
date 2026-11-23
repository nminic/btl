import { useState } from 'react'
import { cropIn } from './crop'
import { fittedTo } from './fitted'
import './Crop.css'

/**
 * A picture in its circle, cut to the square that was chosen for it: a member's portrait, a
 * team's logo or a league's mark.
 *
 * **One component, so there is one way to cut.** Owner, 23.11.2026: „Zašto se drugačije seče i
 * prikazuje u malom i velikom krugu?????" and „Veliki krug je rezprezentativan, tako treba da
 * bude svuda." The two circles drew one record two ways: the card drew the small picture the
 * server had already cut, and the profile drew the original and cut it in the browser, inside a
 * box that was not square (`fitted.ts` has the numbers). Until this component the span and the
 * picture were written out in four places (`Portrait`, `TeamMark`, `LeagueMark` and the
 * administration's view of a member's picture), and each could have drifted on its own.
 *
 * **Which picture.** The small one when there is one and it loads: owner, 23.10.2026 (PDL,
 * „Umanjene slike za kružiće"): „Server pravi i šalje umanjenu, već isečenu sliku za kružiće
 * [...] original ostaje za profil." It is cut already, so it is drawn whole and the square is
 * not applied a second time. The original, cut here, when the caller asks for it (`small` is
 * null), or when the small one would not load: the server declines to cut a picture larger
 * than it can safely decode (`SmallPicture`), and a circle showing the original is better than
 * an empty one. The address that failed is kept as the ADDRESS and not as a flag, so a circle
 * that is handed another picture is not left thinking that one failed too.
 *
 * **The circle is the box around the picture and not the picture itself.** A crop is a
 * magnification, and magnifying an element magnifies its rounded corners with it: applied to
 * the picture, a face cropped close would grow out of its own circle and over the name beside
 * it. The clipping belongs to something that is never scaled (`Crop.css`, `.crop-fitted`).
 *
 * `width` and `height` say only „a square", so a list of faces does not jump before the
 * pictures arrive; the stylesheet of each circle decides its size. Decoration when it has no
 * alternative text of its own, because the name stands beside every circle that draws one.
 */
export function CutPicture({
  className,
  original,
  crop,
  small,
  alt = '',
  lazy,
}: {
  /** The classes of the circle itself; `crop-fitted` is added here. */
  className: string
  original: string
  /** Read through `cropIn` and not trusted: a record with no square at all is the whole picture. */
  crop: unknown
  small: string | null
  alt?: string
  /** Loaded when it comes near rather than with the page, for long lists of circles. */
  lazy: boolean
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const cut = small !== null && small !== failed ? small : null

  return (
    <span className={`${className} crop-fitted`} aria-hidden={alt === '' ? 'true' : undefined}>
      <img
        src={cut ?? original}
        alt={alt}
        width={64}
        height={64}
        loading={lazy ? 'lazy' : undefined}
        decoding="async"
        onError={cut === null ? undefined : () => setFailed(cut)}
        style={cut === null ? fittedTo(cropIn(crop)) : undefined}
      />
    </span>
  )
}
