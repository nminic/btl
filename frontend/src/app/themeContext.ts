import { createContext } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'btl-theme'

export type ThemeValue = {
  theme: Theme
  choose: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeValue | null>(null)

/* Dark is the default and the system preference no longer decides (PDL P28a).
 * The switch left the header and now lives in a member's settings, so a visitor
 * without an account cannot change it; following a light system preference here
 * would put the portal in a theme nobody on the page can undo. */
export function storedTheme(): Theme {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
}
