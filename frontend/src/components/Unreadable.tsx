import { useI18n } from '../i18n/useI18n'
import './Unreadable.css'

/**
 * A LIST THAT COULD NOT BE READ, SAID AS THAT, WITH THE WAY TO ASK AGAIN.
 *
 * <p>Owner, 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza", PENDING stavka 368):
 * „Spisak koji ne moze da se ucita KAZE to, umesto da izgleda prazan, uz dugme „Pokusaj ponovo".
 * Vazi za sve ekrane sa spiskom." What prompted it was measured on the team's page: after a press
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
 * <p><b>THE SCREENS THAT ALREADY SAY „Podaci se ne mogu ucitati." THROUGH `Resource` ARE NOT THIS,
 * and the owner's decision reaches them in a second PR (C2)</b>: they never looked like an empty
 * list, and giving `Resource` a button touches the state every one of them reads.
 *
 * <p><b>Two states and not one.</b> While the asking again is out the sentence is replaced by the
 * loader's own word, and when the answer comes back the same the sentence is a NEW alert, which is
 * what tells the reader the press was answered and not ignored (WCAG 2.2 SC 4.1.3). The button is
 * told off while the request is out and not switched off, for the reason `member/ProfilePicture.tsx`
 * gives: `disabled` takes a control out of the tab order, and a keyboard reader who had focus on it
 * is dropped at the top of the page.
 *
 * <p>The button is named by the list as well as by its own word („Pokusaj ponovo: Poruke"), because
 * two of them on one screen are two controls a reader cannot tell apart, and the visible word is
 * the first thing in the name (WCAG 2.2 SC 2.5.3).
 */
export function Unreadable({
  said,
  named,
  reading,
  onRetry,
}: {
  /** The sentence about THIS list, in the words of the screen it stands on. */
  said: string
  /** What the list is called, so the button can say which list it asks again for. */
  named: string
  /** Whether the asking again is out. */
  reading: boolean
  /** Asks the list again. Not called while the last asking is still out. */
  onRetry: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="unreadable">
      {reading ? (
        <p className="unreadable__said" role="status">
          {t('data.loading')}
        </p>
      ) : (
        <p className="unreadable__said" role="alert">
          {said}
        </p>
      )}
      <button
        type="button"
        className="button button--secondary"
        aria-label={`${t('data.retry')}: ${named}`}
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
