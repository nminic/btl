import { Link } from 'react-router'
import { useI18n } from '../i18n/useI18n'

export function NotFound() {
  const { locale, t } = useI18n()

  return (
    <div className="not-found">
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.text')}</p>
      <Link to={`/${locale}`}>{t('notFound.back')}</Link>
    </div>
  )
}
