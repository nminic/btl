import { useI18n } from '../i18n/useI18n'
import './Unreadable.css'

/**
 * A LIST THAT COULD NOT BE READ, SAID AS THAT, WITH THE WAY TO ASK AGAIN.
 *
 * <p>Decision of 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza", PENDING stavka
 * 368), in the words of the PDL's record of it and not the owner's: „Spisak koji ne moze da se
 * ucita KAZE to, umesto da izgleda prazan, uz dugme „Pokusaj ponovo". Vazi za sve ekrane sa
 * spiskom." What prompted it was measured on the team's page: after a press
 * that worked, both reads of the queue failed, both headings went and the two applications the
 * team had never answered went with them, so a portal that could not be reached read as a team
 * with nothing waiting.
 *
 * <p><b>One component, so that every screen that used to draw a failed read as an empty list says
 * it the same way.</b> What differs between the screens is which list it is about, and that is what
 * is handed in: the sentence, and the name of the list, which is what the button asks again for.
 * The compiler found two such screens (the team's page and the panel under the envelope in the
 * header), and `data/aFailedReadIsSaid.test.ts` asks the same question of the whole portal on
 * every run.
 *
 * <p><b>AND `Resource` DRAWS IT TOO, which was the second half of the decision.</b> The screens
 * that go through `components/Resource.tsx` already said „Podaci se ne mogu ucitati." and never
 * looked like an empty list, so they were left for a second PR; what that PR changed is that the
 * state every one of them reads now carries the way to ask again (`data/useResource.ts`,
 * `FailedRead`), and `Resource` hands it here. The sentence is the one it always said and the name
 * is its `label`, where it has one.
 *
 * <p><b>Two states and not one.</b> While the asking again is out the sentence is replaced by the
 * loader's own word, and when the answer comes back the same the sentence is a NEW alert, which is
 * what tells the reader the press was answered and not ignored (WCAG 2.2 SC 4.1.3).
 * <b>New is meant of the ELEMENT, and it is the two `key`s below that make it true.</b> Without them
 * React reuses a `<p>` that keeps its place and changes only its `role` and its words (measured
 * 02.10.2026, on the version of this file that PR 469 introduced): the alert of the second failure
 * was the same node as the alert of the first with its role turned back, which is not an alert
 * inserted, and an `alert` is what a screen reader says when it is inserted. With a key each, the
 * second failure is a different node in the document and the first is gone. Whether a given
 * screen reader then says it again is NOT measured here and nothing in this file promises it.
 * The button is told off while the request is out and not switched off, for the reason
 * `member/ProfilePicture.tsx` gives: `disabled` takes a control out of the tab order, and a keyboard
 * reader who had focus on it is dropped at the top of the page. It is the one node of the three
 * that stays, for that reason: keyed, it would be replaced too and the focus would go with it.
 *
 * <p>The button is named by the list as well as by its own word („Pokusaj ponovo: Poruke"), because
 * two of them on one screen are two controls a reader cannot tell apart, and the visible word is
 * the first thing in the name (WCAG 2.2 SC 2.5.3). Where nothing names the list - a whole screen
 * that failed, or a part that has no `label` - the name is the visible word alone, and two such
 * parts on one screen are two buttons with one name; that is the boundary, and it is written where
 * the parts are (`components/Resource.tsx`).
 */
export function Unreadable({
  said,
  named,
  reading,
  onRetry,
}: {
  /** The sentence about THIS list, in the words of the screen it stands on. */
  said: string
  /** What the list is called, so the button can say which list it asks again for. Absent where
   *  nothing names it; the button is then named by its own visible word. */
  named?: string
  /** Whether the asking again is out. */
  reading: boolean
  /** Asks the list again. Not called while the last asking is still out. */
  onRetry: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="unreadable">
      {reading ? (
        <p key="asking" className="unreadable__said" role="status">
          {t('data.loading')}
        </p>
      ) : (
        <p key="said" className="unreadable__said" role="alert">
          {said}
        </p>
      )}
      <button
        type="button"
        className="button button--secondary"
        aria-label={named === undefined ? undefined : `${t('data.retry')}: ${named}`}
        aria-disabled={reading ? true : undefined}
        onClick={() => {
          if (!reading) {
            onRetry()
          }
        }}
      >
        {t('data.retry')}
      </button>
    </div>
  )
}
