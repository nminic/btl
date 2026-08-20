import { createContext } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'btl-theme'

export type ThemeValue = {
  theme: Theme
  choose: (theme: Theme) => void
}

/**
 * What the browser paints its own bar in, per theme: `--bg` of each one.
 *
 * Written out rather than read from the stylesheet, because a `<meta>` tag takes
 * a colour and not a custom property, and because the value has to be in
 * index.html before any stylesheet is fetched. A guard holds all three copies of
 * each colour to one another (app/theme.test.tsx).
 */
export const BAR: Record<Theme, string> = { dark: '#060b16', light: '#f4f6fa' }

export const ThemeContext = createContext<ThemeValue | null>(null)

/* Dark is the default and the system preference no longer decides (PDL P28a).
 * The switch left the header and now lives in a member's settings, so a visitor
 * without an account cannot change it; following a light system preference here
 * would put the portal in a theme nobody on the page can undo. */
export function storedTheme(): Theme {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
}
