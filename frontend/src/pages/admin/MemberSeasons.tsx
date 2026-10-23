import { useId, useState } from 'react'
import { FIRST_SEASON } from '../../data/season'
import type { Member } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { heldIn, offeredFor, type SeasonAsk } from './memberMembership'

/**
 * THE COLUMN „SEZONE" OF A MEMBER'S ROW (owner, 22.10.2026, PDL „Red na ekranu članova ima pet kolona":
 * „u polju se nalazi checkbox dropdown list gde je odabrana poslednja sezona, a ako hoću da spustim mogu
 * da vidim listu svih sezona do sada kao i koje su od njih štiklirane").
 *
 * - **Closed, it shows the season on sale with its box** (the coordinator's answer of 22.10.2026, P6),
 *   the season the column „Osnov" is the basis of („Osnov je osnov sezone prikazane u koloni Sezone").
 * - **Opened, it lists every season of the league to that one**, from {@link FIRST_SEASON} (PDL
 *   [IZVEDENO] „Sezone nude samo sezone lige (od 2027)"), each ticked where he holds it.
 * - **Only the season on sale can be ticked or cleared.** Ticking it is „Odobri oslobođenje", clearing it
 *   is the cancellation by its basis; both ask first, and the row puts the question (`MemberRow.tsx`). An
 *   earlier season is drawn and cannot be changed: the routes act on the season on sale alone, read off
 *   the clock and never off the request (`MemberMembershipApi`), so a box of 2027 that sent anything
 *   would change 2028. Recorded as a debt before 15.10.2027 (PDL, the coordinator's addition of
 *   22.10.2026, and PENDING, „Dug pre 15.10.2027").
 * - **„Promeni osnov u oslobođenje" stands beside the season on sale where it is held on a payment**
 *   (the coordinator's answer of 22.10.2026, P4): it is a change of that season's basis, and it keeps its
 *   word (PDL 20.10.2026, „Ostaju reči").
 *
 * **It opens in the row and not over it** (P5): the table's box scrolls on its own (`styles/table.css`,
 * `.table-scroll`), which would clip a panel laid over the rows, and a disclosure in the flow needs no
 * listener that closes it, so a question asked from one of its boxes hands the focus back to that box.
 * The shape is the card that opens in a row of the queues (`PendingQueue.tsx`, „Prikaži").
 *
 * **The boxes never change by themselves.** Each shows what the server answered, and a press only asks:
 * „Ne" leaves the box as it was, and a box changes once the list is read again.
 */
export function MemberSeasons({ one, onAsk }: { one: Member; onAsk: (ask: SeasonAsk) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const listId = useId()
  const whose = `${one.firstName} ${one.lastName}`
  const onSale = one.membershipBasis
  const seasons = Array.from({ length: one.seasonOnSale - FIRST_SEASON + 1 }, (_, step) => FIRST_SEASON + step)

  return (
    <div className="members-seasons">
      <button
        type="button"
        className="members-seasons__toggle"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t('admin.seasonsOf', { name: whose, season: one.seasonOnSale })}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="members-seasons__box" aria-hidden="true">
          {onSale === undefined ? '☐' : '☑'}
        </span>{' '}
        {one.seasonOnSale}
      </button>
      <ul className="members-seasons__list" id={listId} hidden={!open}>
        {seasons.map((season) => {
          const held = heldIn(one, season)
          const onSaleNow = season === one.seasonOnSale

          return (
            <li key={season}>
              <label className="members-seasons__season">
                <input
                  type="checkbox"
                  checked={held !== undefined}
                  disabled={!onSaleNow}
                  onChange={() => onAsk(onSale === undefined ? { act: 'grant' } : { act: 'cancel', basis: onSale })}
                />
                {season}
              </label>
              {onSaleNow && offeredFor(onSale).toTheExemption && (
                <button type="button" className="entity-open" onClick={() => onAsk({ act: 'toTheExemption' })}>
                  {t('admin.changeToExemption')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
