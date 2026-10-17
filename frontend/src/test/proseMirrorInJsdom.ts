/**
 * THE THREE MEASUREMENTS OF LAYOUT THE EDITOR ASKS A BROWSER FOR, which jsdom does not draw.
 *
 * The editor of the texts of the administration (`components/markdownEditor/`) is ProseMirror, and
 * ProseMirror asks where the cursor stands on the screen to keep it in view and to read a press of
 * the mouse. jsdom lays nothing out, so it has no answer and two of the three are not even there:
 * `Range.getClientRects`, `Range.getBoundingClientRect` and `document.elementFromPoint`. Without
 * them every case that types into the editor throws inside the library, after the case has passed.
 *
 * Each is given the answer jsdom already gives for an element, which is „nothing is drawn": no
 * rectangles, a rectangle of nought, and no element under any point. Added only where missing, so a
 * jsdom that learns them is asked instead.
 */
export function measureNothing(): void {
  if (!('getClientRects' in Range.prototype)) {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => document.body.getClientRects(),
    })
  }

  if (!('getBoundingClientRect' in Range.prototype)) {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => document.body.getBoundingClientRect(),
    })
  }

  if (!('elementFromPoint' in document)) {
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null })
  }
}
