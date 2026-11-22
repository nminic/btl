import { useEffect, useState, type RefObject } from 'react'
import { useLocation } from 'react-router'
import { useToday } from '../clock/useClock'
import { warmUpShown } from '../data/season'
import { useI18n } from '../i18n/useI18n'
import { SYMBOL } from './actionSymbol'
import { canonicalPath } from './head'
import { ActionSymbolIcon } from './icons'
import { NOTICE_SHOWN_ON, NOTICE_STORAGE_KEY } from './noticeBarFacts'
import './NoticeBar.css'

function wasClosed(): boolean {
  try {
    return localStorage.getItem(NOTICE_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

function keepClosed(): void {
  try {
    localStorage.setItem(NOTICE_STORAGE_KEY, 'closed')
  } catch {
    /* Closed for this visit all the same: the state below is what hides it. */
  }
}

function forgetIt(): void {
  try {
    localStorage.removeItem(NOTICE_STORAGE_KEY)
  } catch {
    /* Nothing to take out of a store that cannot be reached. */
  }
}

/**
 * THE GOLD STRIP UNDER THE HEADER, UNTIL THE FIRST SEASON BEGINS (owner, 21.11.2026, PDL „Zlatna traka
 * obaveštenja ispod zaglavlja, do početka prve sezone"). It tells whoever arrives that the figures on the
 * screen are history and that the official season begins on 1 January at midnight. „shown for fun" was
 * taken out of the text by the owner on 21.11.2026.
 *
 * **Where it stands: on the screens that show those figures, and nowhere else** (owner, answer 1): the front
 * page, the Top lists and the three cards of the BTL tables, Muškarci, Žene and Timovi (owner, 21.11.2026,
 * „„BTL tabela” znači sve tri kartice”: a strip on two cards and not on the third moves the cards when one is
 * pressed). `NOTICE_SHOWN_ON` is one list of addresses, and
 * `app/noticeBar.test.tsx` asks every address the portal has which of them it is). A screen the owner did
 * not name is a screen where the sentence says nothing about anything on it.
 *
 * **Who sees it: everybody, a member who has signed in included** (answer 2). It reads the clock and the
 * browser's store and never the session, so it is drawn in the first paint and does not appear a moment
 * later and push the screen down.
 *
 * **When it goes: with the warm-up, from the same function** (`warmUpShown`, `data/season.ts`; PDL
 * [IZVEDENO 21.11.2026]). The sentence says „počinje 1. januara", which is false from that day on, and
 * the fact „from 1.1.2027 there is no warm-up" has one home and not a second date in this file. It
 * is asked of the portal's own clock, so the day the development switch moves is the day this reads.
 *
 * **Closing it is remembered by the browser until that same day** (answer 3). One key in
 * `localStorage`, written when the cross is pressed and read when the strip is first drawn; and from the
 * day the warm-up ends it is taken out again, so the browser does not keep a note about a strip that no
 * longer exists. Every touch of the store is inside a `try`: a browser told not to keep site data throws
 * on the very first access, and a strip that cannot remember is still a strip that can be closed. The key
 * is not named in the privacy policy, which stays silent about the strip on purpose (owner, 21.11.2026);
 * `writtenPages.test.tsx` holds it as the one named exemption from the stores the policy has to name.
 *
 * **Not a header, and not a landmark.** `role="note"` with a name, which is not a region: one more
 * landmark would change the count every screen reader announces, and `alert` or `status` would interrupt a
 * reader for a sentence that is not urgent. It is the last thing inside the header (the banner landmark), after the bar and the navigation. Two
 * rules put it there and both are held by a test: axe's `region` rule asks for all content to be inside a
 * landmark (`pages/accessibility.test.tsx`), and the page has to begin with its heading in `main`
 * (`test/met.ts`, „begins with its heading”, `pages/publicData.test.tsx`), which a strip drawn first in
 * `main` would break. The header's own bar and navigation keep their places and their height: what a guard
 * measures of the header is the part before the strip. After the cross the focus goes to the main content, because the
 * button it was on is gone.
 */
export function NoticeBar({ main }: { main: RefObject<HTMLElement | null> }) {
  const { t } = useI18n()
  const today = useToday()
  const { pathname } = useLocation()
  const [closed, setClosed] = useState(wasClosed)
  const running = warmUpShown(today)
  const here = NOTICE_SHOWN_ON.includes(canonicalPath(pathname.split('/').slice(2).join('/')))

  useEffect(() => {
    if (!running) {
      forgetIt()
    }
  }, [running])

  if (!running || !here || closed) {
    return null
  }

  return (
    <div className="notice" role="note" aria-label={t('notice.label')}>
      <div className="notice__inner">
        <p className="notice__text">{t('notice.text')}</p>
        <button
          type="button"
          className="notice__close"
          onClick={() => {
            keepClosed()
            setClosed(true)
            main.current?.focus()
          }}
        >
          <ActionSymbolIcon of={SYMBOL.cross} />
          <span className="visually-hidden">{t('notice.close')}</span>
        </button>
      </div>
    </div>
  )
}
