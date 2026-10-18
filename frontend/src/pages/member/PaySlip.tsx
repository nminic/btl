import { useRef, type ReactNode } from 'react'
import { useHeightOnto } from '../../components/heightOnto'

/**
 * ONE PAYMENT SLIP: ITS HEADING, THE DETAILS IN WRITING, AND THE CODE BESIDE THEM.
 *
 * <p>PDL P8, owner, 18.10.2026, four sentences about this block, and `geometry/paySlip.geometry.ts`
 * holds each of them where a browser lays the page out:
 * - „obriši naslov Uplatnica sa QR kodom, nepotreban je, a QR kod ostavi u nivou gde jeste, ne diži
 *   gore na mesto naslova" - so the one heading left is the slip's own and stands over both halves,
 *   and the code begins where the details begin, which is where it began while it had a title of its
 *   own at the height of this one;
 * - „A QR kod ne treba da pređe vertikalnu visinu stupca teksta sa leve strane u Uplatnici", and
 *   „Kod ostaje kvadrat i poravnat po vrhu sa podacima" - so the height of the details is handed to
 *   the sheet as `--slip-details` (`components/heightOnto.ts`), and `Member.css` sizes the code by it
 *   where the two stand side by side, and only there: on a telephone the code stands under the
 *   details at its own size („Na telefonu kod ostaje ispod podataka").
 *
 * <p>A component of its own because the measurement needs a ref per slip, and the slip is drawn
 * once per row of the price list (`Membership.tsx`, „ONE WALK AND NOT TWO").
 */
export function PaySlip({
  heading,
  details,
  code,
}: {
  heading: string
  /** The details in writing: the list a member types into his bank by hand. */
  details: ReactNode
  /** The same details as a code. */
  code: ReactNode
}) {
  const slip = useRef<HTMLDivElement>(null)
  const written = useRef<HTMLDivElement>(null)

  useHeightOnto('--slip-details', written, slip)

  return (
    <div className="pay__slip" ref={slip}>
      <h3 className="profile__section pay__heading">{heading}</h3>
      <div className="pay__slipText" ref={written}>
        {details}
      </div>
      <div className="pay__qr">
        <div className="pay__code">{code}</div>
      </div>
    </div>
  )
}
