import { useI18n } from '../../i18n/useI18n'

const STEPS = ['one', 'two', 'three']

export function HowItWorks() {
  const { t } = useI18n()

  return (
    <section className="card" aria-labelledby="how-heading">
      <h2 className="card__title" id="how-heading">
        {t('home.howTitle')}
      </h2>
      <ol className="steps">
        {STEPS.map((step, index) => (
          <li key={step}>
            <span className="steps__number">{index + 1}</span>
            <span>
              <strong>{t(`home.how.${step}.title`)}</strong>
              <span className="steps__text">{t(`home.how.${step}.text`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
