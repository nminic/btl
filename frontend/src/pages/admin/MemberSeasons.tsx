import { useId, useState } from 'react'
import { FIRST_SEASON } from '../../data/season'
import type { Member } from '../../data/types'
import { dataOr, useFrozenSeasons } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { actsOn, heldIn, offeredFor, type SeasonAsk } from './memberMembership'

/**
 * THE COLUMN „SEZONE" OF A MEMBER'S ROW (owner, 22.10.2026, PDL „Red na ekranu članova ima pet kolona":
 * „u polju se nalazi checkbox dropdown list gde je odabrana poslednja sezona, a ako hoću da spustim mogu
 * da vidim listu svih sezona do sada kao i koje su od njih štiklirane").
 *
 * - **Closed, it shows the season on sale with its box** (the coordinator's answer of 22.10.2026, P6),
 *   the season the column „Osnov" is the basis of („Osnov je osnov sezone prikazane u koloni Sezone").
 * - **Opened, it lists every season of the league to that one**, from {@link FIRST_SEASON} (PDL
 *   [IZVEDENO] „Sezone nude samo sezone lige (od 2027)"), each ticked where he holds it.
 * - **The season on sale and every frozen season can be ticked or cleared** (`actsOn`). Ticking a box is
 *   the exemption of that season, clearing it is the cancellation of that season by the basis it stands
 *   on (owner, 22.10.2026, chosen with the recommendation: „Štikliranje sezone unazad upisuje oslobođenje
 *   (ime i vreme odluke); odštikliranje je storno te sezone"); both ask first, and the row puts the
 *   question (`MemberRow.tsx`). The ask carries the season of the box, and the route acts on it and on no
 *   other. The season that ended and has not frozen is drawn and does not act (owner, 24.11.2026: „njena
 *   kućica je u tom prozoru neaktivna"). Which seasons have frozen is `GET /api/frozen-seasons`; while it
 *   is on its way, or where it failed, no earlier box acts, which is the side the route refuses on anyway.
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
  const frozen = dataOr(useFrozenSeasons(), []).map((each) => each.season)

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
                  disabled={!actsOn(one.seasonOnSale, season, frozen)}
                  onChange={() =>
                    onAsk(held === undefined ? { act: 'grant', season } : { act: 'cancel', basis: held, season })
                  }
                />
                {season}
              </label>
              {/* Beside the season it is said of, and nowhere else on the portal (owner, 30.10.2026:
                  „Administracija vidi „bez prava rangiranja" u redu člana, na spisku sezona, pored
                  osnova članstva, i nigde drugde"). Read off the season's own row (`MembersApi`). */}
              {one.seasons.some((row) => row.season === season && !row.ranked) && (
                <span className="members-seasons__unranked"> · {t('admin.withoutTheRightToRank')}</span>
              )}
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
