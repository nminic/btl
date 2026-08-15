import { CLOSEST, WHOLE } from './crop'
import type { Crop } from './crop'
import { CropWindow } from './CropWindow'
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
            take(event.target.files?.[0], onChange)
          }}
        />
        <p className="member__note">{rule}</p>
      </div>

      {chosen !== null && (
        /* Named as a group, because what is on screen is a picture and three
           controls that only mean anything together. Without this a screen
           reader meets „Levo i desno" with nothing saying what moves. */
        <div className="crop__choosing" role="group" aria-label={t('crop.choosing')}>
          <CropWindow picture={chosen.picture} crop={chosen.crop} alt={alt}>
            {slider(chosen, 'x', 0)}
            {slider(chosen, 'y', 0)}
            {slider(chosen, 'size', CLOSEST)}
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
