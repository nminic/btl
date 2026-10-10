import type { ReactNode } from 'react'
import { Resource } from '../../components/Resource'
import type { Competitor } from '../../data/types'
import { useHisOwnRecord } from './useHisOwnRecord'

/**
 * A SCREEN THAT IS DRAWN FROM THE MEMBER'S OWN RECORD, for the one page whose subject is the
 * reader himself and who the public list does not carry.
 *
 * <p>`profile/visible.ts` says when (`his`), `profile/useHisOwnRecord.ts` says how the record is
 * had, and this is the part that makes it a screen: the whole page waits behind the portal's own
 * indicator while the record is on its way, says „Podaci se ne mogu učitati." with the way to ask
 * again when it could not be had, and otherwise hands the record to whoever draws the page. The
 * profile and the page of awards both stand on it, so a member is never drawn from his own record
 * on the one and refused on the other.
 *
 * @param memberNumber the number on the page, which is also the reader's
 * @param children draws the page from the record
 */
export function HisOwnRecord({
  memberNumber,
  children,
}: {
  memberNumber: string
  children: (competitor: Competitor) => ReactNode
}) {
  const state = useHisOwnRecord(memberNumber)

  return <Resource state={state}>{children}</Resource>
}
