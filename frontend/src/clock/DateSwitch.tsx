import { devToolsEnabled } from '../dev/tools'
import { useI18n } from '../i18n/useI18n'
import { useClock } from './useClock'
import './DateSwitch.css'

/* A control for development and for QA, standing beside the role switch and
 * there for the same reason (src/dev/tools.ts). It moves the day the whole
 * portal is being read as, so the owner can walk up to 1 October and watch
 * registration open, or to December and watch the price change, without waiting
 * for the calendar or editing anything.
 *
 * It is the native date input, which is the one place on the portal where that
 * is right. Everywhere a member types a date the portal refuses it, because it
 * follows the browser's locale and an English browser reads 04/03 as 3 April
 * (PDL P8, src/forms/dateField.ts). Neither reason reaches here: no member ever
 * sees this, it is read rather than typed, and it speaks yyyy-mm-dd, which is
 * the shape the clock keeps.
 */
function DateChooser() {
  const { t } = useI18n()
  const { today, simulated, simulate } = useClock()

  return (
    <div className="date-switch">
      <input
        id="date-switch"
        className={simulated === null ? 'date-switch__day' : 'date-switch__day date-switch__day--on'}
        type="date"
        /* No visible word beside it: the header carries names, not labels
           (PDL P28a). A screen reader still gets one, and so does anyone who
           hovers, because a bare date in a header says nothing about whose. */
        aria-label={t('clock.label')}
        title={t('clock.label')}
        value={today}
        onChange={(event) => simulate(event.target.value === '' ? null : event.target.value)}
      />

      {/* Only while the clock is somewhere else. A button that spends its life
          disabled is one more thing in the header and one more stop for anyone
          moving through it with a keyboard, and its absence says the same thing
          its greyness would: nothing is being simulated. */}
      {simulated !== null && (
        <button
          type="button"
          className="date-switch__reset"
          aria-label={t('clock.reset')}
          title={t('clock.reset')}
          onClick={() => simulate(null)}
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
