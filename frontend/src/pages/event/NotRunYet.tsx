import { useI18n } from '../../i18n/useI18n'

/** Why the form is not being drawn. Two reasons, and the second is only ever a
 *  rating's: a result is what a member sends, and a rating is what they send
 *  once it is in (owner, 11.08.2026). */
type Why = 'notRunYet' | 'notRanIt'

/**
 * The answer both forms on an event give when the form is not theirs to fill.
 *
 * PDL P9 refuses a date in the future, and the date here is the event's own, so
 * neither a result nor a rating can be about a race nobody has started yet: a
 * rating asks about the organisation and the surroundings, which are things a
 * member saw on the day.
 *
 * The rule lives here, at the screen, and not only in the row of buttons that
 * leads to it. Hiding a link hides nothing: the address is in the notice that
 * goes out before a race, in somebody's history, and in the status bar of the
 * page it was hidden on. An unoffered form that renders and accepts when it is
 * asked for by name is a rule that holds only for people who were not looking.
 *
 * It says so rather than sending the reader somewhere else. Somebody who followed a link
 * is owed the reason it did not work, and the browser's own way back is then one press
 * away from the event they came from.
 */
export function NotRunYet({ why = 'notRunYet' }: { why?: Why }) {
  const { t } = useI18n()

  return (
    <div className="member">
      <h1>{t(`event.${why}`)}</h1>
      <p>{t(`event.${why}Why`)}</p>
    </div>
  )
}
