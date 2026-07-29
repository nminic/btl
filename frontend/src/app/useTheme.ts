import { useContext } from 'react'
import { ThemeContext, type ThemeValue } from './themeContext'

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)

  if (value === null) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return value
}
