export {}

/* A CSS custom property is a value a `style` prop is allowed to carry.
 *
 * The portal hands numbers to the stylesheet through variables rather than
 * through written-out rules: how full a bar is, which hue a face gets, how many
 * columns a form makes, which day a month starts on. React's own
 * `CSSProperties` lists the CSS properties and nothing else, so every one of
 * those was written `{ '--level': n } as CSSProperties`, and that assertion is
 * what ADL A14 bans.
 *
 * Said once here instead. It is not an assertion but a fact about React: a
 * `--` name in a style object is set through `setProperty` and works, which is
 * why the code was written that way in the first place. Nothing else widens:
 * only names beginning with two dashes are added, so a misspelt `colour` is
 * still refused.
 */
declare module 'react' {
  interface CSSProperties {
    [custom: `--${string}`]: string | number | undefined
  }
}
