import { useCallback, useEffect, useRef, useState } from 'react'
import './LoadMore.css'

/* The foot of a list that grows as it is read. What it holds is a button, a
 * status message and the element the observer watches; how far the list has
 * grown is `useGrowing` (components/growing.ts), which is a hook and lives
 * where hooks live.
 */
export function LoadMore({
  whole,
  asked,
  onMore,
  words,
  endShown = true,
  buttonOnFocusOnly = false,
}: {
  whole: boolean
  /** Whether the reader has asked for more at least once. */
  asked: boolean
  onMore: () => void
  /**
   * The three sentences, written by whoever owns the list.
   *
   * Not built here out of a word and a number: "komentar" takes three forms
   * after a number in this language and "dukat" takes three others, so a
   * sentence assembled from a noun handed in is a sentence that is wrong two
   * times in three. The dictionary knows how to count (i18n/translate.ts); this
   * knows how to grow a list.
   */
  words: { more: string; showing: string; whole: string }
  /**
   * Whether the sentence at the end is drawn as well as spoken.
   *
   * The owner had it off the results and off the ducats on 23.08.2026 („Linija
   * na dnu To je sve, 78 rezultata ne treba da postoji"), and it stays on the
   * comments, which he did not ask about.
   *
   * Not deleted anywhere, because two things hang on it: it is what tells a
   * reader who cannot see the list that it ended rather than broke, and it is
   * what the focus lands on after the last press of the button. Deleted, that
   * press drops a keyboard reader at the top of the document with the whole page
   * to walk again (WCAG 2.2 SC 2.4.3).
   */
  endShown?: boolean
  /**
   * WHETHER THE BUTTON IS SEEN ONLY WHILE IT HAS THE FOCUS.
   *
   * <p>The comments since 20.10.2026: the owner wants nothing at the foot of them, „Treba da bude
   * infinite scroll. Dakle brise se sve to na dnu", and chose that the button stays for the keyboard
   * and a screen reader and is seen when it gets the focus (PDL P6, „Čitač ekrana ne čuje brojanje";
   * derived from ADL A7). It is NOT taken away, because it is the only way on for somebody whose
   * screen reader reads the page without moving it: the observer never sees the foot come into view
   * for him. So it stays in the order of the page, is spoken, and shows itself the moment the focus
   * lands on it, the way „Preskoči na sadržaj" does (`app/Shell.css`), and nothing about it is visible
   * to a reader who scrolls. Left out, the button is seen as it always was.
   */
  buttonOnFocusOnly?: boolean
}) {
  const foot = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLParagraphElement>(null)
  /**
   * HOW MANY TIMES MORE WAS ASKED FOR, so that what the status says is said again each time.
   *
   * <p>The sentence used to carry the numbers („Prikazano 20 od 25"), so it changed with every step
   * and a screen reader read the change. Without them (the comments, „Učitano još komentara.") two
   * steps would put the same words in the region and the second would be heard by nobody: a live
   * region speaks what is ADDED to it. So the words are put in a new element each time, keyed by this.
   */
  const [steps, setSteps] = useState(0)
  const askedForMore = useCallback(() => {
    setSteps((were) => were + 1)
    onMore()
  }, [onMore])
  /**
   * WHETHER THE LAST STEP WAS ASKED FOR BY PRESSING THE BUTTON, and not by the foot coming into view
   * (PENDING 29781; WCAG 2.2 SC 2.4.3 and 3.2.2).
   *
   * <p>The focus goes to the closing sentence because the button the reader was standing on has just
   * been replaced by it. A reader who SCROLLED was standing on nothing: the page loads the next step
   * under him as the foot approaches, and the closing sentence is a line he cannot see on the comments
   * (`endShown`), so moving the focus to it moved the viewport to a place he had not asked to go. So
   * the flag is the LAST request's: raised by the button, lowered by the observer, and lowered again
   * once the focus has been moved, so a step the button asked for ten steps ago does not claim the end
   * of a list that scrolling reached.
   */
  const byTheButton = useRef(false)

  useEffect(() => {
    /* Only where somebody had asked, and asked with the button: `whole` is true from the first render
       on a list that never had a button, and taking the focus there would move it for a reader who
       never touched anything. */
    if (whole && asked && byTheButton.current) {
      byTheButton.current = false
      end.current?.focus()
    }
  }, [whole, asked])

  useEffect(() => {
    const at = foot.current

    /* No observer in a rendering that has none, and no observer once there is
       nothing left to fetch. The button goes on working in both cases, which is
       the whole reason it is the mechanism rather than the fallback. */
    if (at === null || whole || typeof IntersectionObserver === 'undefined') {
      return
    }

    const watching = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        byTheButton.current = false
        askedForMore()
      }
    })

    watching.observe(at)

    return () => {
      watching.disconnect()
    }
  }, [whole, askedForMore])

  return (
    <div className="load-more" ref={foot}>
      {/* What arrived, said once and only to somebody who asked for it. The
          region exists from the first render whether or not it has anything to
          say, because a live region added to the page at the moment it speaks
          is a region a screen reader has not been watching (WCAG 2.2 SC
          4.1.3). */}
      <p className="visually-hidden" role="status">
        {asked ? <span key={steps}>{words.showing}</span> : ''}
      </p>

      {whole ? (
        /* Said rather than left to be guessed at: a list that simply stops has
           not told anybody whether it ended or broke.

           And it takes the focus the button was holding when it is what
           replaced it. A keyboard reader who pressed "load more" for the last
           time was dropped to the top of the document, which is the whole page
           to walk again (WCAG 2.2 SC 2.4.3). It is not focused when it was
           there from the start, because then nobody was standing on anything.

           `tabIndex={-1}` so it can be focused and still not be a stop on the
           way through. */
        <p className={endShown ? 'load-more__end' : 'visually-hidden'} tabIndex={-1} ref={end}>
          {words.whole}
        </p>
      ) : (
        <button
          type="button"
          className={buttonOnFocusOnly ? 'load-more__button load-more__button--on-focus' : 'load-more__button'}
          onClick={() => {
            byTheButton.current = true
            askedForMore()
          }}
        >
          {words.more}
        </button>
      )}
    </div>
  )
}
