import { useI18n } from '../i18n/useI18n'
import type { Gender } from '../data/types'

/**
 * Which half of the field is being read: the men or the women.
 *
 * **One control and one home, since 07.09.2026.** The main standing has worn it since 05.08.2026,
 * level with the heading at the far right, „where every screen with a control keeps it". The
 * standing of a competition now wears the same one, because the owner asked for the same thing in
 * the same words: „Žene ne treba da budu ispod muškaraca, nego da postoji filter gore desno da se
 * biraju Muškarci ili Žene."
 *
 * Written here rather than twice, so the two screens cannot come to look or behave differently
 * without somebody deciding that they should.
 *
 * **It says which table is being read, not which rows are kept.** That is why it belongs beside
 * the name of the screen and not among the filters under it, and why each screen decides for
 * itself what else a change to it clears: the main standing also drops the age category, a
 * competition has none to drop.
 */
export function GenderTabs({
  gender,
  label,
  onChange,
}: {
  gender: Gender
  /** What the group of buttons is called out loud, which is the screen it belongs to. */
  label: string
  onChange: (gender: Gender) => void
}) {
  const { t } = useI18n()

  return (
    <div className="rankings__tabs" role="group" aria-label={label}>
      <button type="button" aria-pressed={gender === 'M'} onClick={() => onChange('M')}>
        {t('rankings.men')}
      </button>
      <button type="button" aria-pressed={gender === 'F'} onClick={() => onChange('F')}>
        {t('rankings.women')}
      </button>
    </div>
  )
}
