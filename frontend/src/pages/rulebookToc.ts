export type TocEntry = { heading: string; id: string }

/* Our five letters, written the way an address can carry them. Spelling them
 * out beats stripping accents through Unicode decomposition, because đ has no
 * decomposed form and would fall out of that trick anyway. */
const LETTERS: Record<string, string> = {
  č: 'c',
  ć: 'c',
  š: 's',
  ž: 'z',
  đ: 'd',
}

/** Turns a heading into an id that is stable and safe inside an address. */
export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[čćšžđ]/g, (letter) => LETTERS[letter])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Pairs every heading with the id its link points at.
 *
 * Two headings that read the same, or a heading that holds no letters at all,
 * would otherwise share an id and the side navigation would send both links to
 * the same place, so both cases fall back to the position in the document.
 */
export function tableOfContents(headings: string[]): TocEntry[] {
  const taken = new Set<string>()

  return headings.map((heading, index) => {
    const slug = slugify(heading)
    const id = slug === '' || taken.has(slug) ? `sekcija-${index + 1}` : slug

    taken.add(id)

    return { heading, id }
  })
}
