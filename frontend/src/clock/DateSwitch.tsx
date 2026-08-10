import { useEffect, useState } from 'react'
import { devToolsEnabled } from '../dev/tools'
import { DatePicker } from '../forms/DatePicker'
import { fieldDate, isoDate } from '../forms/dateField'
import { useI18n } from '../i18n/useI18n'
import { realToday } from './context'
import { useClock } from './useClock'
import './DateSwitch.css'

/* A control for development and for QA, standing beside the role switch and
 * there for the same reason (src/dev/tools.ts). It moves the day the whole
 * portal is being read as, so the owner can walk up to 1 October and watch
 * registration open, or to December and watch the price change, without waiting
 * for the calendar or editing anything.
 *
 * It is the portal's own date control, dd/mm/gggg, and not the native one.
 * The native input follows the browser's locale, so on an English Chrome this
 * header read 12/17/2026 (owner, 11.08.2026): month first, in a portal whose
 * every other date is day first. That is the same reason no form on the portal
 * uses it (PDL P8, src/forms/dateField.ts); the argument that this control is
 * exempt held only as long as nobody had to read it, and it stands in the
 * header of every screen.
 */
function DateChooser() {
  const { t } = useI18n()
  const { today, simulated, simulate } = useClock()
  /* What is in the box, which is not the same thing as the day the portal is
     on. A date is typed one digit at a time and is not a date until the last
     one, so the box has to hold "02/10/202" while the clock goes on standing
     where it was. Held here rather than derived from the clock: derived, the
     box would refuse every keystroke but the last and could not be typed into
     at all. */
  const [typed, setTyped] = useState(() => fieldDate(today))

  /* And it follows the clock while nobody is holding it somewhere: the real day
     moves under an open tab when midnight passes (ClockProvider), and the box
     would go on saying yesterday while the portal said today. Only while
     nothing is simulated, so this can never fight what is being typed: typing a
     whole date is what puts the portal on a simulated day. */
  useEffect(() => {
    if (simulated === null) {
      setTyped(fieldDate(today))
    }
  }, [simulated, today])

  return (
    <div className={simulated === null ? 'date-switch' : 'date-switch date-switch--on'}>
      {/* No visible word beside it: the header carries names, not labels
          (PDL P28a). A screen reader still gets one, because a bare date in a
          header says nothing about whose. */}
      <label className="visually-hidden" htmlFor="date-switch">
        {t('clock.label')}
      </label>
      <DatePicker
        id="date-switch"
        name="date-switch"
        value={typed}
        invalid={false}
        describedBy={undefined}
        /* A half typed date is not a day to move the portal to, and `isoDate`
           answers an empty string for one, which is the clock's own word for
           "back to the real day". So the portal would jump home on the third
           keystroke of four. Nothing is moved until the date is whole. */
        onChange={(written) => {
          setTyped(written)

          const day = isoDate(written)

          if (day !== '') {
            simulate(day)
          }
        }}
      />

      {/* Only while the clock is somewhere else. A button that spends its life
          disabled is one more thing in the header and one more stop for anyone
          moving through it with a keyboard, and its absence says the same thing
          its greyness would: nothing is being simulated.

          Known and left: pressing it takes the button away under the finger, so
          the keyboard focus falls back to the page. On anything a member ever
          sees that would have to be caught and put somewhere; this is drawn in
          no production build at all. */}
      {simulated !== null && (
        <button
          type="button"
          className="date-switch__reset"
          aria-label={t('clock.reset')}
          title={t('clock.reset')}
          onClick={() => {
            simulate(null)
            setTyped(fieldDate(realToday()))
          }}
        >
          {'↺'}
        </button>
      )}
    </div>
  )
}

/* Split in two so the production build calls no hook and draws nothing, the
 * same shape as RoleSwitch. */
export function DateSwitch() {
  if (!devToolsEnabled()) {
    return null
  }

  return <DateChooser />
}
