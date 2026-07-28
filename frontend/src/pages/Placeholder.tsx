import { useI18n } from '../i18n/useI18n'

type Props = {
  labelKey: string
}

/* Every route exists from the first day so the navigation can be walked end to
 * end and the flow reviewed. The screens themselves arrive phase by phase. */
export function Placeholder({ labelKey }: Props) {
  const { t } = useI18n()

  return (
    <div className="placeholder">
      <h1>{t(labelKey)}</h1>
      <p>{t('placeholder.text')}</p>
    </div>
  )
}
