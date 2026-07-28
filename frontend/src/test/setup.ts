import '@testing-library/jest-dom'
import { vi } from 'vitest'

/* jsdom has no matchMedia. The theme reads the system preference through it on
 * the first visit, so a stub is needed; tests that care override .matches. */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})
