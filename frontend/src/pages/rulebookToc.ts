export type TocEntry = { heading: string; id: string }

/**
 * Turns a heading into an id that is stable and safe inside an address.
 *
 * Our five letters are written out the way an address can carry them. Spelling
 * them out beats stripping accents through Unicode decomposition, because đ has
 * no decomposed form and would fall out of that trick anyway.
 *
 * One replacement per letter, rather than one pass over all five that looks the
 * plain letter up in a table of them: a table says nothing about which keys are
 * in it, so every lookup has to answer for a letter that is not there, and the
 * pattern doing the matching has already ruled that letter out.
 */
export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[čć]/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Every item given the id its link points at, carrying whatever else it holds.
 *
 * A screen that draws these needs the heading, the text under it and the id of
 * its anchor on one row. Handing back the ids on their own leaves the caller
 * with two lists lined up by position, where the section drawn third takes the
 * id of the third entry on trust and nothing says the two are the same length.
 *
 * Two headings that read the same, or a heading that holds no letters at all,
 * would otherwise share an id and the side navigation would send both links to
 * the same place, so both cases fall back to the position in the document.
 */
export function withIds<T extends { heading: string }>(items: T[]): (T & { id: string })[] {
  const taken = new Set<string>()

  return items.map((item, index) => {
    const slug = slugify(item.heading)
    let id = slug === '' || taken.has(slug) ? `sekcija-${index + 1}` : slug

    /* The fallback is not safe on its own either: a heading that reads
     * "Sekcija 3" slugifies to exactly what the third heading falls back to. A
     * number is added until the id is free, because two links onto one anchor is
     * the very fault this function exists to prevent. */
    for (let attempt = 2; taken.has(id); attempt += 1) {
      id = `sekcija-${index + 1}-${attempt}`
    }

    taken.add(id)

    return { ...item, id }
  })
}

/** The same for headings on their own, which is the contents of a page without
 *  the text under it. */

