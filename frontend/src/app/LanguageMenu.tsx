import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { outsideOf } from '../components/outsideOf'
import { LOCALES, type Locale } from '../i18n/config'
import { useI18n } from '../i18n/useI18n'

/* Flags are drawn rather than loaded: two small shapes inherit the page's
 * rounding and need no request, no image and no licence. */
function Flag({ locale }: { locale: Locale }) {
  if (locale === 'sr') {
    return (
      <svg className="lang__flag" viewBox="0 0 60 40" aria-hidden="true">
        <rect width="60" height="13.34" fill="#C6363C" />
        <rect y="13.34" width="60" height="13.33" fill="#0C4076" />
        <rect y="26.67" width="60" height="13.33" fill="#fff" />
      </svg>
    )
  }

  return (
    <svg className="lang__flag" viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0l60 40M60 0L0 40" fill="none" stroke="#fff" strokeWidth="9" />
      <path d="M0 0l60 40M60 0L0 40" fill="none" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v40M0 20h60" fill="none" stroke="#fff" strokeWidth="13" />
      <path d="M30 0v40M0 20h60" fill="none" stroke="#C8102E" strokeWidth="8" />
    </svg>
  )
}

const CODES: Record<Locale, string> = { sr: 'SR', en: 'EN' }

/**
 * The language control from the owner's own site, brought over: a button
 * showing the flag and the code, and a list underneath with a tick against the
 * one in use. Two languages would fit in two plain links, but the shape is
 * meant to survive a third without the header changing.
 */
export function LanguageMenu({ restOfPath }: { restOfPath: string }) {
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      if (outsideOf(box.current, event)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function choose(next: Locale) {
    setOpen(false)
    navigate(`/${next}/${restOfPath}`)
  }

  return (
    <div
      className={open ? 'lang is-open' : 'lang'}
      ref={box}
      /* Shut when the focus goes somewhere outside the box. Escape and a press elsewhere
         were the only ways out, so Tab past the last link, or Shift+Tab off the button,
         left the panel open over whatever the focus had gone to (WCAG 2.2 SC 2.4.11).
         The whole box is the question, the panel included, so Tab from one link to the
         next is not leaving. The shape is the one `forms/Suggesting.tsx` uses for its list.
         `relatedTarget` is where the focus is going. It is null when it goes nowhere an
         element can be named: a press on text inside the panel, which cannot take focus,
         blurs the button that opened it with a null `relatedTarget`, and the window losing
         the focus does the same. Neither is the reader leaving the box, and a press outside
         is the mousedown listener's. So null leaves it open. The focus is never put back:
         it went where the reader sent it. */
      onBlur={(event) => {
        const to = event.relatedTarget

        if (to !== null && !event.currentTarget.contains(to)) {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        className="lang__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language.label')}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="lang__btnflag">
          <Flag locale={locale} />
        </span>
        <span className="lang__code">{CODES[locale]}</span>
        <svg
          className="lang__caret"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <ul className="lang__menu" role="listbox" aria-label={t('language.label')}>
        {LOCALES.map((one) => (
          <li
            key={one}
            role="option"
            aria-selected={one === locale}
            tabIndex={open ? 0 : -1}
            lang={one}
            onClick={() => choose(one)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                choose(one)
              }
            }}
          >
            <Flag locale={one} />
            <span className="lang__name">{t(`language.${one}`)}</span>
            <svg
              className="lang__check"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </li>
        ))}
      </ul>
    </div>
  )
}
