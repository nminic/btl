/** A stable hue per person, so the same face keeps the same colour on every
 *  visit and two cards side by side rarely look alike. Kept out of the screen
 *  file so that one only exports a component. */
export function hueFor(memberNumber: string): number {
  let total = 0

  for (const character of memberNumber) {
    total = (total * 31 + character.charCodeAt(0)) % 360
  }

  return total
}
