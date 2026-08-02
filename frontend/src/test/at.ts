/**
 * The element at a position, or a failure that says what was missing.
 *
 * `rows[2]` in a test is an assertion wearing the clothes of an expression: it
 * says the third row exists. Under `noUncheckedIndexedAccess` the compiler stops
 * believing it, and the cheap way out is `rows[2]!` or `rows[2]?.textContent`.
 * Both are wrong here and in opposite directions. The first tells the compiler
 * to be quiet and then fails with "cannot read properties of undefined" pointing
 * at a line that is not the problem. The second is worse: it turns a test that
 * should fail into one that quietly passes, because `undefined?.textContent` is
 * `undefined` and `expect(undefined).toBeUndefined()` is green.
 *
 * So the rule for tests is the opposite of the rule for the portal (ADL A14):
 * in a test, absence must throw, and it must throw saying what it was looking
 * for. This is that, in four lines, and it is the only place in the tests that
 * is allowed to know how to fail.
 *
 * Prefer a query that already throws where one exists: `getByRole` with a name
 * says more when it fails than any index can. This is for the cases where the
 * position is the point, which is most often a row of a table or a cell of a
 * row.
 */
export function at<T>(list: ArrayLike<T> | undefined, index: number): T {
  if (list === undefined) {
    throw new Error(`asked for ${index} of a list that is not there`)
  }

  const found = list[index]

  if (found === undefined) {
    throw new Error(`asked for ${index} of a list ${list.length} long`)
  }

  return found
}

/**
 * The first element, and the last, for the cases where that is what is meant.
 *
 * `rows[rows.length - 1]` reads as arithmetic and means "the last one", so it is
 * written as the thing it means.
 */
export const first = <T>(list: ArrayLike<T> | undefined): T => at(list, 0)

export const last = <T>(list: ArrayLike<T> | undefined): T =>
  at(list, (list?.length ?? 0) - 1)

/**
 * Anything that has to be there, or a failure that says what was not.
 *
 * The same idea as `at` above, for everything that is not a list. `closest()`,
 * `parentElement`, `textContent`, `getAttribute()` and `find()` all answer with
 * null or undefined when they answer with nothing, and in a test that answer is
 * never acceptable: an element with no parent, a control with no accessible
 * name, a row that is not in the table are each the thing the test around them
 * exists to catch.
 *
 * `!` was written at forty-seven of those, which is why it is now banned by the
 * linter (ADL A14). It reads as certainty and behaves as silence: the failure
 * arrives later, somewhere else, saying "cannot read properties of null".
 */
export function must<T>(found: T | null | undefined, what: string): T {
  if (found === null || found === undefined) {
    throw new Error(`there is no ${what}`)
  }

  return found
}
