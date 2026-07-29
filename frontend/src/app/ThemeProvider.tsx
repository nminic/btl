import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { storedTheme, ThemeContext, THEME_STORAGE_KEY, type Theme, type ThemeValue } from './themeContext'

/* Sits above the shell and every page, so the one control in settings and the
 * attribute the stylesheet reads can never drift apart. Writing data-theme on
 * the root element is what makes the stored choice beat the media query in
 * tokens.css. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(storedTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const choose = useCallback((next: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, next)
    setTheme(next)
  }, [])

  const value = useMemo<ThemeValue>(() => ({ theme, choose }), [theme, choose])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
