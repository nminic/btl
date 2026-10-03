import { useState, type ReactNode } from 'react'
import { liga } from '../../forms/definitions'
import { limitOf } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import type { LeagueWords } from '../admin/leagueWrites'
import { addressesIn } from './addressesIn'

/**
 * The words as written, with every address in them drawn as a link to somebody else's page.
 *
 * `target="_blank"` and `rel="noreferrer noopener"` are the shape of the link to an outside page
 * that the event's page already draws (`pages/EventDetail.tsx`): a reader in the middle of a list
 * of competitions keeps their place, the other end is not told which page they came from, and the
 * page that opens cannot reach back through `window.opener`. Written out, and not left to what a
 * browser does for `_blank`, for the reason the guard of the event's link gives
 * (`pages/details.test.tsx`): a rule that depends on a default is a rule nobody can read.
 *
 * **`dir="ltr"` on every link, since 03.10.2026** (review of PR 484, measured in Chrome 154). The
 * words of a link are the address as it was typed, and the words beside it were typed by the same
 * hand: a right-to-left override or embedding in a neighbouring word (U+202E, U+202B, U+2067)
 * reorders the characters of the link as they are drawn. Typed as
 * `https://zlo.example/#/ten.ecartnur.www//:sptth`, the link was drawn as
 * `https://www.runtrace.net/#/elpmaxe.olz//:sptth` and opened `zlo.example`. Neither `addressesIn`
 * nor the gate beneath it can see that, because the control is not in the address but in the word
 * before it. The attribute makes the link an isolate with a direction of its own, so what is drawn
 * is what was typed, in the order it was typed, which is what its accessible name always was. It is
 * an attribute and not a rule of a sheet so that no change to a sheet can take it away, and it
 * changes nothing about which words are a link. **Derived from PDL P15 ("sa vidljivim domenom",
 * "domen je sama otkucana adresa") and not the owner's word.** What it does not do, said here and
 * not left to be found: the words around a link are drawn as their author typed them, so an
 * override in them still reorders them. `pages/league/linkDirection.test.tsx` holds that every link
 * carries the attribute and that nothing which draws one from `addressesIn` goes without a case.
 *
 * **Every run that is not an address is a string, and a string in a child position is a text
 * node**, so nothing an administrator typed is ever read as markup. The terms of a competition are
 * not moderated (PDL, 01.09.2026: „Administratorova reč stoji"), which is the reason that matters
 * here: what a reader sees has to be exactly what was typed. A text with no address draws as the one
 * text node it always did.
 */
function drawn(text: string): ReactNode {
  return addressesIn(text).map((piece, at) =>
    piece.href === null ? (
      piece.text
    ) : (
      <a key={at} href={piece.href} target="_blank" rel="noreferrer noopener" dir="ltr">
        {piece.text}
      </a>
    ),
  )
}

/**
 * A piece of what an organiser has written about a competition, read where it is written.
 *
 * **It stands on the list of competitions and nowhere else, since 07.09.2026.** The owner moved
 * the terms and the prizes off the page of a single league and onto the list of all of them:
 * „Propozicije i Nagrade treba da se izlistavaju na ovoj strani, a ne kad se uđe u ligu… na strani
 * Lige ne postoje propozicije i nagrade (one se vide samo na listi svih liga)."
 *
 * **Overturned on 12.09.2026, put back on 13.09.2026, and the trace is kept rather than tidied
 * away.** On the 12th the owner asked for both boxes back on the page of a single competition,
 * read-only, and they were built; on the 13th he corrected himself — „Pogrešio sam, ne vidi se na
 * pojedinačnim stranama lige. Na pojedinačnim stranama ostaje samo tabela kako jeste" — and the
 * sentence above stands again, unchanged. The reader who is about to move them a third time is
 * looking at a question that has been answered the same way twice.
 *
 * What the 13th did keep of that day's work is on this same screen, one section further down: the
 * events and races a competition counts, inside a box that folds (`league/LeagueEvents.tsx`).
 *
 * **Changed where it is read, and not in a screen of its own.** Asked where a moderator should
 * edit it now that the page it lived on no longer has it, the owner chose the same place it is
 * read (07.09.2026). A screen that shows one thing and changes it somewhere else is a screen
 * where the two can disagree, and the person who spots the mistake is the one who cannot fix it.
 *
 * **An address in the text is a link, since 03.10.2026** (PDL P15, chosen among the options
 * offered): „Adresa u Propozicijama i Nagradama svake lige postaje veza. Svaka adresa koja počinje
 * sa `www.` ili `https://` otvara se u novom prozoru, sa vidljivim domenom, isto kao veza uz opis
 * događaja (27.08.2026)." The paragraph of the terms of the RunTrace league has to carry
 * `www.runtrace.net` and open that portal. Which words are addresses is `addressesIn`'s to say.
 * What a link says is the address as it was typed, and that is what makes the domain visible: no
 * second element repeats it beside the link, as the event's page did on that day for the words of
 * its own link, which say nothing about where a press leads. Both boxes draw it the same way,
 * because both are this component, and the box that is being edited shows the text as it was typed
 * and not as it is drawn.
 *
 * Hides itself while nobody has written it and nobody may.
 */
export function EditableText({
  value,
  field,
  headingId,
  heading,
  canEdit,
  onSave,
  said,
}: {
  value: string
  /**
   * Which field of the competition this is, so the box is bounded by **its own** limit.
   *
   * It read `rules` for both until 07.09.2026, which was right only for as long as the two limits
   * were the same number. A review measured what happens when they part: with the prizes lowered
   * to 500 in the definition, a moderator writing here was let past 500 and the administration
   * form then told them their own text was too long. That is the very fault `limitOf` exists to
   * prevent, moved one screen along.
   */
  field: LeagueWords
  headingId: string
  heading: string
  canEdit: boolean
  /**
   * Keeps what was written, and says whether it was kept.
   *
   * <p><b>It answered nothing until 25.09.2026, and it could not have.</b> What it did was
   * write into the session overlay, which always succeeds; from that day it is
   * `PUT /api/leagues/{id}` (`pages/Leagues.tsx`), which can refuse - a competition whose
   * season has frozen is not changed at all (PDL P15a point 2) - and can fail to arrive.
   *
   * <p><b>The box therefore stays open on anything but a yes, holding what was typed.</b>
   * Closed regardless, a refusal would put the served text back on the screen and take
   * four thousand characters of somebody's propositions with it, over a refusal he can do
   * nothing about by retyping them.
   */
  onSave: (text: string) => Promise<boolean>
  /** What was said about the last press on this box, drawn where it was pressed. */
  said?: ReactNode
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)

  /* NO LOCK ON A SECOND PRESS, AND THAT IS DELIBERATE RATHER THAN MISSING. One stood here
     for an hour, copied from the forms, where it is right: a second press of Save on a
     NEW record makes a second row. Here a second write can only happen by focusing the box
     again and leaving it again, so what it carries is NEWER words - and a lock would drop
     them in silence while the box closed as though they had been kept. The unchanged
     check below is what stops the common repeat, which is leaving a box nobody typed in. */
  async function keep(text: string): Promise<void> {
    /* NOTHING MOVED, SO NOTHING IS SENT, and that is the portal's own rule rather than
       thrift. `pages/member/myAccount.ts` sends only what differs from what stands, with
       its reason: „pressing Save twice sends nothing the second time". Here the box is
       left by simply clicking elsewhere, so an unchanged blur was the COMMON case, and
       every one of them would have been a `PUT` of the record onto itself - which the
       route can refuse (a frozen season) and which would then draw a refusal at somebody
       who changed nothing. Compared exactly as typed and never trimmed: what is compared
       has to be what would be sent. */
    if (text === value) {
      setEditing(false)

      return
    }

    const kept = await onSave(text)

    if (kept) {
      setEditing(false)
    }
  }

  if (value === '' && !canEdit) {
    return null
  }

  return (
    <section aria-labelledby={headingId}>
      <h3 className="profile__section" id={headingId}>
        {heading}
      </h3>

      {editing ? (
        <textarea
          className="field__control league__editor"
          autoFocus
          aria-label={heading}
          defaultValue={value}
          /* The same cap the administration form puts on it. Rewriting in place took as much as
             anybody cared to paste, so the text could come back longer than the form that made it
             accepts, and the next person to open that form was told their own words were too
             long. The number lives in the definition (`forms/records.ts`). */
          maxLength={limitOf(liga, field)}
          onBlur={(event) => void keep(event.target.value)}
        />
      ) : (
        <p className="profile__text">{value === '' ? t('leagues.notWritten') : drawn(value)}</p>
      )}

      {canEdit && !editing && (
        <button type="button" className="button button--secondary" onClick={() => setEditing(true)}>
          {t('admin.change')}
        </button>
      )}

      {said}
    </section>
  )
}
