import { screen, waitFor } from '@testing-library/react'
import type { Pressing } from './user'

/**
 * A TOWN THE CODEBOOK KNOWS, TYPED INTO A FORM THAT ASKS FOR „MESTO", AND THE COUNTRY THE PORTAL
 * WRITES BESIDE IT WAITED FOR.
 *
 * <p><b>Why this is one function and not the pair it replaced.</b> Twenty one cases on four
 * files proposed or changed a team by typing a town and then choosing its country with
 * `selectOptions`. Since 03.10.2026 the country is not chosen: a town the codebook recognises
 * writes it (`forms/PlaceField.tsx`), and switches the select off. `user.selectOptions` on a
 * switched off select is not an error but a no-op, so the old pair went on passing whichever of
 * the two wrote the country: the hand, if the codebook had not arrived yet, and the codebook, if
 * it had. A case that cannot say which of two sources wrote a value measures neither of them, and
 * which one it measured would have changed with the machine it ran on.
 *
 * <p><b>The wait is for the VALUE and not for the list.</b> The codebook is asked for on the
 * second letter and answers a moment later, and the country is written in the same stroke as it
 * arrives; waiting for anything else (a listbox, a tick of the clock) is waiting for something
 * that happens before or after it. Naming the country the case expects is what makes the helper
 * an assertion as well as a wait: a town the codebook gives a different country is a case that
 * fails here, with both countries in the message, and not three steps later with a refusal.
 *
 * <p><b>The limit is its own and shorter than the case's.</b> `test/setup.ts` gives every
 * `waitFor` as long as a whole screen is allowed (`SLOW`), which is longer than Vitest gives a
 * case, so a country that never arrives would be reported as a case that timed out - the same
 * words as a starved runner. Four seconds is room for a runner a dozen times slower than the one
 * this was measured on (126 to 297 ms for five towns, the typing included, 03.10.2026) and still
 * ends before the five a case has, so a failure here says what was expected and what stood there.
 *
 * <p><b>What this does NOT cover.</b> A town the codebook does not know, which is the one that
 * leaves the country to be chosen by hand: that is what a case about the hand writes out for
 * itself, because there the selecting is the thing being measured and not a way past it.
 */
export async function typeATownTheCodebookKnows(
  user: Pressing,
  town: string,
  country: string,
): Promise<void> {
  await user.type(screen.getByLabelText(/^Mesto/), town)
  await waitFor(
    () => {
      expect(screen.getByLabelText(/^Država/)).toHaveValue(country)
    },
    { timeout: 4000 },
  )
}
