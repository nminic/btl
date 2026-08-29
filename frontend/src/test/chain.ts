/**
 * Naming the ancestors of a control the same way in two documents.
 *
 * `scripts/refused-control-appearance.mjs` measures a refused control in a real browser
 * over a chain of ancestors it writes out by hand, because it cannot render the portal.
 * A rule keyed on a link that chain is missing beats the refusal on specificity alone
 * and is measured as though it were not there: it drifted twice on the first control,
 * caught both times by a review and by nothing in the suite.
 *
 * So the fixture is read out of the script and put beside the chain a render produces,
 * once for each control the script measures. Neither home is the authority; they have to
 * agree, and what "agree" means is written here rather than in each of them, because a
 * second copy of this comparison is a second opinion about what a chain is.
 */

/** An element said the same way in either document: its tag, its id where that is a fact
 *  both documents share, and its classes in a fixed order. */
export function nameOf(one: Element, withId: boolean): string {
  const named = one.id === '' || !withId ? '' : `#${one.id}`
  const classes = [...one.classList]
    .sort()
    .map((cls) => `.${cls}`)
    .join('')
  /* The names of its attributes as well, because a rule can be keyed on any of them and
     an attribute selector weighs exactly as much as a class. The fixture had drifted
     already: the portal writes `aria-describedby` on this button and `aria-labelledby`
     on the panel, the fixture wrote neither, and a review keyed a rule on the first and
     watched the refusal lose in a browser while both guards stayed green.
     Names and not values: the values are Serbian labels and generated ids, which differ
     for good reasons. `id` and `class` are left out because they are said above. */
  const attributes = [...one.attributes]
    .map((attribute) => attribute.name)
    .filter((attribute) => attribute !== 'id' && attribute !== 'class')
    .sort()
    .join(' ')

  return `${one.tagName.toLowerCase()}${named}${classes}[${attributes}]`
}

/** Every ancestor from the control up to the outermost shell, named the same way
 *  whichever document it is walked in. Classes are sorted, because two homes for one
 *  chain must not disagree over the order somebody wrote them in. The control's own id
 *  is left out of its name: the fixture needs one to find the button by and the portal
 *  has none, while the classes of that same button are exactly what has to agree.
 *
 *  The cut is at the outermost `.shell`, not the first one met walking up. Cut at the
 *  first, a second `.shell` wrapped around the app leaves everything above it
 *  uncompared: a review wrapped one and watched the guard stay green. */
export function chainToShell(from: Element): string[] {
  const walk: Element[] = []
  let step: Element | null = from

  while (step !== null) {
    walk.push(step)
    step = step.parentElement
  }

  const shell = walk.map((one) => one.classList.contains('shell')).lastIndexOf(true)

  return walk.slice(0, shell + 1).map((one, index) => nameOf(one, index > 0))
}

/**
 * The markup one fixture of that script is written as, taken out of the file as text.
 *
 * Held to the name the script gives it and to the two backticks its template literal is
 * written between: read from the first `<body>` in the file instead, a boundary lands in
 * whatever prose above happened to say the word, and the script now writes a fixture for
 * each control into one shared `<body>` that belongs to none of them.
 */
export function markupOf(script: string, named: string): string {
  const starts = script.indexOf(`const ${named}`)

  if (starts === -1) {
    throw new Error(`the script has no fixture called ${named}`)
  }

  const opens = script.indexOf('`', starts)
  const closes = script.indexOf('`', opens + 1)

  if (opens === -1 || closes === -1) {
    throw new Error(`the fixture ${named} is not written out as one piece of markup`)
  }

  return script.slice(opens + 1, closes)
}
