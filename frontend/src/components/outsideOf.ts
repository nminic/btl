/**
 * Whether an event happened anywhere other than inside a box.
 *
 * The question the four things that shut on a press elsewhere ask: the menu in
 * the header, the language menu, the date picker and the place field.
 *
 * Read off the path the event travelled rather than off
 * `box.contains(event.target)`, because `target` is an `EventTarget` and
 * `contains` wants a `Node`, and the only way to hand the one to the other was
 * to assert that it is one, four times over (ADL A14). The path holds the box
 * itself wherever the event began inside it, so this asks the same question of
 * a value nobody has to make a claim about.
 *
 * A box that is not on the screen is in no path, so an event is outside it.
 * That is what the code before this said as well, through `?.`, and it is what
 * shuts a menu whose own box has gone.
 */
export function outsideOf(box: Element | null, event: Event): boolean {
  return !event.composedPath().some((one) => one === box)
}
