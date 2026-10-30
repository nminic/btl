import { useRef, useState, type ReactNode } from 'react'
import { SYMBOL } from '../../app/actionSymbol'
import { ActionButton, ActionLink } from '../../components/ActionButton'
import { Prompt } from '../../components/Prompt'
import { categoryCodeFor, categoryLabel } from '../../data/categories'
import { countryName } from '../../data/countryName'
import type { Competitor, Member } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { profilePath } from '../profileAddress'
import { ProfileLink } from '../profile/ProfileLink'
import { THE_DATA } from '../profile/whoReadsTheData'
import { MemberPaymentSheet } from './MemberPaymentSheet'
import { MemberSeasons } from './MemberSeasons'
import {
  askingToCancel,
  basisWordOf,
  cancelling,
  GRANTING,
  membershipOnTheRow,
  offeredFor,
  overTheExemption,
  TO_THE_EXEMPTION,
  WHEN_CANCELLING,
  WHEN_CHANGING_TO_THE_EXEMPTION,
  WHEN_GRANTING_AN_EXEMPTION,
  WHEN_PAYING_OVER_THE_EXEMPTION,
  type SeasonAsk,
} from './memberMembership'
import { paymentOnTheRow, WHEN_RECORDING_ON_THE_ROW, type RowBooking } from './memberPayment'
import {
  addressIn,
  invitationOnTheRow,
  WHAT_THE_NUMBER_SAYS_WHEN_INVITING,
  WHEN_SENDING_AN_INVITATION,
} from './memberInvitation'
import { WHEN_DELETING_A_MEMBER } from './memberWrites'
import { useRowRefusal } from './useRowRefusal'
import '../member/Member.css'
import './Activation.css'
import './AdminMembers.css'

/** Every question a row can put, one at a time. */
type Asking = SeasonAsk | { act: 'pay' } | { act: 'delete' }

/** A refusal and the words it is said in, which are those of the request that met it, and the bare numbers
 *  that request gives a meaning to, where it gives any (`memberInvitation.ts`). */
type Refused = {
  answer: Exclude<Answer, { got: 'done' }>
  refusals: Record<string, string>
  numbers?: Record<number, string>
}

/**
 * ONE ROW OF THE MODERATION OF THE MEMBERS, IN FIVE COLUMNS (owner, 22.10.2026, PDL „Red na ekranu
 * članova ima pet kolona"):
 *
 * 1. **Ime i prezime**, and under it in small type the member number, „ - " and the category.
 * 2. **Mesto**, and under it in the same small type the country.
 * 3. **Osnov**, one word for the season on sale (`basisWordOf`), and a dash where he holds none of it:
 *    „Osnov je osnov sezone prikazane u koloni Sezone".
 * 4. **Sezone**, the list of seasons (`MemberSeasons.tsx`).
 * 5. **Opcije**, symbols in places that never move: „Izmeni podatke" with a pencil, which leads to the
 *    card „Podaci" of his profile (PDL 22.10.2026: „Dugme Edit otvara popunjenu formu sa svim podacima
 *    kao registracionu, samo bez lozinke", and the assistant's derivation told to the owner the same day,
 *    „Edit vodi na karticu Podaci profila tog člana („ista strana"), pa forma ima jedan dom"), „Upiši uplatu" with a banknote (owner, 22.10.2026: „Može li simbol za
 *    to umesto znaka plus da bude kao novčanice"), „Storniraj", and, held apart from them, „Obriši",
 *    which asks in a sheet over the page (PDL „Potvrda brisanja više nije rečenica u redu tabele nego
 *    iskačući prozor"). An action the row cannot take today stays in its place (the coordinator's answer
 *    of 22.10.2026, P3), so every symbol stands at the same place on every row. „Storniraj" is told off
 *    and stays in the order of focus (PDL 20.10.2026, „I privremeno neaktivno dugme pokazuje oblačić sa
 *    rečju"). **„Upiši uplatu" is switched off for real**, by the owner's own decision of the same day,
 *    chosen against the recommendation: „„Aktiviraj" i „Upiši uplatu" ostaju pravo neaktivni (bez
 *    fokusa); oblačić im se vidi samo mišem." The shape is the payments screen's „Aktiviraj"
 *    (`Payments.tsx`, `disabled` on the `ActionButton`). What it costs, written down: a payment that
 *    switches the symbol off takes it out of the order of focus, so the focus the sheet hands back after
 *    a payment does not stay on it once the row is read again.
 *
 * **On a narrow screen the columns fold under the name** (the coordinator's answer of 22.10.2026, P2,
 * from PDL P24): below 1000px the town and the country, below 700px the basis and the seasons as well,
 * each under the name of its column (`AdminMembers.css`, the two queries of `styles/table.css`). The
 * folded copy is drawn by the same component as the column, so the two cannot say different things.
 *
 * **ONE QUESTION AT A TIME, AND ONE GUARD FOR ALL OF THEM.** The row holds which question is open, and
 * every request it sends goes through `send`: a ref set before the request goes out and read before any
 * other is sent, so a second „Da" cannot send a second body while the first is in the air, and the sheet
 * is told a request is out (`Prompt`'s `working`) so it cannot be put away until the answer comes. This
 * was the shape of `RowPayment.tsx` and `RowMembership.tsx`, two components on one row, until
 * 22.10.2026; one row now holds it once.
 *
 * **A refusal stays beside the row** in the words of the request that met it, until the next action on
 * this row goes through (`useRowRefusal`).
 */
export function MemberRow({
  one,
  listed,
  settled,
  onPaid,
  onChanged,
  onInvited,
  onDelete,
}: {
  one: Member
  /** The member as the public list has him, or nothing where it does not: the name links to a profile
   *  only where there is one to open. */
  listed: Competitor | undefined
  /** How many actions on this row have succeeded this visit (`useRowRefusal`). */
  settled: number
  /** A payment was booked on a season that held nothing. */
  onPaid: () => void
  /** A season was granted, cancelled, or its basis changed, which a payment over the exemption is; the
   *  words are what the screen says of it. */
  onChanged: (said: string) => void
  /** A new invitation went out; the words are what the screen says of it, which name the address. */
  onInvited: (said: string) => void
  /** The deletion, sent by the screen, which knows what the visit must forget with him. */
  onDelete: () => Promise<Answer>
}) {
  const { locale, t } = useI18n()
  const [asking, setAsking] = useState<Asking | null>(null)
  const [refused, setRefused] = useRowRefusal<Refused>(settled)
  const outstanding = useRef(false)
  const [working, setWorking] = useState(false)

  const whose = `${one.firstName} ${one.lastName}`
  const season = one.seasonOnSale
  const basis = one.membershipBasis
  /* Over the exemption a payment is a change of basis (PDL P8, 18.10.2026, „preko njega se može upisati
     uplata"); over a payment or a balance it is not offered („storno ..., pa nova radnja"). */
  const payOver = offeredFor(basis).paymentOverTheExemption
  const mayPay = basis === undefined || payOver
  const workingSays = working ? t('results.sending') : undefined

  async function send(
    request: () => Promise<Answer>,
    refusals: Record<string, string>,
    done: (body: unknown) => void,
    numbers?: Record<number, string>,
  ) {
    if (outstanding.current) {
      return
    }

    outstanding.current = true
    setWorking(true)

    try {
      const answer = await request()

      setAsking(null)

      if (answer.got === 'done') {
        done(answer.body)

        return
      }

      setRefused({ answer, refusals, numbers })
    } finally {
      outstanding.current = false
      setWorking(false)
    }
  }

  function pay(body: RowBooking) {
    if (payOver) {
      void send(
        () => askTheServer(membershipOnTheRow(one.memberNumber), overTheExemption(body), 'PUT'),
        WHEN_PAYING_OVER_THE_EXEMPTION,
        () => onChanged(t('admin.basisChanged')),
      )

      return
    }

    void send(() => askTheServer(paymentOnTheRow(one.memberNumber), body), WHEN_RECORDING_ON_THE_ROW, onPaid)
  }

  /** A question with one way of saying yes, „Da", and „Ne". */
  function yesOrNo(title: string, yes: () => void, said: ReactNode) {
    return (
      <Prompt
        title={title}
        choices={[{ label: t('admin.yes'), onChoose: yes }]}
        decline={t('admin.no')}
        onDecline={() => setAsking(null)}
        working={workingSays}
      >
        {said}
      </Prompt>
    )
  }

  const forTheSeason = <p>{t('verification.askExemptionWhose', { whose, season })}</p>

  function question(open: Asking): ReactNode {
    switch (open.act) {
      case 'grant':
        return yesOrNo(
          t('admin.askGrantExemption', { season }),
          () =>
            void send(
              () => askTheServer(membershipOnTheRow(one.memberNumber), GRANTING, 'POST'),
              WHEN_GRANTING_AN_EXEMPTION,
              () => onChanged(t('admin.exemptionGranted')),
            ),
          forTheSeason,
        )
      case 'cancel':
        return yesOrNo(
          t(askingToCancel(open.basis), { season }),
          () =>
            void send(
              () => askTheServer(membershipOnTheRow(one.memberNumber), cancelling(open.basis), 'DELETE'),
              WHEN_CANCELLING,
              () => onChanged(t('admin.membershipCancelled')),
            ),
          forTheSeason,
        )
      case 'toTheExemption':
        return yesOrNo(
          t('admin.askChangeToExemption', { season }),
          () =>
            void send(
              () => askTheServer(membershipOnTheRow(one.memberNumber), TO_THE_EXEMPTION, 'PUT'),
              WHEN_CHANGING_TO_THE_EXEMPTION,
              () => onChanged(t('admin.basisChanged')),
            ),
          forTheSeason,
        )
      case 'pay':
        return (
          <MemberPaymentSheet one={one} working={workingSays} onSend={pay} onClose={() => setAsking(null)} />
        )
      case 'delete':
        /* „Obriši člana?" [Obriši] [Odustani] (PDL, 22.10.2026); the member is named under the question,
           so the sheet says whom it is about. After a deletion the screen says „Član je obrisan." and
           takes the focus to its search, the row being gone (`AdminMembers.tsx`). */
        return (
          <Prompt
            title={t('admin.memberDeleteAsk')}
            choices={[
              {
                label: t('admin.form.delete'),
                onChoose: () => void send(onDelete, WHEN_DELETING_A_MEMBER, () => undefined),
              },
            ]}
            decline={t('admin.form.keep')}
            onDecline={() => setAsking(null)}
            working={workingSays}
          >
            <p>
              {whose}, {one.memberNumber}
            </p>
          </Prompt>
        )
    }
  }

  const word = basis === undefined ? null : t(basisWordOf(basis, one.gender))
  /* A dash where he holds no membership of the season on sale (owner, 22.10.2026), with the words
     behind it for a reader who does not see it. */
  const basisCell =
    word === null ? (
      <>
        <span aria-hidden="true">–</span>
        <span className="visually-hidden">{t('admin.basisNone')}</span>
      </>
    ) : (
      <span className={`tag tag--${basis}`}>{word}</span>
    )
  /**
   * „POŠALJI NOVU POZIVNICU", AT ONCE AND WITH NO SHEET (owner, 25.10.2026, PDL „Nova pozivnica od
   * administracije i rečenica o trkama: odgovori od 25.10.2026"), through the row's one guard (`send`), so a
   * second press while the first is out sends nothing. The sentence after it names the address the server
   * says it went to; it is DRAWN on the screen, as the deletion's is, because no sheet stood between the
   * press and the letter and nothing else on the row changes to say that anything happened.
   */
  function invite() {
    void send(
      () => askTheServer(invitationOnTheRow(one.memberNumber), {}, 'POST'),
      WHEN_SENDING_AN_INVITATION,
      (body) => {
        const to = addressIn(body)

        onInvited(to === null ? t('admin.invitationSentSomewhere') : t('admin.invitationSent', { email: to }))
      },
      WHAT_THE_NUMBER_SAYS_WHEN_INVITING,
    )
  }

  const invitable = one.invitation === 'due'
  const unreachable = one.invitation === 'noAccount'
  const country = countryName(one.country)
  const seasons = <MemberSeasons one={one} onAsk={setAsking} />

  return (
    <tr>
      <td>
        {listed === undefined ? <span>{whose}</span> : <ProfileLink competitor={listed}>{whose}</ProfileLink>}
        <span className="table__member-number members-table__under">
          {/* The number and the category in elements of their own, so each can be found by itself. */}
          <span>{one.memberNumber}</span> -{' '}
          <span className="table__category">
            {categoryLabel(categoryCodeFor(one.gender, one.ageBand, one.beginner), t)}
          </span>
        </span>
        <dl className="members-table__held">
          <div className="members-table__narrow">
            <dt>{t('admin.memberColumns.town')}</dt>
            <dd>
              {one.city} <span className="table__member-number">{country}</span>
            </dd>
          </div>
          <div className="table__phone-only">
            <dt>{t('admin.memberColumns.basis')}</dt>
            <dd>{basisCell}</dd>
          </div>
          <div className="table__phone-only">
            <dt>{t('admin.memberColumns.seasons')}</dt>
            <dd>{seasons}</dd>
          </div>
        </dl>
      </td>
      <td className="members-table__wide">
        {one.city}
        <span className="table__member-number members-table__under">{country}</span>
      </td>
      <td className="table__hide-phone">{basisCell}</td>
      <td className="table__hide-phone">{seasons}</td>
      <td className="members-table__options">
        <span className="members-actions">
          {/* „IZMENI PODATKE", A LINK AND NOT A BUTTON: it goes to a page, the card „Podaci" of his profile,
              at the address the profile has where the public list carries him, and by the number alone
              where it does not (a member whose fee has lapsed, whose card the administration still opens,
              `CompetitorData.tsx`). */}
          <ActionLink
            symbol={SYMBOL.pencil}
            word={t('admin.editMember')}
            name={t('admin.editMemberNamed', { name: whose })}
            className="entity-open"
            to={
              listed === undefined
                ? `/${locale}/takmicar/${one.memberNumber}${THE_DATA}`
                : `${profilePath(listed, locale)}${THE_DATA}`
            }
          />
          <ActionButton
            symbol={SYMBOL.banknote}
            word={t('admin.recordPayment')}
            className="entity-open"
            disabled={!mayPay}
            onClick={() => setAsking({ act: 'pay' })}
          />
          <ActionButton
            symbol={SYMBOL.undo}
            word={t('admin.cancelMembership')}
            className="entity-open"
            aria-disabled={basis === undefined ? true : undefined}
            onClick={() => {
              if (basis !== undefined) {
                setAsking({ act: 'cancel', basis })
              }
            }}
          />
          {/* THE ENVELOPE STANDS ON EVERY ROW, so the symbols keep their places (owner, 25.10.2026), and is
              switched off for real where no invitation is due, the shape of „Upiši uplatu" beside it: out of
              the order of focus, its box seen by the pointer only. Its name stays „Pošalji novu pozivnicu"
              either way; what the box says where it cannot act is why not („Član je već postavio lozinku.").

              The symbol is written as the same choice as the word, three times the envelope, and that is
              `components/actionSymbols.test.ts` and not style: it reads a word and its symbol only where the
              two are the same shape, and holds every word to the symbol the owner's map gives it. */}
          <ActionButton
            symbol={invitable ? SYMBOL.envelope : unreachable ? SYMBOL.envelope : SYMBOL.envelope}
            word={t(invitable ? 'admin.sendNewInvitation' : unreachable ? 'admin.invitationNoAccount' : 'admin.invitationNotNeeded')}
            name={t('admin.sendNewInvitation')}
            className="entity-open"
            disabled={!invitable}
            onClick={invite}
          />
          <ActionButton
            symbol={SYMBOL.cross}
            word={t('admin.form.delete')}
            name={t('admin.form.deleteNamed', { name: whose })}
            className="entity-open entity-delete members-actions__delete"
            onClick={() => setAsking({ act: 'delete' })}
          />
        </span>
        <div className="activate__said" role="status">
          {refused === null ? null : <ServerSaid answer={refused.answer} refusals={refused.refusals} numbers={refused.numbers} />}
        </div>
        {asking === null ? null : question(asking)}
      </td>
    </tr>
  )
}
