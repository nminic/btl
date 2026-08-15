import { createContext } from 'react'

export type ConsentValue = {
  /** Whether measurement with cookies has been agreed to. */
  agreed: boolean
  /** Whether the bar is on the screen: nobody has agreed and nobody has closed
   *  it during this visit. */
  asking: boolean
  /** Says yes, and remembers it. */
  accept: () => void
  /**
   * Takes the bar off the screen without agreeing to anything, and without
   * writing anything down.
   *
   * Not a refusal: the bar carries no „Odbij sve" by decision (PDL P8), and the
   * privacy policy says in as many words that closing it is not consent. So this
   * is for the visit only, and the question is put again on the next one.
   */
  close: () => void
  /** Withdraws an agreement and puts the question back, which is what the
   *  footer's „Podešavanja kolačića" does. */
  askAgain: () => void
}

export const ConsentContext = createContext<ConsentValue | null>(null)
