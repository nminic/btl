import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { aimAt, closestIn, cropIn, frameOf, holeOf, movedTo, sizedTo, UNKNOWN } from './crop'
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
export function CropWindow({ picture, crop, alt, children, onChange }: {
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
  /**
   * Where a drag on the picture is sent, on the screen where the crop is being
   * chosen rather than looked at.
   *
   * Owner, 23.08.2026: „krug se pomera prstom na telefonu i tabletu, mišem na
   * velikom ekranu", and „povlačenjem ivice krug se širi ili sužava".
   *
   * **Added beside the sliders and not instead of them.** The sliders were
   * written that way on purpose: a drag handle cannot be operated from a
   * keyboard, has no value to read out and fights the scroll of the page it sits
   * in, while a range control takes arrows, Home and End and announces itself
   * (WCAG 2.2 SC 2.1.1 and 4.1.2, and the rule about full keyboard navigation in
   * `CLAUDE.md`). Dragging is what a pointer is good at, so the picture answers a
   * pointer and the sliders answer everything else. Both write the same three
   * numbers.
   *
   * Missing where the crop is only being looked at, and then nothing on the
   * picture listens at all: a moderator reading a member's choice has nothing to
   * drag.
   */
  onChange?: (crop: Crop) => void
}) {
  const { t } = useI18n()
  /* What the browser knows about the file, which is nothing until it has
     actually read one. Held here rather than asked of the caller because only
     the browser can answer it, and answered late: a photograph arrives after
     the first drawing either way. */
  const [shape, setShape] = useState<Shape>(UNKNOWN)
  /* The same check, for the same reason: what a waiting item carries came out
     of a file on this portal today and out of a database tomorrow. */
  const held = cropIn(crop)
  const frame = frameOf(held, shape)
  const hole = holeOf(frame)
  /* Which of the two a press began, held for as long as it lasts. A press decides
     once, at the moment it lands: deciding again on every move would turn a drag
     that starts on the edge into a move the instant the circle catches up with
     the finger. */
  const doing = useRef<'moving' | 'sizing' | null>(null)
  /**
   * What the pointer looks like over this picture, which is nine answers rather
   * than one and so cannot be a line in the stylesheet.
   *
   * Owner, 29.08.2026: „Kad je miš unutar kruga, pointer se pretvara u ruku",
   * and „Kad je miš na samoj ivici kruga, pointer se pretvara u strelice za
   * razvlačenje." Which of the two, and which way the arrows point, depends on
   * where in the picture the pointer is and on how big the circle is at that
   * moment, so it is a piece of state and not a declaration: `Crop.css`
   * deliberately says nothing about the cursor.
   *
   * State rather than a value written straight onto the element, because React
   * is what owns that attribute; and cheap, because setting a state to the value
   * it already holds is refused before anything is drawn again, and a pointer
   * crossing the picture answers the same thing hundreds of times in a row.
   */
  const [cursor, setCursor] = useState('')

  /** Where a pointer is, as a share of the drawn picture in each direction. The
   *  box is asked of the element the event was aimed at, so there is one reading
   *  of it and every handler here is looking at the same picture. */
  const spotOf = (event: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const box = event.currentTarget.getBoundingClientRect()

    return {
      across: (event.clientX - box.left) / box.width,
      down: (event.clientY - box.top) / box.height,
    }
  }

  return (
    <div className="crop">
      {/* The picture answers a pointer only where there is somewhere to send the
          answer. `touch-action: none` comes with it (Crop.css): without it a drag
          on a telephone scrolls the page under the finger and the circle stays
          where it was, which is the very thing the sliders were written to
          avoid. */}
      <div
        className={onChange === undefined ? 'crop__picture' : 'crop__picture crop__picture--dragged'}
        style={{
          aspectRatio: `${shape.width} / ${shape.height}`,
          /* Never taller than most of the screen, and the width follows so the
             box stays the shape of the picture: the percentages the frame and
             the hole are written in are percentages of **this box**, so a box
             that is not the picture's shape puts the circle over the wrong part
             of it.

             Measured by a review on 27.08.2026: on a 360 by 640 telephone an
             ordinary portrait photograph (1080 by 2400) drew a box 320 by 711,
             taller than the whole window, with the send button 533 pixels below
             it. Because the picture takes every touch (`touch-action: none`, and
             it must, or a drag scrolls the page instead of moving the circle),
             the only way past it was a strip of 40 pixels beside it. Capped, the
             picture ends well inside the screen and there is page to scroll on
             either side of it.

             And only where there is something to drag. The reason above is that
             the picture takes every touch, which is true of this screen and of no
             other: a moderator reading a member's choice has nothing to drag and
             can scroll past a tall picture like any other. Measured by a review on
             28.08.2026 in a window 805 pixels high: capped, a 1080 by 2400
             photograph draws 217 by 483 instead of 320 by 711, so the part that
             will be thrown away is at 68 per cent of its linear size on the one
             screen where „zatamnjen ali dovoljno vidljiv ostatak" (owner,
             12.08.2026) is the whole point. */
          ...(onChange === undefined
            ? {}
            : {
                maxBlockSize: '60svh',
                inlineSize: `min(100%, calc(60svh * ${shape.width} / ${shape.height}))`,
                marginInline: 'auto',
                /* And what the pointer says it may do here, which is the state
                   above rather than a rule in the sheet: it is a different answer
                   over the middle of the circle, over its rim and over each
                   quarter of that rim. Empty until a pointer has been over the
                   picture at all, and empty again once it leaves, which is
                   exactly when nobody is looking at a cursor. */
                cursor,
              }),
        }}
        onPointerDown={
          onChange === undefined
            ? undefined
            : (event) => {
                const spot = spotOf(event)
                /* The same reading the cursor has been showing all along, asked
                   of the one place that answers it (`aimAt` in components/crop.ts).
                   Deciding it again here is how a portal ends up promising one
                   thing with the pointer and doing another with the press. */
                const aim = aimAt(hole, spot)

                doing.current = aim.doing
                /* And the cursor is locked to it for the rest of the gesture: a
                   closed hand while the circle is carried, the arrows while it is
                   pulled. It stops answering where the pointer is, because from
                   here until the release the answer is what the press decided;
                   without that, a drag that carries the circle out from under the
                   pointer would flicker between a hand and the arrows. */
                setCursor(aim.doing === 'moving' ? 'grabbing' : aim.cursor)
                /* Held by the box for the rest of the gesture, so a finger that
                   wanders off the picture goes on moving the circle rather than
                   being handed to whatever it wandered onto. Asked for rather
                   than assumed: jsdom has no pointer capture at all, and a drag
                   that threw here would leave the press decided and nothing
                   moved. */
                if (typeof event.currentTarget.setPointerCapture === 'function') {
                  event.currentTarget.setPointerCapture(event.pointerId)
                }
                onChange(
                  aim.doing === 'moving'
                    ? movedTo(held, shape, spot)
                    : sizedTo(held, shape, spot, closestIn(shape)),
                )
              }
        }
        onPointerMove={
          onChange === undefined
            ? undefined
            : (event) => {
                const spot = spotOf(event)

                if (doing.current === null) {
                  /* Nothing is held, so nothing moves: this is the pointer
                     promising what a press would do and no more. The crop is left
                     exactly as it was, or the circle would follow a mouse merely
                     passing over the picture. */
                  setCursor(aimAt(hole, spot).cursor)

                  return
                }

                onChange(
                  doing.current === 'moving'
                    ? movedTo(held, shape, spot)
                    : sizedTo(held, shape, spot, closestIn(shape)),
                )
              }
        }
        onPointerUp={
          onChange === undefined
            ? undefined
            : (event) => {
                doing.current = null
                /* Back to promising rather than reporting, read off where the
                   pointer was let go and off the circle as it now is. Waiting for
                   the next move instead would leave a closed hand under a pointer
                   holding nothing, for as long as it stays still. */
                setCursor(aimAt(hole, spotOf(event)).cursor)
              }
        }
        onPointerCancel={
          onChange === undefined
            ? undefined
            : () => {
                doing.current = null
                /* Nothing is promised after a gesture somebody else took away:
                   the press may have been stolen by the telephone's own scroll or
                   by a window losing focus, and where the pointer ended up is not
                   this picture's to say. The next move over the picture answers
                   again. */
                setCursor('')
              }
        }
        onPointerLeave={
          onChange === undefined
            ? undefined
            : () => {
                /* Off the picture there is nothing to promise. Only ever fired
                   with nothing held: while the box has the pointer captured the
                   browser withholds the boundary events, and hands them over at
                   the release, which is the one moment this may run after a drag. */
                setCursor('')
              }
        }
      >
        <img
          className="crop__whole"
          src={picture}
          alt={alt}
          /* And the browser's own dragging of it turned off, which is what keeps
             a gesture alive long enough to reach a limit.

             A picture is draggable by default: press on it, move, and Chrome
             starts a drag of the file itself and takes the pointer away from
             whoever had it. That is exactly what shrinking the circle does. The
             circle follows the pointer inwards, the rim overtakes it, and the
             pointer is left standing over bare photograph with the button still
             down. Measured in Chrome over the built `dist` on 29.08.2026, on a
             picture 1000 by 2000 pressed at 0,97 of the box across and dragged
             to 0,90, 0,70, 0,55 and 0,50 of it: without this attribute the page
             reports `dragstart` on `IMG.crop__whole`, then `pointercancel`,
             `lostpointercapture`, `pointerout` and `pointerleave`.
             `pointercancel` empties `doing`, so the size went 1 to 0,94 to 0,80
             and then stood still for the rest of the press, and the cursor fell
             from `ew-resize` back to nothing with the button still held. Owner,
             29.08.2026, point 4: „krug se skuplja ili širi do mogućih granica",
             and half of that could not happen at all. With this attribute the
             same press runs 1 to 0,94 to 0,80 to 0,40 to 0,24, which is the
             floor `closestIn` sets for that picture, the cursor stays
             `ew-resize` throughout, and no `dragstart` is fired at all.

             On the reading screen too, where nothing is dragged and this changes
             nothing about the gesture: one element, one answer. A conditional
             here would be a second thing to keep in step with `onChange` for the
             sake of letting a moderator drag a photograph out of the page, which
             nobody asked for.

             `Crop.css` does not carry this. `-webkit-user-drag` is one browser's
             own property and is not in any specification, while the attribute is
             what HTML gives for the purpose and is what React writes on the
             element. `cropChooser.test.tsx` holds it, in the same shape as
             `touch-action: none` beside it: jsdom has no native dragging at all,
             so the attribute is what a test can see and the browser is where the
             fault was measured. */
          draggable={false}
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
