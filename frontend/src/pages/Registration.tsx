import { useRef, useState } from 'react'
import { useFilterParams } from '../app/useFilterParams'
import { storedDate } from '../forms/dateField'
import { registracija } from '../forms/definitions'
import { FormRenderer } from '../forms/FormRenderer'
import type { FormValues } from '../forms/types'
import { REFERRAL_CODE } from '../data/pricing'
import { askTheServer, type Answer } from './account/askTheServer'
import { WHEN_REGISTERING } from './account/refusals'
import { ServerSaid } from './account/ServerSaid'
import { useSend, useSent } from './sent'
import { useI18n } from '../i18n/useI18n'

/**
 * One value of the form, as a string, whatever it really is.
 *
 * <p><b>Not `String(...)`, and that is a fault this would otherwise have had.</b> A
 * field the form has hidden is not in the values at all - the parent's signature for
 * anybody sixteen or over - and `String(undefined)` is the nine letters of the word,
 * which would have travelled to the server as somebody's answer. Anything that is not
 * a string is nothing here instead, which is what the route reads a blank as
 * (`isNothing`).
 */
function written(values: FormValues, name: string): string {
  const value = values[name]

  return typeof value === 'string' ? value : ''
}

/**
 * THE BODY `/api/registration` TAKES, BUILT NAME BY NAME AND NEVER BY SPREADING.
 *
 * <p><b>Why every field is written out rather than `{ ...values }`.</b> A mismatch of
 * names is the one fault on this road that says nothing: the route reads a name it
 * does not find as `null`, answers „the form is not complete", and names no field, so
 * a reader is told to fix something and nobody - him or us - can tell what. Written
 * out, the two lists can be read side by side against `RegistrationApi.Typed`.
 *
 * <p><b>And spreading would send the wrong value for the one field that has two.</b>
 * `passwordRepeat` is read out of `agreeing` and not out of `values`, which is what
 * makes a mismatch a mismatch on the server as well; spread, both boxes would travel as
 * the same string and every mistyped repeat would be a success. `referredBy` is the
 * other way round: it is not a field of the form at all, so no spread could ever
 * produce it.
 *
 * <p>~~The form also carries a `photo`, whose value is the NAME OF A FILE ON SOMEBODY'S
 * DISK, so spreading would send a stranger's file name for nothing.~~ <b>That reason
 * went on 28.09.2026 with the field itself</b> (owner: „Profilna sekcija se sa slikom i
 * svojim recima izbacuje iz registracione forme - to ce clan popunjavati naknadno kad
 * bude odobren"). The picture is now given to `POST /api/me/photo` once the account is
 * live, so there is no picture in these values to leave out.
 *
 * @param values what the form sends, already trimmed and with hidden fields gone
 * @param agreeing the fields that only agree with another one, which is the repeated
 *   password: the route asks for it by name, and what travels is what was really typed
 * @param referral the code this member arrived by, or nothing
 */
function theBody(values: FormValues, agreeing: FormValues, referral: string | null): object {
  return {
    firstName: written(values, 'firstName'),
    lastName: written(values, 'lastName'),
    fatherName: written(values, 'fatherName'),
    /* THROUGH `storedDate`, AND THIS WAS A REAL FAULT RATHER THAN A TIDYING. A date
       field HOLDS what the region reads, dd/mm/gggg, because that is what somebody
       typed and what goes back into the box; `Typed.birthDate` is read by
       `LocalDate.parse`, which takes yyyy-mm-dd and nothing else. Sent as it stands,
       „12/04/1985" is not a day, `theDay` answers nothing, and EVERY registration this
       portal makes is refused with „the form is not complete" naming no field.
     *
       The same crossing as `NewResult.tsx`, and through the same function: it reads the
       date or throws saying what was in the box, rather than answering with an empty
       string. An empty one would travel and be refused, which is the silent half of the
       same fault. Nothing can reach the throw, because the form refuses an unreadable
       date before it submits (`forms/validate.ts`), and the body is built on the press
       rather than inside the sending, so the day something does reach it, it stops where
       the portal stops rather than becoming a promise nobody is holding. */
    birthDate: storedDate(written(values, 'birthDate')),
    gender: written(values, 'gender'),
    /* A BOOLEAN AND NOT THE WORD „yes", and this was a real fault rather than a
       tidying: the form offers the strings `yes` and `no` (`registracija.form.json`)
       and `Typed.firstSeason2027` is a `Boolean`. Jackson does not translate one into
       the other - it refuses the whole request before the handler runs at all, so what
       came back was not even „the form is not complete" but a bare 400 with no reason
       in it, which this screen would have had to call „the server answered 400". */
    firstSeason2027: values.firstSeason2027 === 'yes',
    email: written(values, 'email'),
    password: written(values, 'password'),
    /* What the second box really holds, not the first one sent twice. Whether they
       agree is the server's question as well as the form's, and a screen that answered
       it by copying would make every mismatch a success - which `NewPassword.tsx` calls
       a mistake in as many words. */
    passwordRepeat: written(agreeing, 'passwordRepeat'),
    address: written(values, 'address'),
    /* THE TOWN GOES BY NAME AND COUNTRY, AND `placeId` IS DELIBERATELY NOT SENT.
     *
       `theTown` takes exactly one of the two shapes and refuses both together, so this
       is not a preference but the only one of them this form can fill: `PlaceField`
       writes the town's NAME and its country code, never the GeoNames mark that
       `placeId` means, and a mark has no source anywhere in the values.
     *
       PDL of 11.08.2026 is still kept, by the screen rather than by the body: a town
       the codebook recognises has its country switched off beside it, so nobody can
       put Belgrade in France.
     *
       **The boundary this leaves, written down rather than left to be found.** 1616
       name-and-country pairs in the codebook are carried by more than one town, so a
       registration in one of those resolves to whichever row the country query returns
       first. Carrying the mark would end that, and it is its own job: it reaches into
       `PlaceField` and `FormRenderer`, which the form for events draws too
       (`btl-produkt/PENDING.md`). */
    city: written(values, 'city'),
    country: written(values, 'country'),
    idNumber: written(values, 'idNumber'),
    phone: written(values, 'phone'),
    shirtSize: written(values, 'shirtSize'),
    /* ~~`bio`, which this form asked for at the moment of joining.~~ It went on
       28.09.2026 with the picture beside it, and `RegistrationApi.Typed` no longer
       declares it. Sending it anyway would be a key nothing reads, which is the one
       shape this body is written out name by name to make impossible. Where the words
       go now is `PUT /api/me`, from `member/ProfileBio.tsx`, and that road puts them in
       front of a moderator before anybody else reads them. */
    healthStatement: values.healthStatement === true,
    parentConsent: written(values, 'parentConsent'),
    parentRelation: written(values, 'parentRelation'),
    /* `null` and never the empty string, which is the third state the record's own type
       does not have: an address that said `?preporuka=` with nothing after it used to
       send `referredBy: ''` and have somebody told a credit was recorded that nobody
       could ever be paid. */
    referredBy: referral,
  }
}

/* The form itself is the JSON definition; this screen only decides what happens with the
 * values. ~~Until the backend exists, it carries two of them on the confirmation's own
 * entry in the history, long enough to say where the letter of confirmation went.~~
 *
 * **The backend exists as of 21.09.2026 and this screen sends to it.** What the entry in
 * the history carries is unchanged and still two facts; what changed is that they are now
 * written after a server has answered 204, rather than the moment a press landed.
 *
 * **PDL, owner: „Registracija se radi iskljucivo na sajtu. Niko ne moze tehnicki da se
 * registruje mimo sistema."** This is the one door, and until today it opened onto nothing:
 * the confirmation said „Poslali smo poruku na …" while no message had been asked for and
 * no account written. */
export function Registration() {
  const { locale, t } = useI18n()
  /* **Held by the address, not by the screen.** Drawn in place, the entry under this
     confirmation was the form itself, and one press forward brought it back filled in:
     the password, the electronic address, the street and the number of an identity
     document, on whatever machine the member happened to be using. Every other screen
     that confirms a sending was put right on 06.09.2026 and this one was left, because it
     was not on the owner's list; he then asked for it („Popravi isto kao ostalih pet").

     Two facts travel, and only two: where the letter went, and whether somebody brought
     this member. What was typed does not, which is the whole point. */
  const said = useSent()
  const where = Reflect.get(Object(said), 'email')
  const sent =
    typeof where === 'string'
      ? { email: where, referred: Reflect.get(Object(said), 'referred') === true }
      : null
  const confirm = useSend()
  const [resent, setResent] = useState(false)
  /* What the server answered, where it has answered anything that is not „done". A
     registration that succeeded leaves this screen altogether, so the only answer this
     ever holds is one the reader is owed a sentence about. */
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const [sending, setSending] = useState(false)
  /* WHAT A SECOND PRESS COSTS HERE, WHICH IS NOT WHAT IT COSTS ELSEWHERE:
     `/api/registration` WRITES A ROW AND POSTS A LETTER, so a second request is answered
     409 BECAUSE OF THE FIRST, and this very person is told his own address belongs to
     somebody else.

     A ref and not the state beside it, and the comment is careful about what that buys,
     because an earlier draft of it was not. `sending` would hold every press the cases
     below make, since React redraws between two awaited clicks. The ref is narrower and
     correct rather than measurably better: it is read and written in the same tick, so it
     also refuses two presses that arrive before a redraw. **That narrower half has no
     case of its own** - a case would have to reach inside React's scheduling to make two
     presses land in one tick - and it is written down here rather than claimed. What IS
     measured is the ordinary double press, and that the guard lets go again once the
     server has answered. */
  const outstanding = useRef(false)
  const [params] = useFilterParams()
  /* A referral code and not whatever the address carried.
   *
   * `get` answers the empty string for `?preporuka=` with nothing after it, so a
   * link that lost its code while being copied still had somebody told „Prijava
   * je zabeležena kao preporuka" over a credit nobody could ever be paid, and
   * `referredBy: ''` went out, a third state the record's own type does not have.
   *
   * And anything at all fitted through: `?preporuka="><img src=x onerror=...>`
   * arrived in what is sent, word for word, sixty eight characters of it. React
   * draws none of it and nothing here puts it in an address, so it is not an
   * attack today; it becomes one the day a backend keeps it and an
   * administration screen writes out who brought whom. The shape is known and
   * costs one line, so it is checked at the door rather than migrated later. */
  const carried = params.get('preporuka') ?? ''
  const referral = REFERRAL_CODE.test(carried) ? carried : null

  /* THE CLOSED PAGE STOOD HERE AND IS GONE (PDL, "Zabrana registracije pre 01.10.2026 se
   * SKIDA", owner 27.09.2026): „Zapravo bih najradije da skinem tu zabranu i da mogu prijave
   * odmah da krenu, a svakako niko nece pristupiti ovome pre nego sto sajt bude live 1.10."
   * It read `registrationOpen(today)` off the browser's own clock and drew a page saying the
   * form was not open yet in its place. The launch plan itself has not moved (30.09/01.10,
   * owner 14.09.2026): what changed is that this screen stopped being the one enforcing it,
   * since the site a visitor actually reaches before 15 October is still the old portal.
   */
  if (sent !== null) {
    /* What happens next, and not what was typed.
     *
     * It used to print every field that had been submitted, under its own name
     * in the code and with no translation: `password` and `passwordRepeat`
     * among them, in plain sight, on the screen the owner shows first. It was a
     * tool for reviewing the form and it read like a debugger left switched on.
     *
     * PDL P22 says what belongs here instead: the address the letter went to,
     * that the letter is what activates the account, where to look if it does
     * not arrive, and a way to ask for another one. */
    return (
      <div className="registration-done" role="status">
        <h1>{t('registration.doneTitle')}</h1>
        <p>{t('registration.doneText', { email: sent.email })}</p>
        <p>{t('registration.checkSpam')}</p>
        {/* Said only to somebody who arrived by a link, and it says both halves
            of the rule: the referral is recorded now, and it pays when this
            member's own fee is activated. Whoever brought them is not named,
            since the code is theirs and not this member's to be told. */}
        {sent.referred ? <p>{t('registration.doneReferral')}</p> : null}
        {/* Asking again says so and stays where it is. It used to empty `sent`,
            which unmounted this confirmation and handed back a blank form:
            nothing said the letter had gone out again, and everything typed was
            gone. A control has to do what it is called. */}
        {resent ? (
          <p className="registration-done__resent" role="status">
            {t('registration.resent')}
          </p>
        ) : (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setResent(true)}
          >
            {t('registration.resend')}
          </button>
        )}
      </div>
    )
  }

  /**
   * Sends the form, and decides what the reader sees by what came back.
   *
   * <p><b>THE CONFIRMATION IS DRAWN ONLY AFTER 204, AND THAT IS THE CHANGE.</b> It used
   * to be drawn on the press. Everything under „Prijava je zabelezena" was then a claim
   * about something that had not happened - „Poslali smo poruku na …" most of all - and
   * a refusal had nowhere to appear, because the form it belonged to was already gone.
   *
   * <p><b>Refused, nothing moves.</b> The screen stays exactly where it was, with every
   * field still holding what was typed into it, and the sentence appears beneath the
   * form. `useSend` REPLACES the entry underneath before pushing the confirmation on top
   * of it, so navigating first and refusing afterwards would have left somebody standing
   * on a confirmation of nothing, with the form he has to correct no longer in his
   * history at all.
   */
  async function send(body: object, email: string): Promise<void> {
    /* Turned before the first `await`, so the next press finds it already turned. */
    outstanding.current = true
    setSending(true)
    /* AND THE LAST REFUSAL GOES WHILE THIS ONE IS OUT. Left standing, somebody who
       corrects his form and presses again reads the old sentence over a request that is
       still in flight, and cannot tell whether it is about the press he just made. */
    setRefusal(null)

    const answer = await askTheServer('/api/registration', body)

    outstanding.current = false
    setSending(false)

    if (answer.got === 'done') {
      /* The same two facts as before and no others, which is what the entry has carried
         since 06.09.2026: where the letter went, and whether somebody brought this
         member. What was typed does not travel, and the browser hands this entry back
         when a session is restored. */
      confirm(`/${locale}`, { email, referred: referral !== null })

      return
    }

    setRefusal(answer)
  }

  /* Who brought this member, taken off the link they arrived by and kept with
     what they send. The link was being written and never read: the address said
     `?preporuka=`, nothing looked, and the one fact the whole programme rests on
     was lost at the door. A member who registers this way is credited to
     whoever brought them, but not yet: the credit falls when this member's own
     membership is first activated (owner, 12.08.2026).

     Through `useFilterParams` because that is the only door to the address bar
     (app/useFilterParams.ts). Reading is all this does; nothing here writes. */
  return (
    <>
      <FormRenderer
        form={registracija}
        onSubmit={(values, agreeing) => {
          /* A second press while the first is still out would write a second account, or
             rather try to and be told the address is taken - by the address this very
             person has just been given. */
          if (outstanding.current) {
            return
          }

          /* BUILT HERE AND NOT INSIDE THE SENDING, so that `storedDate` throwing lands in
             the press that React is already holding - where the portal's error boundary
             is - rather than in a promise nobody kept a handle on. */
          void send(theBody(values, agreeing, referral), written(values, 'email'))
        }}
      />

      {/* Said out loud rather than left to a button that looks unpressed. Somebody who
          presses and is shown nothing presses again, which is the very thing the guard
          above has to refuse, and refusing it silently is how a form comes to look
          broken. `role="status"` so it reaches a reader working by ear without taking
          the cursor off the form (WCAG 2.2, 4.1.3). */}
      {sending && (
        <p role="status">{t('registration.sending')}</p>
      )}

      {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_REGISTERING} />}
    </>
  )
}
