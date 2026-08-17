import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BAR, storedTheme, ThemeContext, THEME_STORAGE_KEY, type Theme, type ThemeValue } from './themeContext'

/* Sits above the shell and every page, so the one control in settings and the
 * attribute the stylesheet reads can never drift apart. Writing data-theme on
 * the root element is what makes the stored choice beat the media query in
 * tokens.css. */

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(storedTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    /* And the browser's own bar, which is not painted by the stylesheet: it reads
       this tag and nothing else. Left at the one value written into index.html, a
       member who chose the light theme kept an almost black bar above a light
       page, and before that everybody had a white one above a dark page. */
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme])
  }, [theme])

  const choose = useCallback((next: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, next)
    setTheme(next)
  }, [])

  const value = useMemo<ThemeValue>(() => ({ theme, choose }), [theme, choose])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
