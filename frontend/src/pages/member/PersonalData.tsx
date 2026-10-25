import { useEffect, useRef, useState } from 'react'
import { heldControl } from '../../forms/held'
import { formatDate } from '../../i18n/format'
import { AskedLabel } from '../../forms/AskedLabel'
import { registracija } from '../../forms/definitions'
import { PlaceField } from '../../forms/PlaceField'
import { choicesOf } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import type { MyData } from '../../session/theServer'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  AS_LONG_AS_THE_FORM_ALLOWS,
  NEVER_EMPTIED,
  THE_ACCOUNT_GOES_TO,
  TYPED_BOXES,
  WHEN_CHANGING_MY_DATA,
  whatChanged,
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
 * „Podaci""; „Član sam menja sve osim pola i datuma rođenja"). The town in the control the
 * registration draws it with (`PlaceField`), a name and its country; the size out of the seven the
 * registration offers, read off its definition. A town in another country moves the money he is
 * billed in, which is the server's to do (`ACountryMovesTheMoney`).</li>
 * <li><b>It does not carry the father's name</b>, which only the administration changes (PDL
 * 22.10.2026, „Ime oca i dalje menja samo administracija"), nor the gender and the date of birth.</li>
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
 * <p><b>One panel for every reader who has one</b>: the card „Podaci" of a member whose fee stands,
 * and the page „Moji podaci" of somebody who has not paid yet, which is the next piece of work (PDL
 * 22.10.2026: „Neka ima u navigaciji stranu Moji Podaci dok nije odobren koja je iznad Moja
 * Članarina"). Both send to the same route and are told the same sentences.
 */
export function PersonalData({ me }: { me: MyData }) {
  const { locale, t } = useI18n()

  /* WHAT THE SERVER HOLDS, held here and not read off `me` on every render, because a
     successful save moves it and nothing refetches the resource. It starts as what the server
     said a moment ago (`me`, which is read fresh every time this panel is drawn - a visit to
     another screen and back asks again), and a save moves it by exactly what was sent.

     The boxes START as the same four values, which is the whole of the fault of 18.10.2026: they
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
  const [typed, setTyped] = useState<Typed>(opened)
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const said = useRef<HTMLParagraphElement>(null)

  const changed = whatChanged(standing, typed)
  const nothing = Object.keys(changed).length === 0
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

  async function send(): Promise<void> {
    setAsking(true)

    const answered = await askTheServer(THE_ACCOUNT_GOES_TO, changed, 'PUT')

    /* WHAT WAS SENT BECOMES WHAT STANDS, and only what was sent. A field left out of the
       request is a field the route did not touch (ADL A54), so folding everything typed in
       here would claim the server kept a box this request never named. */
    if (answered.got === 'done') {
      setStanding((before) => ({ ...before, ...changed }))
    }

    setAnswer(answered)
    setAsking(false)
  }

  /* The four boxes he sees held, in the order the registration asks them. The gender and the date are
     said the way the portal says them everywhere (`registration.genderMale`, `formatDate`) and the
     number of the document is empty for a member who gave none. */
  const HELD = [
    {
      name: 'gender',
      label: t('registration.gender'),
      value: t(me.gender === 'M' ? 'registration.genderMale' : 'registration.genderFemale'),
    },
    { name: 'birthDate', label: t('registration.birthDate'), value: formatDate(me.birthDate, locale) },
    { name: 'fatherName', label: t('registration.fatherName'), value: me.fatherName },
    { name: 'idNumber', label: t('registration.idNumber'), value: me.idNumber },
  ]

  return (
    <>
      <section className="member__panel" aria-labelledby="account-personal">
        <h2 className="profile__section" id="account-personal">
          {t('account.personalTitle')}
        </h2>

        <form
          className="member__form"
          onSubmit={(event) => {
            event.preventDefault()

            /* A second press while the first is still out would send the same change twice
               and answer this reader about the second one. */
            if (!asking && !nothing) {
              void send()
            }
          }}
        >
          {TYPED_BOXES.map((name) => {
            /* **ASKED FOR WHERE THE SERVER WILL NOT TAKE IT EMPTY** (PENDING 217.5). One fact
               decides all three things a box says about itself, the star, `aria-required` and the
               word „neobavezno". It used to be that fact AND whether the portal could see what the
               server held in the box, because an address the portal could not see was a box a
               member could leave alone; the portal sees all four now, so the server's own list is
               the whole answer. The telephone is optional, because a blank one is how it is
               removed. */
            const asked = NEVER_EMPTIED.includes(name)

            return (
              <div className="rankings__field" key={name}>
                <AskedLabel id={`account-${name}`} asked={asked}>
                  {t(`registration.${name}`)}
                </AskedLabel>
                <input
                  id={`account-${name}`}
                  type="text"
                  value={typed[name]}
                  maxLength={AS_LONG_AS_THE_FORM_ALLOWS[name]}
                  aria-required={asked ? 'true' : undefined}
                  onChange={(event) => {
                    /* The answer goes the moment anything moves: a „saved" left standing
                       over a box being edited says the thing on the screen is what the
                       server holds, which it is not. */
                    setAnswer(null)
                    setTyped((before) => ({ ...before, [name]: event.target.value }))
                  }}
                />
              </div>
            )
          })}

          {/* THE TOWN, IN THE CONTROL THE REGISTRATION DRAWS IT WITH, and its country beside it.
              Asked for, as on the registration: the column is never empty (V7). */}
          <div className="rankings__field">
            <AskedLabel id="account-city">{t('registration.city')}</AskedLabel>
            <PlaceField
              id="account-city"
              name="city"
              value={typed.city}
              country={typed.country}
              required
              invalid={false}
              describedBy={undefined}
              onChange={(town, country) => {
                setAnswer(null)
                setTyped((before) => ({ ...before, city: town, country }))
              }}
            />
          </div>

          {/* THE SIZE, one of the seven the registration offers, read off its definition so the two
              cannot offer different sizes. */}
          <div className="rankings__field">
            <AskedLabel id="account-shirtSize">{t('registration.shirtSize')}</AskedLabel>
            <select
              id="account-shirtSize"
              value={typed.shirtSize}
              aria-required="true"
              onChange={(event) => {
                setAnswer(null)
                setTyped((before) => ({ ...before, shirtSize: event.target.value }))
              }}
            >
              {choicesOf(registracija, 'shirtSize').map((one) => (
                <option key={one.value} value={one.value}>
                  {t(one.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* **THE FOUR HE SEES AND DOES NOT CHANGE** (PDL 24.10.2026, owner: „clan ga vidi ali je disabled za
              menjanje. Moze samo da trazi od admina", and, chosen between offered outcomes with the
              recommendation, the same for the gender, the date of birth and the father's name). Held and
              not switched off, the way the portal holds a locked box everywhere (`forms/held.ts`,
              `FormRenderer`): `readOnly` and `aria-disabled`, so a keyboard reaches each of them, a screen
              reader reads the value and says it is held, and the number can be copied. The sentence under
              them is their description. They are never sent: the server refuses them by name
              (`MeWriteApi`), and `TYPED_BOXES` does not name them. */}
          {HELD.map(({ name, label, value }) => (
            <div className="rankings__field" key={name}>
              <label htmlFor={`account-${name}`}>{label}</label>
              <input
                id={`account-${name}`}
                type="text"
                className={heldControl(true)}
                value={value}
                readOnly
                aria-disabled="true"
                aria-describedby="account-held-note"
              />
            </div>
          ))}
          <p className="member__note" id="account-held-note">
            {t('account.heldNote')}
          </p>

          <p className="member__actions">
            {/* Told off rather than switched off, as everywhere else on the portal:
                `disabled` takes the button out of the tab order. Since 18.10.2026 it says nothing
                about why (PDL P11, owner: the sentences under the buttons are gone), so nothing
                points at a sentence. */}
            <button
              type="submit"
              className="button button--primary"
              aria-disabled={nothing || asking}
            >
              {t('account.save')}
            </button>
          </p>
        </form>

        {saved && (
          <p className="member__note" ref={said} tabIndex={-1} role="status">
            {t('account.saved')}
          </p>
        )}

        {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_CHANGING_MY_DATA} />}
      </section>
    </>
  )
}
