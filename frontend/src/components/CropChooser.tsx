import { bigEnough, closestIn, SMALLEST_PIXELS, WHOLE } from './crop'
import type { Crop, Shape } from './crop'
import { CropWindow } from './CropWindow'
import { useState } from 'react'
import { AskedLabel } from '../forms/AskedLabel'
import { formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Crop.css'

/**
 * Choosing a picture and saying which square of it counts.
 *
 * Owner, 12.08.2026: „Mogućnost kropovanja željene slike unutar sajta - odnosi
 * se samo na profilne slike i timske slike."
 *
 * Inside the site, which is what makes this worth building rather than telling
 * a member to crop the file first. Somebody sending a photograph from a phone
 * has a picture of a person standing in a field, and what a circle beside their
 * name needs is their face; asked to arrange that in another program, most
 * people send the field.
 *
 * **Three sliders and not a rectangle dragged with a mouse.** A drag handle is
 * the usual way and it is unreachable: it cannot be operated from a keyboard at
 * all without inventing key handling nothing announces, it has no value to read
 * out, and on a phone it fights the scroll of the page it sits in. A range
 * control is a native control: it takes arrows, Home and End, says its value
 * aloud without being asked, and is a first class thing to a screen reader
 * (WCAG 2.2 SC 2.1.1 and 4.1.2). The picture is not the control, which is what
 * makes this reachable; the sliders are, and the picture answers them.
 *
 * The two positions are the same two numbers a crop is made of, so nothing is
 * converted between what a member drags and what a record keeps.
 */
export function CropChooser({ id, label, rule, alt, asked = true, chosen, onChange }: {
  /** What the file field is called on this screen, so two of these can stand on
   *  one page without their labels pointing at each other. */
  id: string
  /** The words asking for the picture, and the words explaining what sort of
   *  picture, both from the screen rather than from here: a face and a team
   *  logo are asked for differently. */
  label: string
  rule: string
  alt: string
  /** False where the picture may be left out. A team may be proposed without a
   *  logo and a member's profile may not be changed without a photograph, and
   *  the star that says which is the rule the owner set on 12.08.2026 for every
   *  form on the portal (forms/AskedLabel.tsx). */
  asked?: boolean
  chosen: Chosen | null
  onChange: (chosen: Chosen | null) => void
}) {
  const { locale, t } = useI18n()
  /* Why the last file was not taken, where it was not. Held here rather than
     handed up, because it is about the choosing and goes the moment another file
     is chosen; the screen above only ever hears about pictures it can use. */
  const [refused, setRefused] = useState<string | null>(null)
  /* How big the file turned out to be, which only the browser can answer and only
     after it has decoded the picture. Held here rather than inside the window
     below, because two things on this screen need it and neither is the drawing:
     a picture too small to draw the circle without loss is refused outright and
     the cropper is never opened over it (owner, 23.08.2026: „slika manja od te
     granice se odbija pri podizanju … kroper se nad njom i ne otvara"), and one
     that passes decides how small its own circle may be. */
  const [shape, setShape] = useState<Shape | null>(null)
  /* The shape only once it is one the portal will take. Anything else has already
     been refused above, and a `null` here is what keeps the cropper shut. */
  const measured = shape !== null && bigEnough(shape) ? shape : null

  /* One slider, three times over. Written out three times it drifted within a
     day of being written: the zoom kept the label of the axis above it.
   *
     Handed the picture rather than reading it from around itself, because there
     are no sliders until there is one: written the other way it needed a guard
     against a case that cannot happen, which is a line nothing can ever run. */
  const slider = (picture: Chosen, which: 'x' | 'y' | 'size', least: number) => {
    const value = picture.crop[which]

    return (
      <p className="crop__slider">
        {/* A plain label, and not the one that carries the star. That helper
            marks a field as wanted or as „(neobavezno)", and a slider is
            neither: it always has a value, nobody can leave it empty, and
            calling it optional puts the word inside the name a screen reader
            reads out. The rule about stars is about fields somebody fills in
            (forms/AskedLabel.tsx); the picture above is one and this is not. */}
        <label htmlFor={`${id}-${which}`}>{t(`crop.${which}`)}</label>
        <input
          id={`${id}-${which}`}
          type="range"
          min={least}
          max={1}
          step={0.01}
          value={value}
          /* Read out as a share and not as „0,42". The number itself means
             nothing to anybody: what a member wants to hear is how far across
             they have moved, and how much of the photograph is left. */
          aria-valuetext={t('crop.share', { share: formatNumber(100 * value, locale) })}
          onChange={(event) => {
            onChange({ ...picture, crop: { ...picture.crop, [which]: Number(event.target.value) } })
          }}
        />
      </p>
    )
  }

  return (
    <>
      <div className="rankings__field rankings__field--wide">
        <AskedLabel id={id} asked={asked}>
          {label}
        </AskedLabel>
        <input
          id={id}
          /* Cleared by being drawn afresh. A file field cannot be emptied by
             setting its value, and a member who sends one picture and starts
             another would otherwise be shown the name of the one already gone. */
          key={chosen === null ? 'empty' : chosen.name}
          type="file"
          accept="image/*"
          aria-required={asked}
          onChange={(event) => {
            setShape(null)
            setRefused(null)
            take(event.target.files?.[0], onChange)
          }}
        />
        <p className="member__note">{rule}</p>

        {/* And why a file was turned away, said where the rule about files is
            said. `role="alert"` because it appears in answer to a press and
            nothing else on the screen changes: without it a member reading by
            ear chooses a picture and hears nothing at all.

            The number is in the sentence rather than in the code beside it, so
            the boundary is said in the same words wherever it is said. */}
        {refused !== null && (
          <p className="member__note member__note--refused" role="alert">
            {t('crop.tooSmall', { least: refused })}
          </p>
        )}
      </div>

      {/* The picture measured before anything is offered over it.
       *
          Drawn rather than decoded on the side, because a picture has no width
          until a browser has read it and this is the reading everything else on
          the portal already does (`CropWindow`, and the queue). Off the screen
          and out of the accessible tree: it is a measurement and not something to
          look at, and the picture itself is shown a moment later by the window
          below.
       *
          Both or neither, the same as everywhere else: a file the browser could
          not decode reports nought for each, and nought is not a size to judge
          against. */}
      {chosen !== null && (
        <img
          className="visually-hidden"
          aria-hidden="true"
          alt=""
          src={chosen.picture}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget

            if (naturalWidth === 0 || naturalHeight === 0) {
              return
            }

            const size = { width: naturalWidth, height: naturalHeight }

            setShape(size)

            if (!bigEnough(size)) {
              /* Refused, and the picture goes with the refusal: the cropper is
                 never opened over something the portal cannot draw without loss,
                 and a member left holding a file they cannot use would have to
                 work out for themselves that it is gone. */
              setRefused(String(SMALLEST_PIXELS))
              onChange(null)
            }
          }}
          onError={() => {
            /* A file the browser cannot read is not a picture, whatever it is
               called and whatever `accept="image/*"` let through: a `.heic` from
               a telephone is the ordinary case, and a truncated JPEG is the other
               one. Without this the member is left with no cropper, no message
               and a live send button, and pressing it really does put the file in
               front of a moderator. Measured by a review on 27.08.2026, in the
               flow: „alert: [], cropper open: false, send aria-disabled: false,
               sent through: true".

               Said in the same words as a picture that is too small, because from
               where the member stands it is the same answer: this file cannot be
               used, choose another. */
            setRefused(String(SMALLEST_PIXELS))
            onChange(null)
          }}
        />
      )}

      {chosen !== null && measured !== null && (
        /* Named as a group, because what is on screen is a picture and three
           controls that only mean anything together. Without this a screen
           reader meets „Levo i desno" with nothing saying what moves. */
        <div className="crop__choosing" role="group" aria-label={t('crop.choosing')}>
          <CropWindow
            picture={chosen.picture}
            crop={chosen.crop}
            alt={alt}
            /* The picture answers a pointer, the sliders answer everything else,
               and both write the same three numbers into the same place. */
            onChange={(crop) => {
              onChange({ ...chosen, crop })
            }}
          >
            {slider(chosen, 'x', 0)}
            {slider(chosen, 'y', 0)}
            {slider(chosen, 'size', closestIn(measured))}
          </CropWindow>
        </div>
      )}
    </>
  )
}

/** A picture a member has chosen but not yet sent: what it is called, what it
 *  is, and which square of it counts. */
export type Chosen = { name: string; picture: string; crop: Crop }

/**
 * The file the browser just handed over, read into something that can be shown.
 *
 * Read here and not sent as a file, because until F5 there is nowhere to send a
 * file to. The browser reads it off the member's own disc into text, and that
 * text is what travels to the moderator's screen, so the flow the owner asked
 * for can be walked from end to end before there is a server that stores
 * anything.
 *
 * Nothing at all rather than half of something, if the browser hands back no
 * text: a name with no picture behind it would light up a send button and put
 * an empty frame in front of a moderator.
 */
function take(file: File | undefined, onChange: (chosen: Chosen | null) => void): void {
  if (file === undefined) {
    onChange(null)

    return
  }

  const reader = new FileReader()

  reader.onload = () => {
    onChange(
      typeof reader.result === 'string'
        ? /* The whole picture to begin with, every time. A crop carried over
             from the last file would cut the new one somewhere nobody looked. */
          { name: file.name, picture: reader.result, crop: WHOLE }
        : null,
    )
  }

  reader.readAsDataURL(file)
}
