import { useEffect, useRef, type ReactNode } from 'react'
import './Prompt.css'

/**
 * A QUESTION THE PORTAL WILL NOT ACT WITHOUT AN ANSWER TO.
 *
 * <p><b>THE FIRST `aria-modal` IN THIS PORTAL, and that is worth saying because a file two
 * directories away said in as many words that there was none.</b> `forms/FieldHint.tsx`
 * justified not stopping Escape by observing „there is no dialog, no `showModal`, nothing with
 * `aria-modal`" - true when it was written and rewritten in the same commit as this file, for
 * the reason `CLAUDE.md` gives: a sentence asserting an overturned state is an instruction to
 * the next reader to restore it.
 *
 * <p><b>WHY A DIALOG AND NOT A ROW THAT UNFOLDS</b>, which is the shape this portal uses
 * everywhere else. The owner's specification of the payments screen asks three times for a
 * „prompt" and each one is a question the moderator must answer before anything happens - and
 * one of the three hands out a member number that cannot be taken back, because the sequence
 * only counts up. A control that can be scrolled past is the wrong shape for that: the point
 * is that nothing else on the page can be pressed until this is answered.
 *
 * <p><b>ESCAPE IS „NO", AND „NO" CHANGES NOTHING, FOR AS LONG AS NO REQUEST IS OUT.</b> The
 * owner, PDL section 19, rule 1 over the whole of it: „Odluka NE ni ovde niti u ostatku opisa
 * funkcionalnosti ne brise red iz tabele za aktivaciju, samo odlaze odluku dok se stvari ne
 * rese van portala." So until a way of saying yes has been pressed, closing this by any road
 * writes nothing, touches no balance and leaves the row where it was - which is also what lets
 * Escape close it at all. WCAG 2.2 asks for that (2.1.2, no keyboard trap) and it costs nothing
 * here.
 *
 * <p><b>ONCE A REQUEST IS OUT IT IS NOT SAFE BY CONSTRUCTION, AND THAT IS WHAT `working` IS
 * FOR.</b> A way of saying yes starts a request, and from then on putting the sheet away stops
 * nothing: the request is already on its way and the row is activated whatever was done to the
 * sheet. A „Ne" that closed it then was a sheet saying „I took it back" over a member number that
 * had been drawn and cannot be given back. The owner chose on 02.10.2026, between three outcomes
 * he was priced, that „Ne", „Odustani" and Escape are onemoguceni while the request travels, with
 * the state said in words, and that the sheet closes itself when the answer arrives (PDL, „Odluke
 * iz ciscenja nalaza", first item; the registry's items 259, 352 and 354). The journal records it
 * in my words and not in his, so it is not quoted here.
 *
 * <p><b>A PRESS OUTSIDE DOES NOT CLOSE IT, and that is the one place this differs from the
 * menus.</b> `app/Dropdown.tsx` closes on a press anywhere outside, which is right for a panel
 * that shows things. This asks a question, and a stray press landing on the page behind it
 * would be read by the moderator as „I have dealt with that row" when he has not. He has three
 * ways out that all say so out loud: either answer, or the button that declines.
 */
export function Prompt({
  title,
  children,
  choices,
  decline,
  onDecline,
  working,
}: {
  /** The question, which becomes the dialog's accessible name. */
  title: string
  /** What the moderator needs to know to answer: the amounts in play, in his own currency. */
  children: ReactNode
  /**
   * The ways of saying yes, in the order the owner listed them.
   *
   * <p>A list rather than one, because two of his three prompts offer two grounds („Odobri
   * oslobodjenje od clanarine" / „Odobri iz balansa") and the third offers one („Da"). One
   * component for both, so the focus, the escape and the labelling are written once - which is
   * the whole reason this is not three blocks on a screen.
   */
  choices: { label: string; onChoose: () => void }[]
  /** What declining is called: „Ne" where the question is a yes-or-no, „Odustani" where it is a
   *  choice between grounds. */
  decline: string
  onDecline: () => void
  /**
   * The sentence that says a request is out, or nothing when none is.
   *
   * <p><b>The sentence and not a flag</b>, because this file draws no words of its own: every
   * string on the sheet is its caller's, and the caller already holds the portal's one sentence
   * for a request that is out (`results.sending`, and four others of the same words).
   *
   * <p><b>While it is set the sheet answers nothing</b>: neither way of saying yes, not the one
   * that declines, and not Escape - which is still STOPPED, so a press the sheet took does not
   * go on to shut a menu behind it. Every button says so with `aria-disabled` and none is taken
   * out of the tab order, because the one that was just pressed has the focus and a native
   * `disabled` would drop it to the top of the document. The caller closes the sheet itself when
   * the answer arrives, so there is no way out of this state but the answer.
   */
  working?: string
}) {
  const busy = working !== undefined
  const sheet = useRef<HTMLDivElement>(null)
  /* WHERE THE FOCUS WAS, so it can be put back. WCAG 2.2 AA, 2.4.3: a dialog that closes
     leaving the focus on the body puts a keyboard reader back at the top of a table of six
     rows, having to count down to the one he was working on. Read at mount rather than at
     close, because by then the element may be gone. */
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    opener.current = document.activeElement

    /* THE FIRST THING IN IT TAKES THE FOCUS, and that is the dialog's own heading rather than
       a button. Landing on „Da" means a reader who presses space before reading has agreed to
       something; landing on the heading means the screen reader says the question first, and
       the buttons are one Tab away. The heading is made focusable for this and for nothing
       else, which is why it carries `tabIndex={-1}` and not a role. */
    const first = sheet.current?.querySelector<HTMLElement>('[data-prompt-first]')

    first?.focus()

    return () => {
      /* PUT BACK ONLY IF IT IS STILL THERE AND CAN TAKE IT. A row that has left the list takes
         its button with it, and `focus` on a detached element silently moves the focus to the
         body - so the question „is it still in the document" is asked rather than assumed. */
      const back = opener.current

      if (back instanceof HTMLElement && back.isConnected) {
        back.focus()
      }
    }
  }, [])

  /**
   * ESCAPE, AND TAB THAT CANNOT LEAVE.
   *
   * <p><b>ON THE SHEET AND NOT ON THE DOCUMENT, so the press is STOPPED rather than merely
   * answered.</b> Three of the portal's own listeners sit on the document in the BUBBLE phase -
   * `app/Dropdown.tsx` (which is the account and the messages menus), `app/LanguageMenu.tsx`
   * and `forms/DatePicker.tsx` - and every one of them treats Escape as „close me". The
   * language menu is in `app/Shell.tsx`, so it is on the same page as this dialog always.
   * Without the stopping, one Escape answering this question would also shut a menu the reader
   * had left open behind it, and he would have to find it again to see why.
   *
   * <p><b>WHAT THE STOPPING MEASURABLY CANNOT REACH, written as a boundary rather than left to
   * be found.</b> `forms/FieldHint.tsx` listens with
   * `document.addEventListener('keydown', onKeyDown, true)` - the CAPTURE phase on the document
   * - which by construction runs before any listener inside this element, so nothing here can
   * stop it. That is not a hole in this file: `FieldHint` is rendered by `forms/FormRenderer`
   * and by `pages/account/NewPassword` only, and neither stands on any screen that opens this,
   * so there is no hint on the page for an Escape to put away. Should a screen ever draw both,
   * the hint closes along with the dialog, and the fix belongs in the hint's phase rather than
   * here.
   */
  function onKeyDown(pressed: React.KeyboardEvent<HTMLDivElement>) {
    if (pressed.key === 'Escape') {
      /* STOPPED WHETHER OR NOT IT ANSWERS. With a request out it answers nothing, but it is
         still a press this sheet took: letting it through would shut a menu the reader left
         open behind the sheet while doing nothing to the question, which is the one outcome
         worse than either. */
      pressed.stopPropagation()

      if (!busy) {
        onDecline()
      }

      return
    }

    if (pressed.key !== 'Tab') {
      return
    }

    /* THE FOCUS CANNOT LEAVE, which is what „modal" means for somebody who is not using a
       mouse. Without it, Tab walks out into the table behind and the reader is answering a
       question while standing somewhere the question is not. Read at the moment of the press
       rather than kept, because what is focusable in here changes with the prompt.

       THE BUTTONS ONLY, AND THE HEADING IS DELIBERATELY NOT AMONG THEM. Measured rather than
       reasoned: the heading carries `tabIndex={-1}`, so it can be focused by this component but
       is NOT in the browser's tab order. Written as „the first thing in the sheet", the backward
       wrap compared the focus against the heading and therefore never fired from the first
       BUTTON - so Shift+Tab off it walked out of the sheet and landed on the „Aktiviraj" that
       opened it, which is exactly the fault this guard exists to prevent. The forward wrap
       happened to work, which is what made it look right. */
    /* ASKED OF `currentTarget` AND NOT OF THE REF, which removes a branch rather than tidying
       one: the handler is ON this element, so `currentTarget` is the sheet and cannot be null,
       while `sheet.current?.` makes a question with an answer no input can produce. The 100 per
       cent threshold is what found that, and it is the one tool that sees a branch nothing
       reaches (`CLAUDE.md`, 25.09.2026). */
    const sheetNow = pressed.currentTarget
    const buttons = Array.from(sheetNow.querySelectorAll<HTMLElement>('button'))

    const back = pressed.shiftKey
    /* Where the ring ends in the direction of travel, and where it starts again. Written as one
       pair rather than as two branches of an `if`, so backwards and forwards are the same code
       read twice and cannot drift apart. */
    const edge = back ? buttons[0] : buttons[buttons.length - 1]
    const wrapTo = back ? buttons[buttons.length - 1] : buttons[0]

    /* Backwards off the HEADING as well as off the first button: the sheet opens with the focus
       there, so Shift+Tab as the very first press is an ordinary thing to do and there is
       nothing before it inside the sheet. */
    const atEdge =
      document.activeElement === edge || (back && document.activeElement === sheetNow.firstElementChild)

    if (atEdge && wrapTo !== undefined) {
      pressed.preventDefault()
      wrapTo.focus()
    }
  }

  return (
    /* The backdrop is a plain element and takes no press: see the note on this component for
       why a press outside does not answer the question. It is here to cover the page, which is
       what tells a sighted reader that the rest of it is not listening. */
    <div className="prompt">
      <div
        className="prompt__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        ref={sheet}
        onKeyDown={onKeyDown}
      >
        {/* Focusable so the question is read out before anything can be pressed, and not a
            button: it does nothing and must not look as though it does. */}
        <h2 className="prompt__title" id="prompt-title" tabIndex={-1} data-prompt-first>
          {title}
        </h2>

        <div className="prompt__body">{children}</div>

        {/* TOLD OFF AND NOT SWITCHED OFF, on every button and for the reason `working` gives: the
            one that was pressed has the focus. `aria-disabled` stops nothing by itself, so each
            press is refused in its own handler as well - which is how this portal writes a
            control that cannot act (`PendingQueue.tsx`, `Membership.tsx`). */}
        <div className="prompt__answers">
          {choices.map((one) => (
            <button
              key={one.label}
              type="button"
              className="button"
              aria-disabled={busy ? true : undefined}
              onClick={() => {
                if (busy) {
                  return
                }

                one.onChoose()
              }}
            >
              {one.label}
            </button>
          ))}

          {/* LAST, and that is not only visual order. It is the last thing in the tab ring, so
              the ways of saying yes come first for a keyboard reader in the order the owner
              listed them, and the way out is where a reader expects it. */}
          <button
            type="button"
            className="button button--secondary"
            aria-disabled={busy ? true : undefined}
            onClick={() => {
              if (busy) {
                return
              }

              onDecline()
            }}
          >
            {decline}
          </button>
        </div>

        {/* A REGION THAT IS ALWAYS ON THE SHEET, EMPTY UNTIL A REQUEST IS OUT, and under the buttons
            rather than over them so that its words arriving move nothing: the thumb that has just
            pressed a way of saying yes is still over a button, and a second press is refused where
            it lands. One added to the page together with its text is one a screen reader often
            misses (WCAG 2.2 AA, 4.1.3), which is the reason `admin/Payments.tsx` keeps its own
            region the same way. */}
        <p className="prompt__working" role="status">
          {working}
        </p>
      </div>
    </div>
  )
}
