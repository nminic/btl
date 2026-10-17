/**
 * What a screen hands the editor of a written text.
 *
 * In a module of its own so the screens that draw the editor can name its props without importing
 * the editor itself: the editor is loaded only when it is drawn (`components/TextEditor.tsx`), and
 * a type imported from its module would be the one thing that tempts somebody to import a value
 * from it too.
 */
export type EditorProps = {
  /** The id of the box that is typed into, which is where a form sends the cursor back to. */
  id: string
  /** The text as it is kept, in Markdown. */
  value: string
  /** How many characters of Markdown the text may run to, or nothing where the field names none. */
  maxLength: number | undefined
  /** The id of the line that counts the room down. */
  leftId: string
  /** The id of what names the box, where something on the screen already does. */
  labelledBy?: string
  /** The name of the box, where nothing on the screen names it. */
  label?: string
  describedBy?: string
  required?: boolean
  invalid?: boolean
  /** Held: reachable, read out, and not to be changed (`forms/FormRenderer.tsx` says why). */
  locked?: boolean
  autoFocus?: boolean
  /** Every change, as the Markdown it will be kept as. */
  onChange: (text: string) => void
  /** The cursor has left the editor and everything that belongs to it, with the text as it is. */
  onLeave: (text: string) => void
}
