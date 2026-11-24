import type { Crop } from './crop'
import { formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'

/**
 * THE THREE SLIDERS A CIRCLE IS MOVED AND SIZED WITH, drawn by `CropChooser` and by nothing else.
 *
 * Owner, 24.11.2026 (PDL „Podešavanje kruga na slici radi identično na svakom mestu portala"): „Zelim da ovo
 * za sliku radi identično kao za bilo koje prilagođavanje kruga na slici na portalu (unos članske, znaka tima
 * i sl.)". So the circle has one control, `CropChooser`, on every screen that moves one, and this module and
 * `CropWindow` are its parts: `components/oneFace.test.ts` fails the day any other module reaches either.
 *
 * Its own module so that the question „who draws sliders" is the import graph's to answer, which it can only
 * be for a module and not for a name inside one.
 *
 * The sliders are where the rules of a circle live for everybody who cannot use a pointer: the smallest
 * circle (`least`, from `closestIn`), the step, the share read out aloud, and the plain label. Written out
 * three times by hand they once drifted within a day: the zoom kept the label of the axis above it.
 *
 * @param id where the three ids start, so two of these can stand on one page
 * @param least the smallest diameter the picture allows (`closestIn`), the floor of the third slider
 */
export function CropSliders({ id, crop, least, onChange }: {
  id: string
  crop: Crop
  least: number
  onChange: (crop: Crop) => void
}) {
  const { locale, t } = useI18n()

  const slider = (which: 'x' | 'y' | 'size', floor: number) => {
    const value = crop[which]

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
          min={floor}
          max={1}
          step={0.01}
          value={value}
          /* Read out as a share and not as „0,42". The number itself means
             nothing to anybody: what a member wants to hear is how far across
             they have moved, and how much of the photograph is left. */
          aria-valuetext={t('crop.share', { share: formatNumber(100 * value, locale) })}
          onChange={(event) => {
            onChange({ ...crop, [which]: Number(event.target.value) })
          }}
          /* END IS THE WHOLE, and not the last step before it (owner, 24.11.2026, PDL „Sitnice iz recenzije
             PR-a 815 i 811 i panela tima": „taster End na klizaču veličine daje celu sliku"). A range counts
             its steps from its own floor, and the floor of the size is `closestIn` of THIS picture, which
             is almost never a round number (0,2133 for a photograph 1125 pixels across), so the last step
             a hundredth apart from it lands on 0,9933 and the browser, asked to go to the end, stops
             there: 99 per cent of the picture where the keyboard promised all of it. Written here and not
             in the step, because a step that fits every floor is a step of nothing (`any`), which takes
             the arrows away from the slider with it. */
          onKeyDown={(event) => {
            if (event.key === 'End') {
              event.preventDefault()
              onChange({ ...crop, [which]: 1 })
            }
          }}
        />
      </p>
    )
  }

  return (
    <>
      {slider('x', 0)}
      {slider('y', 0)}
      {slider('size', least)}
    </>
  )
}
