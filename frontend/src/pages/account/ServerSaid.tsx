import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import type { TranslateParams } from '../../i18n/translate'
import type { Answer } from './askTheServer'
import { wordsFor } from './serverWords'

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
 *
 * <p><b>A ROUTE THAT NAMES NO REFUSAL AND STILL MEANS SOMETHING BY ITS NUMBER SAYS IT IN
 * `numbers`</b> (PENDING stavka 316, a finding of the cleaning pass of 02.10.2026 and not a
 * decision of the owner). `DELETE /api/pairs/{id}` is the one such route: it answers a 404 with no
 * reason in it for four callers at once on purpose (`ADL` A8: told apart, the numbers would say
 * which pairs exist and who is in them), so the number cannot become a
 * reason, and the portal's general sentence for a 404 cannot stand either, because it tells the
 * reader to try again in a few minutes and for three of the four that never helps. The screen of
 * such a route hands in what ITS number means, and that is said instead.
 *
 * <p><b>The table is for numbers a route gives a meaning to and for nothing else.</b> A number
 * that is not in it is read as every other screen reads it (`serverWords.ts`), and an answer that
 * is not a bare number (a refusal by name, the token refused, no answer) never looks at it.
 * Every other screen passes no table at all.
 */
export function ServerSaid({
  answer,
  refusals,
  numbers = {},
  params = {},
}: {
  /** Everything except "done": a screen that succeeded draws its own words. */
  answer: Exclude<Answer, { got: 'done' }>
  /** The reasons this screen's own route can name, each to a key in the dictionary. */
  refusals: Record<string, string>
  /** The bare numbers this screen's own route gives a meaning to, each to a key in the dictionary.
   *  Consulted before the portal's general sentence for a number, and only for a bare number. */
  numbers?: Record<number, string>
  /** What those sentences interpolate, where they interpolate anything. */
  params?: TranslateParams
}) {
  const { locale, t } = useI18n()

  /* THE SENTENCE IS WORKED OUT IN `serverWords.ts` (`wordsFor`), and this only draws it as an
     alert. It was worked out here until 03.10.2026; it moved, rather than being copied, because
     the list of races an event's press did not save names each refusal beside its race and must
     not raise an alert per race (`admin/EventRaces.tsx`). One home for the words, two ways of
     drawing them. */
  const said = (): string => wordsFor(answer, refusals, t, numbers, params)

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
