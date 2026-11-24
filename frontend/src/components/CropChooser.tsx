import { bigEnough, closestIn, SMALLEST_PIXELS, WHOLE } from './crop'
import type { Crop, Shape } from './crop'
import { CropSliders } from './CropSliders'
import { CropWindow } from './CropWindow'
import { useState } from 'react'
import { AskedLabel } from '../forms/AskedLabel'
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
 *
 * **THE ONE CONTROL OF A CIRCLE ON THE PORTAL** (owner, 24.11.2026, PDL „Podešavanje kruga na slici radi
 * identično na svakom mestu portala": „Zelim da ovo za sliku radi identično kao za bilo koje prilagođavanje
 * kruga na slici na portalu (unos članske, znaka tima i sl.)"). Every screen that moves a circle draws this,
 * the moderator's card of a waiting picture included, so the drag, the cap on the height, the sliders and
 * the keyboard are one code on all of them; `components/oneFace.test.ts` fails the day a module other than
 * this one reaches `CropWindow` or `CropSliders`.
 */
export function CropChooser(props: Choosing) {
  const { id, alt, chosen, onChange } = props

  return props.standing === undefined ? (
    <ChoosingAFile
      id={id}
      label={props.label}
      alt={alt}
      asked={props.asked}
      unmarked={props.unmarked}
      chosen={chosen}
      onChange={onChange}
    />
  ) : (
    <MovingTheCircleOfOneThatStands id={id} alt={alt} chosen={chosen} onChange={onChange} standing={props.standing} />
  )
}

/**
 * WHAT A SCREEN HANDS THE CONTROL: a file to choose (`label`, and whether the picture is asked for), or a
 * picture that is already on the portal and only its circle to move (`standing`), never both.
 */
type Choosing = {
  /** What the file field is called on this screen, so two of these can stand on
   *  one page without their labels pointing at each other. Where there is no
   *  file field (`standing`), where the three sliders' ids start. */
  id: string
  alt: string
  chosen: Chosen | null
  onChange: (chosen: Chosen | null) => void
} & (
  | {
      label: string
      asked?: boolean
      unmarked?: boolean
      standing?: undefined
    }
  | {
      label?: undefined
      asked?: undefined
      unmarked?: undefined
      standing: Standing
    }
)

/**
 * A PICTURE THAT IS ALREADY ON THE PORTAL AND HAS ONLY ITS CIRCLE MOVED HERE, which is the moderator's card
 * of a picture that waits (owner, 23.11.2026: „hoću da mogu da se poigram krugom pre nego što mu je
 * odobrim", and 24.11.2026: „Na kartici slike koja čeka administrator krug vuče po slici (prstom ili mišem),
 * kao član").
 *
 * Three things differ from choosing a file, and none of them is how the circle is moved:
 *
 * - **No file field**, because nothing is chosen.
 * - **The picture is measured by the window itself** (`CropWindow`'s `onLoaded`), not by a hidden picture
 *   first: the card's two buttons wait for that very element (PDL, 11.10.2026: „Dok se slika učitava, oba
 *   dugmeta su neaktivna; kad se učita, oba rade."), and a second element would be a second answer to
 *   „did it arrive" (ADL A31). So the screen is told what became of it (`onLoaded`, `onFailed`).
 * - **No picture is refused for its size**: it was taken by the portal already, and a picture already cut
 *   is not judged again (owner, 23.08.2026: „nebitne su slike koje su već kropovane"). Its floor is still
 *   `closestIn`, as for any other.
 */
export type Standing = {
  onLoaded: () => void
  onFailed: () => void
}

function MovingTheCircleOfOneThatStands({ id, alt, chosen, onChange, standing }: {
  id: string
  alt: string
  chosen: Chosen | null
  onChange: (chosen: Chosen | null) => void
  standing: Standing
}) {
  const { t } = useI18n()
  /* WHAT THE WINDOW MEASURED, by the picture it measured, so a picture replaced under the screen has no
     sliders until its own pixels have arrived. */
  const [measured, setMeasured] = useState<{ picture: string; shape: Shape } | null>(null)

  if (chosen === null) {
    return null
  }

  const shape = measured !== null && measured.picture === chosen.picture ? measured.shape : null

  return (
    <div className="crop__choosing" role="group" aria-label={t('crop.choosing')}>
      {/* Keyed by the picture, so that a replaced one is a window of its own with an `<img>` of its own,
          which draws nothing until its own pixels arrive and reports for itself. */}
      <CropWindow
        key={chosen.picture}
        picture={chosen.picture}
        crop={chosen.crop}
        alt={alt}
        onChange={(crop) => {
          onChange({ ...chosen, crop })
        }}
        onLoaded={(read) => {
          setMeasured({ picture: chosen.picture, shape: read })
          standing.onLoaded()
        }}
        onFailed={standing.onFailed}
      >
        {shape !== null && (
          <CropSliders
            id={id}
            crop={chosen.crop}
            least={closestIn(shape)}
            onChange={(crop) => {
              onChange({ ...chosen, crop })
            }}
          />
        )}
      </CropWindow>
    </div>
  )
}

function ChoosingAFile({ id, label, alt, asked = true, unmarked = false, chosen, onChange }: {
  id: string
  /** The words asking for the picture, from the screen rather than from here: a
   *  face and a team logo are asked for differently.
   *
   *  There was a second string beside it saying what sort of picture, and both
   *  callers gave it one of the last three rules on the portal. The owner had
   *  them deleted on 31.08.2026, and with no caller left to give it a value the
   *  prop went out rather than taking an empty string: an empty `<p>` is a gap
   *  that shows and a stop that a reader passes with nothing in it. */
  label: string
  alt: string
  /** False where the picture may be left out. A team may be proposed without a
   *  logo and a member's profile may not be changed without a photograph, and
   *  the star that says which is the rule the owner set on 12.08.2026 for every
   *  form on the portal (forms/AskedLabel.tsx). */
  asked?: boolean
  /** True where the name stands with no mark at all (`forms/AskedLabel.tsx`, `unmarked`). */
  unmarked?: boolean
  chosen: Chosen | null
  onChange: (chosen: Chosen | null) => void
}) {
  const { t } = useI18n()
  /* Why the last file was not taken, where it was not. Held here rather than
     handed up, because it is about the choosing and goes the moment another file
     is chosen; the screen above only ever hears about pictures it can use. */
  const [refused, setRefused] = useState<'small' | 'unreadable' | null>(null)
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

  return (
    <>
      <div className="rankings__field rankings__field--wide">
        <AskedLabel id={id} asked={asked} unmarked={unmarked}>
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
        {/* Why a file was turned away, said under the field it was chosen in.
            `role="alert"` because it appears in answer to a press and
            nothing else on the screen changes: without it a member reading by
            ear chooses a picture and hears nothing at all.

            The number is in the sentence rather than in the code beside it, so
            the boundary is said in the same words wherever it is said. */}
        {refused !== null && (
          <p className="member__note member__note--refused" role="alert">
            {refused === 'small' ? t('crop.tooSmall', { least: String(SMALLEST_PIXELS) }) : t('crop.unreadable')}
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
              /* The same answer as a file that failed outright, because it is the
                 same state: nothing was measured, so nothing can be offered over
                 it. It used to return in silence, which left the member with no
                 cropper, no message and a live send button, which is the very
                 thing `onError` below was added to close. One decision reached by
                 two roads had two different endings until 28.08.2026. */
              setRefused('unreadable')
              onChange(null)

              return
            }

            const size = { width: naturalWidth, height: naturalHeight }

            setShape(size)

            if (!bigEnough(size)) {
              /* Refused, and the picture goes with the refusal: the cropper is
                 never opened over something the portal cannot draw without loss,
                 and a member left holding a file they cannot use would have to
                 work out for themselves that it is gone. */
              setRefused('small')
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

               Said in its own words and not in the words of a picture that is
               too small. Measured by a review on 28.08.2026: a 4032 by 3024 photo
               off an iPhone, which Chrome cannot decode because it is `.heic`,
               was answered with „Slika je premala. Najkraća strana mora da ima bar
               240 piksela", which is untrue of that file and asks the member to do
               something that cannot help. Every following `.heic` said the same,
               and the portal had no way out of it. */
            setRefused('unreadable')
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
            <CropSliders
              id={id}
              crop={chosen.crop}
              least={closestIn(measured)}
              onChange={(crop) => {
                onChange({ ...chosen, crop })
              }}
            />
          </CropWindow>
        </div>
      )}
    </>
  )
}

/**
 * A picture a member has chosen but not yet sent: what it is called, what it
 * is, which square of it counts, and - since 26.09.2026 - the file itself.
 *
 * **Why the file is here as well as the data URL, which reads like two homes for
 * one thing and is not.** They answer two different questions and neither can
 * answer the other's. The data URL is what can be DRAWN: `CropWindow` puts it in
 * an `img` on this screen and on the moderator's, and it is the only form a
 * picture takes that survives being put in a record. The file is what can be
 * SENT: `POST /api/me/photo` decides the type by looking at the bytes
 * (`WhatAPictureIs.sniff`, ADL A12a), so it has to be handed the bytes the
 * browser read rather than a base64 rendering of them turned back into bytes with
 * a type and a name invented on the way.
 *
 * **It is a `File` and not a `Blob`**, because that is what the browser hands over
 * and nothing here needs to make one.
 */
export type Chosen = { name: string; picture: string; crop: Crop; file: File }

/**
 * The file the browser just handed over, read into something that can be shown
 * and kept so that it can also be sent.
 *
 * **This said „Read here and not sent as a file, because until F5 there is nowhere
 * to send a file to", and that went out of date on 26.09.2026.** There is an
 * address now - `POST /api/me/photo`, which `MePhotoApi` has served since before
 * this branch - and `pages/member/ProfilePicture.tsx` sends to it. A sentence
 * saying a thing cannot be done is an instruction to the next reader not to try,
 * so it is corrected here rather than deleted. What it was right about survives:
 * the data URL is still what travels to the moderator's screen, because the queue
 * he reads is still the portal's own overlay.
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
             from the last file would cut the new one somewhere nobody looked.

             `file` IS THE ONE THE READER WAS GIVEN, and there is no second place it
             could come from: it is the argument of this function, so the picture
             that is drawn and the picture that is sent are read out of the same
             handle the browser passed in. Held on the record rather than looked up
             again off the field, because a field cleared by being redrawn (the
             `key` above) has no files on it by then. */
          { name: file.name, picture: reader.result, crop: WHOLE, file }
        : null,
    )
  }

  reader.readAsDataURL(file)
}
