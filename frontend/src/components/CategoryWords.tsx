/**
 * The words of one category button of the BTL tables, in the two forms the filter has (owner, 21.11.2026, PDL: where
 * the filter would not stand in one row the categories are written without the mark of the gender, „24-" and not
 * „M 24-", because the control above already says the gender).
 *
 * **The full name is always there and is always what is read out**: `.seg__long` is drawn while the filter stands in
 * one row and is clipped to a pixel, as `.visually-hidden` is, when it does not (`Segmented.css`), and never
 * `display: none`, which would take it out of the name of the button. The short form is `aria-hidden`, so a
 * reader is not given the category twice. A label that is already as short as it gets (`Početnici`, „Sve") is
 * drawn once, as it is.
 */
export function CategoryWords({ full, short }: { full: string; short: string }) {
  if (full === short) {
    return <>{full}</>
  }

  return (
    <>
      <span className="seg__long">{full}</span>
      <span className="seg__short" aria-hidden="true">
        {short}
      </span>
    </>
  )
}
