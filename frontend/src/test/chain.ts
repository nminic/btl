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

/** The three ways a piece of the script says „this is not code": the two comments and the
 *  three quotes. */
const QUOTES = ['"', "'", '`']

/**
 * The script from one point onward with everything that is not code blanked out, character
 * for character so that the two texts still line up and a position found in the one is the
 * same position in the other.
 *
 * A bracket is what tells the reader below where the list of controls ends, and a bracket
 * somebody wrote in a sentence is not one. A review put `CONTROLS[2` inside a comment in
 * that list and three cases of this suite fell over saying the list „is not written out as
 * one list", which names the wrong thing entirely: it sends the next reader to the list,
 * where nothing is wrong, rather than to the comment they had just written.
 *
 * Regular expressions are not among the three and cannot be: telling the `/` that opens
 * one from the `/` that divides needs the grammar of the language, and this is a reader of
 * one declaration and not a parser. So the reading starts at the declaration rather than
 * at the top of the file, where the script does write expressions carrying quotes of their
 * own, and a bracket inside one written into the declaration itself is read as code. That
 * is where this stops being able to tell, and it is said here rather than left to be
 * found.
 */
function blanked(text: string, from: number): string {
  const out = [...text]
  const hide = (at: number, until: number) => {
    for (let step = at; step < until; step += 1) {
      /* Line breaks are kept, so a line of the script is still the line it was: the
         complaints below are read by somebody looking at the file. */
      out[step] = text[step] === '\n' ? '\n' : ' '
    }
  }
  let at = from

  while (at < text.length) {
    const two = text.slice(at, at + 2)
    const here = text[at] ?? ''

    if (two === '//' || two === '/*') {
      const shuts = two === '//' ? '\n' : '*/'
      const found = text.indexOf(shuts, at + 2)
      /* An unclosed comment swallows the rest of the file, which is what it does to the
         language too. */
      const ends = found === -1 ? text.length : found + shuts.length

      hide(at, ends)
      at = ends
      continue
    }

    if (QUOTES.includes(here)) {
      let step = at + 1

      while (step < text.length && text[step] !== here) {
        step += text[step] === '\\' ? 2 : 1
      }

      /* The quotes themselves stay, because the reader below looks for the backticks a
         fixture is written between. */
      hide(at + 1, Math.min(step, text.length))
      at = step + 1
      continue
    }

    at += 1
  }

  return out.join('')
}

/** Where something is written out and not where it is talked about: a declaration begins a
 *  line of its own. Found by name anywhere in the file, a sentence of the prose above
 *  naming `const CONTROLS` is where the reading would start, and it would start in the
 *  middle of a comment, which is where blanking it out stops working. */
function declaration(script: string, named: string): number {
  return new RegExp(`^const ${named}\\b`, 'm').exec(script)?.index ?? -1
}

/**
 * The fixtures that script measures, named in the order its `CONTROLS` names them.
 *
 * A fixture is markup with two homes, and the day the script grew a second control it
 * gained a third state nobody had thought of: written out, held against the portal here,
 * and measured by nothing. The list is read by reference and the fixtures were read out
 * by name, so the two never met. A review took the second control out of `CONTROLS`,
 * thirteen lines of it, and every test of this suite stayed green while the script
 * measured one control and said in its own last line that it had measured both.
 *
 * Read as a list and not as the names scattered through the file: a fixture lifted out of
 * `CONTROLS` and left standing in the script is exactly the fault above, and a search for
 * `markup:` anywhere would go on finding it.
 */
export function controlsOf(script: string): string[] {
  const starts = declaration(script, 'CONTROLS')

  if (starts === -1) {
    throw new Error('the script measures no list of controls called CONTROLS')
  }

  const code = blanked(script, starts)
  const opens = code.indexOf('[', starts)
  let depth = 0
  let closes = -1

  /* Counted rather than cut at the first `]`, because an entry of the list is written
     with brackets of its own. Counted over the code and not over the text, because a
     bracket in a comment or in a name is not one of the list's: measured, a comment
     inside the list turned three cases of this suite into a complaint about the list. */
  for (let at = opens; at !== -1 && at < code.length && closes === -1; at += 1) {
    depth += code[at] === '[' ? 1 : 0
    depth -= code[at] === ']' ? 1 : 0

    if (depth === 0) {
      closes = at
    }
  }

  if (closes === -1) {
    throw new Error('CONTROLS is not written out as one list')
  }

  return [...code.slice(opens, closes).matchAll(/\bmarkup:\s*([\w$]+)/g)].map((found) =>
    String(found[1]),
  )
}

/**
 * The markup one fixture of that script is written as, taken out of the file as text.
 *
 * Held to the name the script gives it and to the two backticks its template literal is
 * written between: read from the first `<body>` in the file instead, a boundary lands in
 * whatever prose above happened to say the word, and the script now writes a fixture for
 * each control into one shared `<body>` that belongs to none of them.
 *
 * And held to being one of the fixtures the script actually measures, so that comparing a
 * fixture with the portal is the same event as measuring it: a fixture nobody measures is
 * markup this suite guards for a browser that never looks at it.
 */
export function markupOf(script: string, named: string): string {
  const measured = controlsOf(script)

  if (!measured.includes(named)) {
    throw new Error(
      `the script does not measure ${named}; CONTROLS names ${measured.join(', ')}`,
    )
  }

  const starts = declaration(script, named)

  if (starts === -1) {
    throw new Error(`the script has no fixture called ${named}`)
  }

  /* The two backticks are found in the code and the markup is taken out of the text: a
     backtick written into a comment between the name and the fixture is not the one the
     fixture opens with. */
  const code = blanked(script, starts)
  const opens = code.indexOf('`', starts)
  const closes = code.indexOf('`', opens + 1)

  if (opens === -1 || closes === -1) {
    throw new Error(`the fixture ${named} is not written out as one piece of markup`)
  }

  return script.slice(opens + 1, closes)
}
