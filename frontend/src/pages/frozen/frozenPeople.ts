import { useCallback, useMemo } from 'react'
import { standIn, theLiveOne, type FrozenPerson } from '../../data/frozen'
import type { Competitor } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { useProfileLink } from '../profile/useProfileLink'

/**
 * A MEMBER OF A FROZEN ROW AS A SCREEN DRAWS HIM: the record it draws a member with, and where his name
 * leads, which the snapshot does not say and the reader decides (ADL A37, „Snimak nosi i ime i vezu, a
 * šta se od toga crta odlučuje se pri čitanju").
 *
 * - He is still a member the portal serves: his name leads where `useProfileLink` says it leads for this
 *   reader, nowhere for one who may not read a hidden profile (PDL, 06.09.2026, „ime skrivenog člana i u
 *   njoj stoji kao tekst, ne kao veza").
 * - His fee lapsed, or he was deleted after five years: his name, as text (PDL, „Ime neaktivnog člana
 *   ostaje vidljivo u istorijskim tabelama te godine, ali kao običan tekst, bez linka"; PDL, 05.11.2026,
 *   „ime i prezime ostaju kao tekst bez veze samo u zamrznutim tabelama sezona").
 * - He asked to be deleted: „<Obrisani član>" or „<Obrisana članica>" by the gender the row keeps (ADL
 *   A37), „<Deleted member>" in English (PDL, „Oblik zamrzavanja", point 7).
 *
 * „Neaktivan član / Neaktivna članica" with his real number (PDL, 03.10.2026) is drawn for a season that
 * was put out after it froze, and nothing yet says which those are: the job that puts a season out (SZ) is
 * not written. It is a boundary, and this is where it lands.
 */
export type FrozenOne = { competitor: Competitor; to: string | undefined; memberNumber: string | null }

export function useFrozenPeople(
  competitors: Competitor[],
  season: number,
): (one: FrozenPerson, category?: string | null) => FrozenOne {
  const { t } = useI18n()
  const linkTo = useProfileLink()
  const live = useMemo(() => new Map(competitors.map((one) => [one.memberNumber, one])), [competitors])

  return useCallback(
    (one: FrozenPerson, category: string | null = null) => {
      const found = theLiveOne(one, live)
      const competitor = standIn(
        one,
        found,
        season,
        category,
        t(one.gender === 'F' ? 'frozen.deletedWoman' : 'frozen.deletedMan'),
      )

      return { competitor, to: found === undefined ? undefined : linkTo(competitor), memberNumber: one.memberNumber }
    },
    [live, linkTo, season, t],
  )
}
