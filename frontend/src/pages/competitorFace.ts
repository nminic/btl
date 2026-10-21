/** A stable hue per TEAM, so the same team mark keeps the same colour on every visit
 *  (`components/TeamMark.tsx`, the only caller).
 *
 *  **It was a hue per person until 21.10.2026 and a member's circle no longer has one**:
 *  the colour derived from a member number was abolished on 31.07.2026 (PDL P28, „Sve kartice
 *  takmičara su identične"), and `components/oneFace.test.ts` holds that nothing but the team
 *  mark reaches this module. Whether a team's mark keeps its colour is a different question
 *  that the decision does not answer, and it is not answered here. The file keeps the name it
 *  had, because that guard asks for it by place. */
export function hueFor(key: string): number {
  let total = 0

  for (const character of key) {
    total = (total * 31 + character.charCodeAt(0)) % 360
  }

  return total
}
