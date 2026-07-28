import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { freshNews, type NewsItem } from './content'

export function News({ items, today }: { items: NewsItem[]; today: string }) {
  const { locale, t } = useI18n()
  const fresh = freshNews(items, today)

  if (fresh.length === 0) {
    return null
  }

  return (
    <section className="card" aria-labelledby="news-heading">
      <h2 className="card__title" id="news-heading">
        {t('home.news')}
      </h2>
      <ul className="news">
        {fresh.map((item) => (
          <li key={item.id}>
            <span className="news__date">{formatShortDate(item.date, locale)}</span>
            <strong>{t(item.titleKey)}</strong>
            <span>{t(item.textKey)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
