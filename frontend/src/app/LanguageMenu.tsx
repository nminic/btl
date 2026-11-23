import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { outsideOf } from '../components/outsideOf'
import { LOCALES, loadDictionary, loadedDictionary, type Locale } from '../i18n/config'
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
export function LanguageMenu({ restOfPath, onRefused }: { restOfPath: string; onRefused: () => void }) {
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  const where = useLocation()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  /* Where the reader is now, for a book that arrives after he may have moved on. */
  const still = useRef(where.key)

  useEffect(() => {
    still.current = where.key
  }, [where.key])

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

  /* THE BOOK OF THE OTHER LANGUAGE IS ASKED FOR WHEN THE LIST OPENS, so it is usually here by the time a
     language is pressed (coordinator, 22.11.2026, derived from the owner's choice of that day to load only
     the language being read). What that costs is one book, about 24 KB, for whoever opens the list and
     keeps his language. Nothing is kept in the browser, and a failure here is only the first of two asks:
     `choose` asks again. */
  function toggle() {
    if (!open) {
      for (const other of LOCALES.filter((one) => one !== locale)) {
        loadDictionary(other).catch(() => undefined)
      }
    }

    setOpen((was) => !was)
  }

  /* THE SCREEN BEFORE STAYS UNTIL THE NEW LANGUAGE CAN BE DRAWN WHOLE, the way a screen that is still on its
     way does (`app/screens.tsx`), and with nothing drawn in the meantime (owner, 22.11.2026: no band in the
     header while a page arrives). A book already on the shelf moves at once. A press that is overtaken by
     the reader going somewhere else moves nothing: the book arriving later must not take him back. A book
     that does not arrive is said in the portal's own words, in the language he is still reading, in the
     place of the screen (`onRefused`), as a piece of a screen that does not arrive is (PR 794). */
  function choose(next: Locale) {
    setOpen(false)
    const to = `/${next}/${restOfPath}`

    if (loadedDictionary(next) !== undefined) {
      navigate(to)
      return
    }

    const pressedAt = where.key

    loadDictionary(next).then(
      () => {
        if (still.current === pressedAt) {
          navigate(to)
        }
      },
      () => {
        if (still.current === pressedAt) {
          onRefused()
        }
      },
    )
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
        /* THE CODE OF THE LANGUAGE IN USE IS PART OF THE NAME (owner, 16.11.2026, PDL „Pravilnik prelazi u
           podnožje, a Timovi postaju treća kartica BTL tabela”, answer 2: „oznaka jezika ostaje u imenu
           dugmeta za čitač ekrana”). On a telephone the button shows the flag alone and the code is kept
           for the reader (`app/Shell.css`, `.shell__header--phone .lang__code`). The name was the word
           „Jezik" alone until that day, so the „SR" the button shows on a desktop was not in its name
           either (WCAG 2.2 SC 2.5.3), and a reader on a telephone would have heard no code at all. */
        aria-label={t('language.button', { code: CODES[locale] })}
        onClick={toggle}
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
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 8.5l8 8 8-8" />
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
