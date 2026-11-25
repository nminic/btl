import { MachineNote } from '../../components/MachineNote'
import { Markdown } from '../../components/Markdown'
import { shownOr } from '../../data/shownText'
import type { ShownText } from '../../data/types'

/**
 * A piece of what an organiser has written about a competition, read on the sheet of the competition
 * on the list of them.
 *
 * **It stands on the list of competitions and nowhere else, since 07.09.2026.** The owner moved
 * the terms and the prizes off the page of a single league and onto the list of all of them:
 * „Propozicije i Nagrade treba da se izlistavaju na ovoj strani, a ne kad se uđe u ligu… na strani
 * Lige ne postoje propozicije i nagrade (one se vide samo na listi svih liga)."
 *
 * **Overturned on 12.09.2026, put back on 13.09.2026, and the trace is kept rather than tidied
 * away.** On the 12th the owner asked for both boxes back on the page of a single competition,
 * read-only, and they were built; on the 13th he corrected himself („Pogrešio sam, ne vidi se na
 * pojedinačnim stranama lige. Na pojedinačnim stranama ostaje samo tabela kako jeste"), and the
 * sentence above stands again, unchanged. The reader who is about to move them a third time is
 * looking at a question that has been answered the same way twice.
 *
 * **Read here and changed in the administration, since 21.11.2026** (owner, PDL „Glava lista lige: na
 * desktopu sve u jednom redu”, chosen between the ones offered): „Ikonica (samo za onog ko ima pravo)
 * vodi na izmenu te lige u administraciji; male veze „Izmeni” kod Propozicija i Nagrada nestaju.” In
 * his words: „umesto malih edit na nivou Propozicija i Nagrada. Klikom na taj Edit (ko ga vidi, svakako
 * ima privilegije) treba da se ode na Izmenu te lige u Administraciji.” Until that day these two boxes
 * were changed in place, here, by whoever had the competitions (decision of 03.10.2026, which this one
 * overturns). Nothing on this sheet writes any more: the form of a competition in the administration
 * (`admin-liga.form.json`, its fields `rules` and `prizes`) is the one place they are changed, and the
 * way to it is the pencil in the head of the sheet (`pages/Leagues.tsx`).
 *
 * **Not drawn at all while nobody has written it**, for everybody: a heading over nothing tells a
 * reader nothing, and the one person a sentence such as „not written yet" was ever for was the one who
 * could fill the box in here, and nobody can.
 *
 * **An address in the text is a link, since 03.10.2026** (PDL P15, chosen among the options
 * offered): „Adresa u Propozicijama i Nagradama svake lige postaje veza. Svaka adresa koja počinje
 * sa `www.` ili `https://` otvara se u novom prozoru, sa vidljivim domenom, isto kao veza uz opis
 * događaja (27.08.2026)." The paragraph of the terms of the RunTrace league has to carry
 * `www.runtrace.net` and open that portal. Which words are addresses is `addressesIn`'s to say.
 * What a link says is the address as it was typed, and that is what makes the domain visible: no
 * second element repeats it beside the link. Both boxes draw it the same way, because both are this
 * component.
 *
 * **Kept as Markdown, since 16.10.2026** (PDL, „Ispravke sa ekrana 16.10.2026", chosen among the
 * options offered): „Uređivač je „vidiš šta dobijaš", sa dugmadima za podebljano, kurziv, naslov,
 * spisak i vezu; tekst se čuva kao Markdown, isto kao pisane strane." The text is drawn by the
 * component every written page is drawn by (`components/Markdown.tsx`), which keeps the sentence of
 * 03.10.2026 above: its bare addresses are links, in a new window, with the address as their words. A
 * text written before the editor is drawn the same way; one that has no marks of Markdown in it is the
 * paragraph it always was, its line breaks included.
 *
 * **A mailbox typed into the text is a link to write to, since 17.10.2026** (PDL, „Ispravke sa
 * ekrana 17.10.2026", chosen with my recommendation): „Slično važi i za mailto tag, kad otkucam nešto
 * nalik mail adresi, treba da ga pretvoriš automatski u link za slanje maila." Which words are
 * mailboxes is `mailsIn`'s to say, and the link is drawn the way a bare address of a site is.
 *
 * **Every link carries `dir="ltr"` and `rel="noreferrer noopener"`**, and why is said where the
 * link is drawn (`components/Markdown.tsx`) and held by `pages/league/linkDirection.test.tsx`.
 *
 * **WHAT THE READER IS SHOWN IS THE SERVER'S TO SAY, since 25.11.2026** (owner, PDL P18, „Automatski prevod
 * sadržaja koji posetilac vidi"): `shown` is the translation into the language of the address, or the words as
 * written where there is none yet, and it is marked with the language it is really in so that a screen reader reads
 * Serbian on `/en` as Serbian (ADL A7), and said to be the machine's where it is. `value` is the words as written
 * and decides only whether the box is drawn: a text nobody wrote is not translated into something somebody did.
 */
export function LeagueText({
  value,
  shown,
  headingId,
  heading,
}: {
  value: string
  shown?: ShownText
  headingId: string
  heading: string
}) {
  if (value === '') {
    return null
  }

  const said = shownOr(value, shown)

  return (
    <section aria-labelledby={headingId}>
      <h3 className="profile__section" id={headingId}>
        {heading}
      </h3>

      {/* Under the heading of its box, an h3, so a heading of its own is an h4. */}
      <div className="profile__text">
        <Markdown text={said.text} under={3} addresses outward lang={said.language ?? undefined} />
        <MachineNote shown={said} />
      </div>
    </section>
  )
}
