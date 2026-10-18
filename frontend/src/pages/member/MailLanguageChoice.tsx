import { useEffect, useRef, useState } from 'react'
import { Resource } from '../../components/Resource'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  MAIL_LANGUAGES,
  THE_MAIL_LANGUAGE_GOES_TO,
  WHEN_CHOOSING_THE_LANGUAGE_OF_MAIL,
  mailLanguageChosenIn,
  type MailLanguage as Language,
} from './mailLanguage'
import { useMyMailLanguage } from './useMyMailLanguage'

/**
 * WHICH LANGUAGE THE PORTAL'S MAIL TO THIS ACCOUNT IS WRITTEN IN, chosen on the settings screen and
 * sent the moment it is pressed.
 *
 * <p>PDL, 03.10.2026 (the answers of that evening, point 12; chosen by the owner between offered
 * outcomes, so the sentence is the record's and not his own words): the member chooses the language
 * of his mail in his profile, Serbian by default, and „Ekran ne pamti jezik". And, on 17.10.2026
 * (the answers on the language of the mail, PR 545, chosen the same way): „Jezik pošte sme da
 * promeni svako ko ima nalog, i član bez plaćene članarine i član kome je istekla, jer je to
 * podešavanje naloga a ne takmičarsko pravo." The published privacy policy names it among the things
 * the portal keeps: „Jezik pošte, srpski ili engleski | Da vam mejlovi stižu na jeziku koji ste
 * izabrali".
 *
 * <p><b>WHERE IT STANDS is the settings screen and nowhere else</b>, because it is a setting of the
 * account, and the screen draws it to every kind of signed in account there is - a member whose fee
 * stands, one whose fee has lapsed, somebody who has not paid, and an administration account with no
 * member at all. That the owner's sentence says „svako ko ima nalog" is why this is not behind the
 * hook that parts those four (`memberScreen.tsx`): it is drawn to all of them.
 *
 * <p><b>THE GROUP IS TWO RADIOS</b> and not a list, the shape the portal already uses for a choice
 * of exactly one among few (the theme beside it, the category on `Membership.tsx`, and the owner's
 * „Pol i kategorija su dugmad" of 11.08.2026, PDL P8, which this copies in the one respect that
 * applies: a radio group so the keyboard works as everywhere else). It differs from that decision
 * in one more respect, said rather than left to be found: that one opens with nothing chosen, and
 * this one always has a choice, because the account always holds a language.
 *
 * <p><b>WHAT IS SHOWN IS WHAT THE SERVER HOLDS, never what the page is written in.</b> The page's
 * language is the first segment of the address and the mail's is a column of the account; reading
 * the first for the second would draw „English" to a member who chose Serbian the moment he opened
 * the English page. It is read off `GET /api/me` (`useMyMailLanguage`), and after a press it is
 * moved by the language the ANSWER names and by nothing else (`mailLanguageChosenIn`). Choosing a
 * language here does not change the page either: the address does not move.
 *
 * <h2>THE ORDER IS THE WHOLE OF IT</h2>
 *
 * <p>The request goes first and the choice moves only inside the arm an answer authorised, which is
 * `ProfileVisibility.tsx`'s arrangement for its own box and for the same reason: written the other
 * way round, the group would tell a reader his mail is written in a language the server refused.
 *
 * <h2>WHILE THE REQUEST IS OUT</h2>
 *
 * <p>Both radios are `disabled`, which is `ProfileVisibility.tsx`'s and `RightsMatrix.tsx`'s shape
 * for a control that writes with no button beside it: a browser changes a radio whatever
 * `aria-disabled` says, so a second press would send a second request and the two answers would
 * land in an order nobody chose. A control disabled under a reader's own finger loses the focus, so
 * the confirmation takes it when it appears (WCAG 2.2 SC 4.1.3 and 2.4.3), as the other panels do.
 * A refusal is a `role="alert"` and takes nothing: the focus is on the page again and the alert is
 * read where it appears.
 *
 * <p>`reader` names whose language this is (`useMyMailLanguage`), so that a second person signing
 * in beside the first is not drawn the first one's choice.
 */
export function MailLanguageChoice({ reader }: { reader: string }) {
  const { t } = useI18n()
  const mine = useMyMailLanguage(reader)

  return (
    <section className="member__panel" aria-labelledby="settings-mail">
      <h2 className="profile__section" id="settings-mail">
        {t('settings.mail')}
      </h2>

      <Resource state={mine} inline label={t('settings.mail')}>
        {(stands) => <TheChoice stands={stands} />}
      </Resource>
    </section>
  )
}

function TheChoice({ stands }: { stands: Language }) {
  const { t } = useI18n()
  /* What the server last said the row holds, starting from what it said when this was drawn. The one
     home of „what is chosen" on this screen: nothing else on the portal reads it. */
  const [chosen, setChosen] = useState(stands)
  const [saving, setSaving] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const said = useRef<HTMLParagraphElement>(null)

  const saved = answer !== null && answer.got === 'done'
  const refusal = answer !== null && answer.got !== 'done' ? answer : null

  useEffect(() => {
    if (saved) {
      said.current?.focus()
    }
  }, [saved])

  async function choose(wanted: Language): Promise<void> {
    setSaving(true)
    /* The old answer goes the moment a new request starts: „Sačuvano." left standing over a group
       being pressed again says the thing on the screen is what the server holds. */
    setAnswer(null)

    const answered = await askTheServer(THE_MAIL_LANGUAGE_GOES_TO, { language: wanted }, 'PUT')

    setSaving(false)

    if (answered.got !== 'done') {
      setAnswer(answered)

      return
    }

    const confirmed = mailLanguageChosenIn(answered.body)

    /* A 200 THIS SCREEN CANNOT READ, which is a portal one release behind its server. Nothing moves
       and the group stays on what it showed; `server.wrong` is the sentence the other panels use for
       the same state, and the status is the one the server really answered with. */
    if (confirmed === null) {
      setAnswer({ got: 'wrong', status: 200 })

      return
    }

    setChosen(confirmed)
    setAnswer(answered)
  }

  return (
    <>
      <fieldset className="field field--radio">
        <legend className="field__label">{t('settings.mailLanguageLegend')}</legend>
        {MAIL_LANGUAGES.map((one) => (
          <div key={one} className="field__confirm">
            <input
              className="field__control"
              type="radio"
              name="mail-language"
              id={`mail-language-${one}`}
              value={one}
              checked={chosen === one}
              disabled={saving}
              onChange={() => {
                void choose(one)
              }}
            />
            <label className="field__label" htmlFor={`mail-language-${one}`}>
              {t(one === 'sr' ? 'language.sr' : 'language.en')}
            </label>
          </div>
        ))}
      </fieldset>

      {saved && (
        <p className="member__note" ref={said} tabIndex={-1} role="status">
          {t('account.saved')}
        </p>
      )}

      {refusal !== null && (
        <ServerSaid answer={refusal} refusals={WHEN_CHOOSING_THE_LANGUAGE_OF_MAIL} />
      )}
    </>
  )
}
