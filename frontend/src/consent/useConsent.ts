import { useContext } from 'react'
import { ConsentContext, type ConsentValue } from './consentContext'

export function useConsent(): ConsentValue {
  const value = useContext(ConsentContext)

  if (value === null) {
    throw new Error('useConsent must be used inside ConsentProvider')
  }

  return value
}
