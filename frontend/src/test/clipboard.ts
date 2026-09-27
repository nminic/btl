/**
 * Standing `navigator.clipboard` in for the run of `body`, and putting back whatever
 * was there before - `undefined` included, which is the ordinary state of this API in
 * jsdom and is itself one of the two shapes a copy button's own tests ask for.
 *
 * `Object.defineProperty` rather than assignment: `clipboard` has no setter on
 * `Navigator.prototype` in every jsdom this suite has run under, so `navigator.
 * clipboard = x` throws in strict mode instead of shadowing it. Defining an own
 * property does not ask the prototype anything.
 *
 * Lifted out of `pages/memberFlows.test.tsx` on 27.09.2026, unchanged, the day a second
 * reader arrived (`components/CopyField.test.tsx`): the referral link and the PayPal
 * fields both copy through `navigator.clipboard`, and a helper written twice is a
 * helper that can answer two different questions about the same API without either
 * copy saying so.
 */
export async function withClipboard(
  clipboard: Pick<Clipboard, 'writeText'> | undefined,
  body: () => Promise<void>,
): Promise<void> {
  const before = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })

  try {
    await body()
  } finally {
    if (before) {
      Object.defineProperty(navigator, 'clipboard', before)
    } else {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  }
}
