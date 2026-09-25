import { useEffect, useRef, useState } from 'react'
import { categoryCodeFor, categoryLabel } from '../../data/categories'
import type { Competitor } from '../../data/types'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  AS_LONG_AS_THE_FORM_ALLOWS,
  WHAT_THIS_SCREEN_SENDS,
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
 * for approval" anywhere on it: the two panels underneath - the picture and the words about
 * oneself - are the ones that wait, and they say so in their own words.
 *
 * <p><b>What it deliberately does NOT do, written here rather than left to be found.</b>
 *
 * <ul>
 * <li><b>It does not show what the postal address and the telephone are today.</b> Nothing
 * serves them: {@code GET /api/me} answers a role, an account and seven facts about
 * membership, and {@code /api/competitors} answers the PUBLIC record, which by ADL A8 is
 * public to anybody who asks. So those two boxes open empty and say so beside themselves,
 * rather than opening empty and reading as „you have given none". They are sent only when
 * something is typed into them ({@code whatChanged}), so an untouched empty box changes
 * nothing.</li>
 * <li><b>It does not carry the town.</b> A town is chosen out of a codebook of every
 * settlement in the world and reaches the route as either a key or a typed name with its
 * country, never both and never neither. That is a picker and two roads rather than a box,
 * and it is a decided change this screen has not made yet.</li>
 * <li><b>It does not carry the address of electronic post.</b> The owner decided on
 * 24.09.2026 that a member changes it himself „ali mora da potvrdi novu", because that
 * address is also how he signs in and an unconfirmed change is somebody taking the account.
 * <b>No route confirms one</b> - measured against every {@code @...Mapping} the backend
 * declares - so this screen does not invent one: the field stands, disabled, with the reason
 * beside it.</li>
 * </ul>
 *
 * <p><b>And the two it shows without letting anybody move them.</b> PDL P28b, 2: the date of
 * birth and the gender are an administrator's, because the CATEGORY and the age band are
 * worked out from them, so a member who could edit them could choose which category he races
 * in and change a table of a season already run. The gender is shown, because the public
 * record carries it. <b>The date of birth is not shown at all</b>, and that is not this
 * screen being shy: the portal does not hold it. Član 74 and the privacy policy both say it
 * „se nikada ne prikazuje, ni u punom ni u skraćenom obliku. Javna je samo kategorija koja
 * iz njega proizlazi", so what the record carries is the age band, and the band is what is
 * drawn - beside the category, which is the very thing the owner's reason names.
 */
export function PersonalData({ me }: { me: Competitor }) {
  const { t } = useI18n()

  /* WHAT THE SERVER HOLDS, held here and not read off `me` on every render, because a
     successful save moves it and nothing refetches the resource. After the first save the
     address and the telephone are no longer unknown - the portal put them there - so the
     sentence about not knowing them goes at the moment it stops being true. */
  const [standing, setStanding] = useState<Standing>({
    firstName: me.firstName,
    lastName: me.lastName,
    address: null,
    phone: null,
  })
  const [typed, setTyped] = useState<Typed>({
    firstName: me.firstName,
    lastName: me.lastName,
    address: '',
    phone: '',
  })
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const said = useRef<HTMLParagraphElement>(null)

  const changed = whatChanged(standing, typed)
  const nothing = Object.keys(changed).length === 0
  const saved = answer !== null && answer.got === 'done'
  const refusal = answer !== null && answer.got !== 'done' ? answer : null

  /* Said out loud, because what the reader pressed is answered by a sentence that appears
     somewhere else on the screen: without this the focus stays on the button and a screen
     reader is told nothing at all (WCAG 2.2 SC 4.1.3). The same shape the two panels below
     already use. */
  useEffect(() => {
    if (saved) {
      said.current?.focus()
    }
  }, [saved])

  async function send(): Promise<void> {
    setAsking(true)

    const answered = await askTheServer('/api/me', changed, 'PUT')

    /* WHAT WAS SENT BECOMES WHAT STANDS, and only what was sent. A field left out of the
       request is a field the route did not touch (ADL A54), so folding everything typed in
       here would claim the server kept a box this request never named. */
    if (answered.got === 'done') {
      setStanding((before) => ({ ...before, ...changed }))
    }

    setAnswer(answered)
    setAsking(false)
  }

  const category = categoryLabel(
    categoryCodeFor(me.gender, me.ageBand, me.firstSeason2027),
    t,
  )

  return (
    <>
      <section className="member__panel" aria-labelledby="account-personal">
        <h2 className="profile__section" id="account-personal">
          {t('account.personalTitle')}
        </h2>
        <p className="member__note">{t('account.personalNote')}</p>

        <RequiredNote />

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
          {WHAT_THIS_SCREEN_SENDS.map((name) => {
            const unknown = standing[name] === null
            const noteId = `account-${name}-unknown`

            return (
              <div className="rankings__field" key={name}>
                <AskedLabel id={`account-${name}`} asked={name !== 'phone'}>
                  {t(`registration.${name}`)}
                </AskedLabel>
                <input
                  id={`account-${name}`}
                  type="text"
                  value={typed[name]}
                  maxLength={AS_LONG_AS_THE_FORM_ALLOWS[name]}
                  aria-required={name === 'phone' ? undefined : 'true'}
                  aria-describedby={unknown ? noteId : undefined}
                  onChange={(event) => {
                    /* The answer goes the moment anything moves: a „saved" left standing
                       over a box being edited says the thing on the screen is what the
                       server holds, which it is not. */
                    setAnswer(null)
                    setTyped((before) => ({ ...before, [name]: event.target.value }))
                  }}
                />
                {/* Only while it is true. It stops being true the moment a save lands,
                    because then the portal does know what is there: it put it there. */}
                {unknown && (
                  <p className="rate__hint" id={noteId}>
                    {t('account.notShown')}
                  </p>
                )}
              </div>
            )
          })}

          <p className="member__actions">
            {/* Told off rather than switched off, as everywhere else on the portal:
                `disabled` takes the button out of the tab order and takes the reason it
                stands for with it. */}
            <button
              type="submit"
              className="button button--primary"
              aria-disabled={nothing || asking}
              aria-describedby={nothing ? 'account-personal-waits' : undefined}
            >
              {t('account.save')}
            </button>
          </p>

          {nothing && (
            <p id="account-personal-waits" className="rate__hint" role="status">
              {t('account.changeFirst')}
            </p>
          )}
        </form>

        {saved && (
          <p className="member__note" ref={said} tabIndex={-1} role="status">
            {t('account.saved')}
          </p>
        )}

        {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_CHANGING_MY_DATA} />}
      </section>

      <section className="member__panel" aria-labelledby="account-locked">
        <h2 className="profile__section" id="account-locked">
          {t('account.lockedTitle')}
        </h2>

        {/* A bare list, which is what `admin/EntityEditor.tsx` draws for the same thing -
            pairs of „what it is called" and „what it says" - rather than a class name of my
            own with no rule anywhere behind it. */}
        <dl>
          <div>
            <dt>{t('registration.gender')}</dt>
            <dd>{t(me.gender === 'M' ? 'rankings.men' : 'rankings.women')}</dd>
          </div>
          <div>
            {/* The consequence rather than the cause, and it is the owner's own reason for
                locking the two: the category is worked out from them. */}
            <dt>{t('account.category')}</dt>
            <dd>{category}</dd>
          </div>
          <div>
            <dt>{t('registration.city')}</dt>
            <dd>{me.city}</dd>
          </div>
        </dl>

        <p className="member__note">{t('account.lockedNote')}</p>
        <p className="member__note">{t('account.birthDateNote')}</p>
        <p className="member__note">{t('account.cityNote')}</p>

        {/* THE FIELD THAT STANDS AND DOES NOTHING, AND IT IS THE ONE THING ON THIS SCREEN
            DRAWN THAT WAY ON PURPOSE. The owner decided a member changes this himself and
            confirms the new one; no route confirms one yet. Drawn disabled rather than left
            out, so that what is missing is the confirming and not the decision - and
            `disabled` rather than `aria-disabled` here precisely because there is nothing
            to press: the reason is in the sentence beside it, which the control names. */}
        <div className="rankings__field">
          <AskedLabel id="account-email" asked={false}>
            {t('registration.email')}
          </AskedLabel>
          <input
            id="account-email"
            type="email"
            value=""
            disabled
            readOnly
            aria-describedby="account-email-why"
          />
          <p className="rate__hint" id="account-email-why">
            {t('account.emailNote')}
          </p>
        </div>
      </section>
    </>
  )
}
