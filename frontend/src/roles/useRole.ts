import { useContext } from 'react'
import { RoleContext, type RoleValue } from './context'

export function useRole(): RoleValue {
  const value = useContext(RoleContext)

  if (value === null) {
    throw new Error('useRole must be used inside RoleProvider')
  }

  return value
}
