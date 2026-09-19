import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import type { TranslateParams } from '../../i18n/translate'
import type { Answer } from './askTheServer'

/**
 * WHAT CAME BACK, AS A SENTENCE, AND NEVER A SENTENCE OF OUR OWN OVER ONE THE SERVER
 * NAMED.
 *
 * <p>Both routes that take a link out of a message refuse in the same four shapes, so
 * the four sentences live here rather than once per screen. What differs between the
 * two is only which refusals their route can name, and that is the map each screen
 * hands in.
 *
 * <p><b>A refusal the map does not know is said out loud, code and all.</b> That looks
 * blunt and is the point: a screen one release behind its server must not choose the
 * nearest sentence it does have, because the nearest sentence tells the reader to fix
 * something that is not wrong. `refusals.test.ts` reads the Java sources and fails
 * when a route names a reason no screen carries, so this branch is the boundary rather
 * than the plan.
 */
export function ServerSaid({
  answer,
  refusals,
  params = {},
}: {
  /** Everything except "done": a screen that succeeded draws its own words. */
  answer: Exclude<Answer, { got: 'done' }>
  /** The reasons this screen's own route can name, each to a key in the dictionary. */
  refusals: Record<string, string>
  /** What those sentences interpolate, where they interpolate anything. */
  params?: TranslateParams
}) {
  const { locale, t } = useI18n()

  const said = (): string => {
    if (answer.got === 'refused') {
      const known = refusals[answer.reason]

      return known === undefined ? t('server.refused', { reason: answer.reason }) : t(known, params)
    }

    if (answer.got === 'rejected') {
      return t('server.rejected')
    }

    if (answer.got === 'wrong') {
      return t('server.wrong', { status: answer.status })
    }

    return t('server.nothing')
  }

  /* The way to a fresh link is offered beside the one refusal a fresh link answers,
     and it is the way the messages themselves already point: „Ako veza istekne,
     zatražite novu sa strane za prijavu" (backend/src/main/resources/mail/sr.properties).
     Beside any of the other three it would send somebody back to the beginning over
     something he only has to type again. */
  const spent = answer.got === 'refused' && answer.reason === 'theLinkIsNotValid'

  return (
    <>
      <p className="field__error" role="alert">
        {said()}
      </p>
      {spent && (
        <p>
          <Link to={`/${locale}/prijava`}>{t('server.signIn')}</Link>
        </p>
      )}
    </>
  )
}
