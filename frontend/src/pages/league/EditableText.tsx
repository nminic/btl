import { useState, type ReactNode } from 'react'
import { Markdown } from '../../components/Markdown'
import { TextEditor } from '../../components/TextEditor'
import { liga } from '../../forms/definitions'
import { limitOf } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import type { LeagueWords } from '../admin/leagueWrites'
import { SYMBOL } from '../../app/actionSymbol'
import { ActionButton } from '../../components/ActionButton'

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
 * because both are this component.
 *
 * **Written with the editor and kept as Markdown, since 16.10.2026** (PDL, „Ispravke sa ekrana
 * 16.10.2026", chosen among the options offered): „Uređivač je „vidiš šta dobijaš", sa dugmadima za
 * podebljano, kurziv, naslov, spisak i vezu; tekst se čuva kao Markdown, isto kao pisane strane."
 * The text is drawn by the component every written page is drawn by (`components/Markdown.tsx`),
 * which keeps the sentence of 03.10.2026 above: its bare addresses are links, in a new window, with
 * the address as their words. A text written before the editor is drawn the same way; one that has
 * no marks of Markdown in it is the paragraph it always was, its line breaks included. The box that
 * is being edited shows the text as it will be drawn, which is the point of the editor.
 *
 * **A mailbox typed into the text is a link to write to, since 17.10.2026** (PDL, „Ispravke sa
 * ekrana 17.10.2026", chosen with my recommendation): „Slično važi i za mailto tag, kad otkucam nešto
 * nalik mail adresi, treba da ga pretvoriš automatski u link za slanje maila." Which words are
 * mailboxes is `mailsIn`'s to say, and the link is drawn the way a bare address of a site is.
 *
 * **Every link carries `dir="ltr"` and `rel="noreferrer noopener"`**, and why is said where the
 * link is drawn (`components/Markdown.tsx`) and held by `pages/league/linkDirection.test.tsx`.
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

      {editing && (
        <TextEditor
          id={`${headingId}-text`}
          label={heading}
          value={value}
          /* The same cap the administration form puts on it. Rewriting in place took as much as
             anybody cared to paste, so the text could come back longer than the form that made it
             accepts, and the next person to open that form was told their own words were too
             long. The number lives in the definition (`forms/records.ts`). */
          maxLength={limitOf(liga, field)}
          leftId={`${headingId}-left`}
          describedBy={`${headingId}-left`}
          autoFocus
          /* Kept when the cursor leaves the box and its buttons, which is what leaving the plain box
             did: nothing is written on every key. */
          onChange={() => undefined}
          onLeave={(text) => void keep(text)}
        />
      )}

      {!editing && value === '' && <p className="profile__text">{t('leagues.notWritten')}</p>}

      {!editing && value !== '' && (
        /* Under the heading of its box, an h3, so a heading of its own is an h4. */
        <div className="profile__text">
          <Markdown text={value} under={3} addresses outward />
        </div>
      )}

      {canEdit && !editing && (
        <ActionButton symbol={SYMBOL.pencil} word={t('admin.change')} className="button button--secondary" onClick={() => setEditing(true)} />
      )}

      {said}
    </section>
  )
}
