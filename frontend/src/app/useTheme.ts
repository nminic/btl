import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'btl-theme'

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/* The system preference decides the first visit, the explicit choice decides
 * every visit after that. Writing data-theme on the root element is what makes
 * the toggle beat the media query in tokens.css. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      // Only a deliberate choice is stored. Storing the detected value would
      // pin the theme after the first visit ever, and the system preference
      // would never be honoured again.
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  return { theme, toggle }
}
