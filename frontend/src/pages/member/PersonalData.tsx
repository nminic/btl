import { useEffect, useRef, useState } from 'react'
import { FormRenderer } from '../../forms/FormRenderer'
import { valuesFor } from '../../forms/records'
import type { FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import type { MyData } from '../../session/theServer'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { WHAT_HE_SEES_HELD, hisOwnForm } from '../profile/memberData'
import {
  THE_ACCOUNT_GOES_TO,
  WHEN_CHANGING_MY_DATA,
  whatChanged,
  type Sent,
  type Standing,
  type Typed,
} from './myAccount'

/**
 * THE MEMBER'S OWN DATA, WHICH HE CHANGES HIMSELF AND WHICH TAKES EFFECT AT ONCE.
 *
 * <p>PDL P28b, 1, owner 24.09.2026: „Licni podaci (adresa, telefon, ime, prezime) stupaju
 * odmah. Red za proveru ceka samo ono sto javnost vidi kao sadrzaj: biografija i slika."
 * That sentence is the whole shape of this panel, and it is the reason there is no „sent
 * for approval" anywhere on it: the picture and the words about oneself, on the screen of the
 * settings, are the ones that wait, and they say so in their own words.
 *
 * <p><b>What it deliberately does NOT do, written here rather than left to be found.</b>
 *
 * <ul>
 * <li><b>It shows what the postal address and the telephone are today, since 18.10.2026.</b>
 * It did not before: nothing served them, so those two boxes opened empty after every refresh
 * and said so beside themselves. The owner saved both on QA, was told „Sačuvano", refreshed and
 * found them empty, which read as the portal having lost them. They were never lost - the route
 * has written both since 24.09.2026 - but a screen that cannot show a saved value is, to the
 * person who saved it, the same as one that did not keep it. {@code GET /api/me} carries both now
 * (`MeApi.MyOwnRecord`), to him alone, and the public record still carries neither.</li>
 * <li><b>It carries the town and the shirt size since 23.10.2026</b>, when it moved from the screen
 * of the settings to the card „Podaci" of his own profile (PDL 22.10.2026, „Profil dobija karticu
 * „Podaci""; „Član sam menja sve osim pola i datuma rođenja"), and from there to „Moji podaci" on
 * 07.11.2026. The town in the control the
 * registration draws it with (`PlaceField`), a name and its country; the size out of the seven the
 * registration offers, read off its definition. A town in another country moves the money he is
 * billed in, which is the server's to do (`ACountryMovesTheMoney`).</li>
 * <li><b>It does not send the father's name</b>, which only the administration changes (PDL
 * 22.10.2026, „Ime oca i dalje menja samo administracija"), nor the gender, the date of birth and the
 * number of the document: since 24.10.2026 he sees all four, held (below), and none of them travels.</li>
 * <li><b>It does not carry the address of electronic post.</b> The owner decided on
 * 24.09.2026 that a member changes it himself „ali mora da potvrdi novu", because that
 * address is also how he signs in and an unconfirmed change is somebody taking the account.
 * <b>No route confirms one</b> - measured against every {@code @...Mapping} the backend
 * declares - so this screen does not invent one, and since 18.10.2026 it does not draw the
 * disabled field that used to stand for it either (below).</li>
 * </ul>
 *
 * <p><b>And the box of what he may read and not change is gone</b> (PDL P11, owner, 18.10.2026,
 * „Strana Podešavanja, sa snimaka": „Izlazi ceo boks „Podaci koji se ne menjaju ovde" (pol, kategorija,
 * mesto, njihova objašnjenja i zaključano polje za adresu elektronske pošte)"). It drew the gender, the
 * category and the town, three sentences about why they are not moved here and the disabled field for the
 * address of post. The decisions they explained stand (PDL P28b, 2: the date of birth and the gender are an
 * administrator's), and the server still refuses them by name (`notYoursToChange`); what is gone is the
 * screen saying so. The date of birth is not shown anywhere, as before.
 *
 * <p><b>Drawn in the shape of the registration since 06.11.2026</b> (PDL, „Profil: forma „Podaci" po
 * obliku forme za prijavu", owner: „Na podacima struktura forme treba da bude kao na formularu za prijavu,
 * dakle ne sve jedno ispod drugog."): the registration's own fields, rows and groups
 * (`profile/memberData.ts`, `hisOwnForm`), drawn by the renderer every form of the portal is drawn by, in
 * one column on a telephone and a tablet and in thirds from 51.25em (`forms/FormRenderer.css`). The four
 * he does not change stand where the registration asks them, held (`fixed`), and the sentence that says
 * who changes them stands above the fields and describes each of the four (`fixedSaidBy`).
 *
 * <p><b>One panel for every reader who has one</b>, on one page: „Moji podaci", of a member whose fee
 * stands and of somebody who has not paid yet (PDL 07.11.2026, „Član svojim podacima pristupa iz glavnog
 * menija”; and 22.10.2026: „Neka ima u navigaciji stranu Moji Podaci dok nije odobren koja je iznad Moja
 * Članarina"). Both send to the same route and are told the same sentences.
 */
export function PersonalData({ me }: { me: MyData }) {
  const { t } = useI18n()

  /* WHAT THE SERVER HOLDS, held here and not read off `me` on every render, because a
     successful save moves it and nothing refetches the resource. It starts as what the server
     said a moment ago (`me`, which is read fresh every time this panel is drawn - a visit to
     another screen and back asks again), and a save moves it by exactly what was sent.

     The boxes START as the same values, which is the whole of the fault of 18.10.2026: they
     used to open empty for the address and the telephone and the member who had saved them read
     that as the portal having lost them. */
  const opened: Standing = {
    firstName: me.firstName,
    lastName: me.lastName,
    address: me.address,
    phone: me.phone,
    city: me.city,
    country: me.country,
    shirtSize: me.shirtSize,
  }
  const [standing, setStanding] = useState<Standing>(opened)
  /* What is on the screen, as the form hands it over every time a field moves (`onChange`). */
  const [typed, setTyped] = useState<Typed>(opened)
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  /* The same fact as `asking`, as a press can see it in the tick the send begins (`sendIsOut`). */
  const out = useRef(false)
  const said = useRef<HTMLParagraphElement>(null)
  const [form] = useState(() => hisOwnForm(me.idNumber !== ''))
  const [initial] = useState(() => valuesFor(form, me))

  const nothing = Object.keys(whatChanged(standing, typed)).length === 0
  const saved = answer !== null && answer.got === 'done'
  const refusal = answer !== null && answer.got !== 'done' ? answer : null

  /* Said out loud, because what the reader pressed is answered by a sentence that appears
     somewhere else on the screen: without this the focus stays on the button and a screen
     reader is told nothing at all (WCAG 2.2 SC 4.1.3). The same shape the panels of the picture and
     of the words about oneself use. */
  useEffect(() => {
    if (saved) {
      said.current?.focus()
    }
  }, [saved])

  async function send(values: FormValues): Promise<void> {
    const changed = whatChanged(standing, sentOf(values))

    /* Told off rather than switched off while nothing differs (`sendIsHeld`), and the attribute stops
       nothing by itself, so a press with nothing to save is refused here. */
    if (Object.keys(changed).length === 0) {
      return
    }

    /* A second press while the first is still out would send the same change twice
       and answer this reader about the second one (`sendIsOut`). */
    out.current = true
    setAsking(true)

    const answered = await askTheServer(THE_ACCOUNT_GOES_TO, changed, 'PUT')

    /* WHAT WAS SENT BECOMES WHAT STANDS, and only what was sent. A field left out of the
       request is a field the route did not touch (ADL A54), so folding everything typed in
       here would claim the server kept a box this request never named. */
    if (answered.got === 'done') {
      setStanding((before) => ({ ...before, ...changed }))
    }

    setAnswer(answered)
    out.current = false
    setAsking(false)
  }

  return (
    <section className="member__panel" aria-labelledby={`form-${form.id}-title`}>
      <FormRenderer
        form={form}
        title={t('account.personalTitle')}
        initial={initial}
        /* **THE FOUR HE SEES AND DOES NOT CHANGE** (PDL 24.10.2026, owner: „clan ga vidi ali je disabled
           za menjanje. Moze samo da trazi od admina"), held the way the portal holds a locked box
           everywhere (`forms/held.ts`): `readOnly` and `aria-disabled`, so a keyboard reaches each of
           them, a screen reader reads the value and says it is held, and the number can be copied. They
           are never sent: the server refuses them by name (`MeWriteApi`), and `WHAT_THIS_SCREEN_SENDS`
           does not name them. */
        fixed={WHAT_HE_SEES_HELD}
        fixedSaidBy="account-held-note"
        fixedUnmarked
        above={
          <p className="member__note" id="account-held-note">
            {t('account.heldNote')}
          </p>
        }
        /* Told off rather than switched off, as everywhere else on the portal: `disabled` takes the
           button out of the tab order. Since 18.10.2026 it says nothing about why (PDL P11, owner: the
           sentences under the buttons are gone, „Izmeni nešto da bi imao šta da sačuvaš." among them). */
        sendIsHeld={nothing || asking ? true : undefined}
        sendIsOut={out}
        onChange={(values) => {
          /* The answer goes the moment anything moves: a „saved" left standing over a box being
             edited says the thing on the screen is what the server holds, which it is not. */
          setAnswer(null)
          setTyped(sentOf(values))
        }}
        onSubmit={(values) => {
          void send(values)
        }}
      />

      {saved && (
        <p className="member__note" ref={said} tabIndex={-1} role="status">
          {t('account.saved')}
        </p>
      )}

      {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_CHANGING_MY_DATA} />}
    </section>
  )
}

/**
 * What of the form this panel sends, out of everything it draws: the held four are not among them.
 *
 * <p>Every one of the seven is in what the form hands over, both at a move and at the press: the renderer
 * fills each field of its definition, and the country beside the town, before it hands anything out
 * (`FormRenderer`, `filled`), and none of these is ever off the screen. So there is no „missing" to read.
 */
function sentOf(values: FormValues): Typed {
  const text = (name: Sent): string => String(values[name])

  return {
    firstName: text('firstName'),
    lastName: text('lastName'),
    address: text('address'),
    phone: text('phone'),
    city: text('city'),
    country: text('country'),
    shirtSize: text('shirtSize'),
  }
}
