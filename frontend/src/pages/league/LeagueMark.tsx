/**
 * THE SIGN OF A COMPETITION, FROM THE INITIALS OF ITS NAME, FOR TONIGHT.
 *
 * Owner, 21.11.2026 (PDL, „Strana „Lige” se radi po predlogu B”): „Znak lige večeras je iz inicijala;
 * polje za pravi logo u moderaciji lige je poseban posao posle otvaranja.” So this is drawn from the
 * name and from nothing else, and the day a league carries a picture of its own this is the one place
 * that changes.
 *
 * **Which letters** is my reasoning and not a decision: a name written as one word with capitals in it
 * („RunTrace”) gives its first two capitals; otherwise the first letter of each of the first two words
 * that are words of the name rather than the word for a league, a year or a joining word (so
 * „RunTrace liga 2027” is RT and „Trail liga Srbije” is TS). A name with one such word gives one letter.
 *
 * Hidden from a reader working by ear: the name it stands beside is said in full.
 */
export function LeagueMark({ name }: { name: string }) {
  return (
    <span className="leagues__mark" aria-hidden="true">
      {initialsOf(name)}
    </span>
  )
}

/** The words that name what a competition is rather than which one it is. */
const NOT_A_NAME = new Set(['liga', 'league', 'lige'])

export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word))
  const capitals = (words[0] ?? '').match(/\p{Lu}/gu) ?? []

  if (capitals.length >= 2) {
    return capitals.slice(0, 2).join('')
  }

  return words
    .filter((word) => word.length > 2 && !NOT_A_NAME.has(word.toLocaleLowerCase('sr')))
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('sr'))
    .join('')
}
