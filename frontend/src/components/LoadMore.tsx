import { useEffect, useRef } from 'react'
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
}) {
  const foot = useRef<HTMLDivElement>(null)

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
        onMore()
      }
    })

    watching.observe(at)

    return () => {
      watching.disconnect()
    }
  }, [whole, onMore])

  return (
    <div className="load-more" ref={foot}>
      {/* What arrived, said once and only to somebody who asked for it. The
          region exists from the first render whether or not it has anything to
          say, because a live region added to the page at the moment it speaks
          is a region a screen reader has not been watching (WCAG 2.2 SC
          4.1.3). */}
      <p className="visually-hidden" role="status">
        {asked ? words.showing : ''}
      </p>

      {whole ? (
        /* Said rather than left to be guessed at: a list that simply stops has
           not told anybody whether it ended or broke. */
        <p className="load-more__end">{words.whole}</p>
      ) : (
        <button type="button" className="load-more__button" onClick={onMore}>
          {words.more}
        </button>
      )}
    </div>
  )
}
