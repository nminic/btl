import { useRef, useState, type ReactNode } from 'react'
import { SYMBOL } from '../../app/actionSymbol'
import { ActionButton } from '../../components/ActionButton'
import { Prompt } from '../../components/Prompt'
import { useI18n } from '../../i18n/useI18n'

/**
 * THE QUESTION „OBRIŠI X?" AS A SHEET OVER THE PAGE, FOR EVERY ROW OF THE ADMINISTRATION THAT IS TAKEN AWAY
 * (owner, 23.10.2026, PDL „Tri odgovora od 23.10.2026": „Svaki ekran administracije koji briše dobija
 * isti iskačući prozor kao red člana, sa rečima koje imenuju šta se briše (npr. „Obriši tim?" [Obriši]
 * [Odustani]), umesto potvrde „Sigurno?" u redu").
 *
 * <p><b>The precedent is the member's row (`MemberRow.tsx`, PR 638), copied together with what guards
 * it:</b>
 *
 * <ul>
 * <li>The sheet is `components/Prompt.tsx`, so the focus (on the heading, back on the cross of THIS row
 * when it closes), Escape, the ring of Tab and the refusal of the second click of a double press are the
 * sheet's and are written once.</li>
 * <li>`working` is said while the request is out, and the sheet answers nothing then: neither way of
 * saying yes, nor „Odustani", nor Escape. The sheet closes itself when the answer comes, whichever it is
 * (owner, 02.10.2026, PDL „Odbijanje zatvara pitanje kao i uspeh").</li>
 * <li>A ref holds the same fact for a second press fired before the render that would show it: two clicks
 * fired without waiting are what a double press is, and the sheet's own refusal reads a prop.</li>
 * </ul>
 *
 * <p><b>The record is named in the sheet</b> (as the member is: „Ana Jovanović, 000007"), so a sheet
 * opened from the wrong row says so, and what else goes with the record (an event takes its races and
 * results) is said under it, where the reader who has pressed once still has the second press to think
 * about.
 *
 * <p><b>It does not move the focus off the row.</b> A sheet that stands keeps the focus inside it, and the
 * focus has to land on the control that starts a new record only once the row is gone; `RowActions` moves
 * it when the answer is in, in the turn that brings the row down with the sheet.
 */
export function DeleteSheet({ name, asks, onDelete, children }: {
  /** What the row is called: the name of the cross, and the line under the question. */
  name: string
  /** The question, in the words that name what is deleted: „Obriši tim?". */
  asks: string
  /**
   * What the way of saying yes does, and whether the reader has to wait for it.
   *
   * <p><b>Hand back the promise of a deletion that goes to the server.</b> A handler that returns
   * nothing is taken to be finished when it returns and the sheet closes at once.
   */
  onDelete: () => void | Promise<unknown>
  /** What else goes with the record, said under its name. */
  children?: ReactNode
}) {
  const { t } = useI18n()
  const [asking, setAsking] = useState(false)
  const [working, setWorking] = useState(false)
  const outstanding = useRef(false)

  function choose() {
    if (outstanding.current) {
      return
    }

    const answer = onDelete()

    /* A handler that hands back nothing has nothing to wait for: the row leaves in the same render. */
    if (!(answer instanceof Promise)) {
      setAsking(false)

      return
    }

    outstanding.current = true
    setWorking(true)

    void answer.finally(() => {
      outstanding.current = false
      setWorking(false)
      setAsking(false)
    })
  }

  return (
    <>
      <ActionButton
        symbol={SYMBOL.cross}
        word={t('admin.form.delete')}
        name={t('admin.form.deleteNamed', { name })}
        className="entity-open entity-delete"
        onClick={() => setAsking(true)}
      />
      {asking && (
        <Prompt
          title={asks}
          choices={[{ label: t('admin.form.delete'), onChoose: choose }]}
          decline={t('admin.form.keep')}
          onDecline={() => setAsking(false)}
          working={working ? t('results.sending') : undefined}
        >
          <p>{name}</p>
          {children}
        </Prompt>
      )}
    </>
  )
}
