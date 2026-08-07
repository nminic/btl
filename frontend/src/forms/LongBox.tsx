import { useRef, useState, type TextareaHTMLAttributes } from "react";
import { useI18n } from "../i18n/useI18n";

/**
 * A box for many words, with the limit and everything the portal says about it.
 *
 * One component and not a `maxLength` on a textarea, because the number is the
 * smallest part of what a limit is. The limit is refused at the door rather
 * than reported afterwards (owner, 01.08.2026), which means the writer has to
 * be told three things: how much room there is on the way in, what a paste has
 * just lost, and that the box will take no more. A box that carries only the
 * attribute cuts three hundred characters off a pasted race report and says
 * nothing at all.
 *
 * Written out of the form renderer when a third box appeared beside it: the
 * comment on a rating took the limit from the same definition as the report of
 * a result and none of the rest, so one door said everything and the door next
 * to it said nothing about the same field of the same form.
 */
export function LongBox({
  value,
  maxLength,
  leftId,
  onChange,
  ...rest
}: {
  value: string;
  /** How many characters the box will hold, or nothing where the definition
   *  named none. Every definition on the portal names one (definitions.test.ts)
   *  and the renderer is handed a definition and is in no position to insist,
   *  so the counting is drawn only where there is something to count down
   *  from. */
  maxLength: number | undefined;
  /** The id of the line that counts the room down, which the field points at
   *  with `aria-describedby`: the count is read on the way in rather than left
   *  to whoever can see it. */
  leftId: string;
  onChange: (next: string) => void;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "maxLength" | "onChange" | "onPaste" | "rows"
>) {
  const { t } = useI18n();
  /**
   * How many characters the last paste lost.
   *
   * `maxLength` cuts a paste at the door and says nothing at all. The counter
   * then reads "the box is full", which is read as "I filled it" and not as "a
   * thousand characters of what you brought are gone". Somebody moving the
   * rules of a competition across from a document loses the last page and finds
   * out when a member asks about it.
   *
   * Kept here rather than worked out from the value, because after the event
   * there is nothing to work it out from: what was dropped never reached React.
   */
  const [dropped, setDropped] = useState(0);
  /**
   * Whether the change about to arrive is the paste's own.
   *
   * A paste raises the message and then delivers a change, so clearing on every
   * change puts the message up and takes it down inside one event and nobody
   * ever sees it. This lets that one change through and clears on the next,
   * which is the first thing the writer does themselves.
   */
  const fromPaste = useRef(false);
  /** Whether the box will take no more. One sentence hangs off it in three
   *  places, and reading it three times from three copies of the same
   *  comparison is how the three drift apart. */
  const atTheLimit = maxLength !== undefined && value.length >= maxLength;

  return (
    <>
      <textarea
        {...rest}
        /* Tall enough for what fits, and no taller. Ten is where a box stops
           being a box and becomes the screen: the page editor holds eight
           thousand characters, which at sixty to a line is a hundred and
           thirty-four rows. */
        rows={
          maxLength === undefined
            ? undefined
            : Math.min(10, Math.ceil(maxLength / 60))
        }
        value={value}
        maxLength={maxLength}
        /* What the browser is about to throw away, counted before it does. The
           room is what the limit leaves, plus whatever the paste is replacing:
           pasting over the whole box is not an overflow. */
        onPaste={(event) => {
          const box = event.currentTarget;
          const replacing = box.selectionEnd - box.selectionStart;
          /* Never below nought. A record can be longer than the limit that was
             put on the field after it was written, and a negative room would
             report the whole of that overrun as something this paste lost.

             No limit at all is unbounded room, which is what `Infinity` says:
             absence has a meaning here rather than standing in for a value
             nobody worked out (ADL A14, rule 2). */
          const room = Math.max(
            0,
            (maxLength ?? Infinity) - value.length + replacing,
          );
          /* Line endings as the box will hold them. The clipboard carries CR LF
             on Windows and a textarea keeps LF, so counting the clipboard as it
             comes charges the writer one character per line for something the
             box never had. */
          const brought = event.clipboardData
            .getData("text")
            .replace(/\r\n/g, "\n").length;

          /* Raised only where the paste will actually deliver a change, so a
             flag left standing does not eat the writer's next keystroke
             instead. A paste into a box with no room is refused whole and
             nothing follows it; a paste over a selection always changes the box,
             because the selection goes even when nothing takes its place. */
          fromPaste.current = brought > 0 && (room > 0 || replacing > 0);
          setDropped(Math.max(0, brought - room));
        }}
        onChange={(event) => {
          if (fromPaste.current) {
            fromPaste.current = false;
          } else {
            setDropped(0);
          }

          onChange(event.target.value);
        }}
      />

      {maxLength !== undefined && (
        <>
          {/* How much room is left, counted down.
         *
            Not a live region. It was one, politely, and polite only means the
            reader waits its turn: the text changes on every keystroke, so the
            queue filled with three hundred and fifty-nine announcements of a
            number nobody was waiting to hear, and each one had to be got through
            before anything else could be said. What a writer needs is the count
            when they arrive at the field and a word when the box will take no
            more, and those are two different things.
         *
            The count on arrival is `aria-describedby` on the box. The word at the
            wall is the region at the bottom of this block. */}
          <p className="field__left" id={leftId} aria-hidden="true">
            {atTheLimit
              ? t("registration.bioFull", { count: maxLength })
              : t("registration.bioLeft", { count: maxLength - value.length })}
          </p>

          {/* What the last paste lost. Said in full, in its own words, and not left
            to be worked out from a counter that has gone to zero. */}
          {dropped > 0 && (
            <p className="field__dropped" aria-hidden="true">
              {t("form.pasteCut", { count: dropped })}
            </p>
          )}

          {/* The two moments worth saying out loud, and nothing in between.
         *
            One region, always on the page, and only its text changes. A region
            that is added to the page together with its text is one a screen
            reader often misses, because there was nothing there to be watching;
            the portal says so where it does the same thing for a bank statement
            (src/pages/admin/Payments.tsx).
         *
            Everything it says is said once. The two visible lines above carry the
            same words and are hidden from the reader, which costs nothing: the
            count is read on the way into the field through `aria-describedby`,
            and a description is read whether or not the element carrying it is
            hidden. */}
          <p className="visually-hidden" role="status">
            {dropped > 0 ? t("form.pasteCut", { count: dropped }) : ""}
            {dropped === 0 && atTheLimit
              ? t("registration.bioFull", { count: maxLength })
              : ""}
          </p>
        </>
      )}
    </>
  );
}
