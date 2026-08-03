export type TocEntry = { heading: string; id: string }

/**
 * The Cyrillic alphabet spelt out in Latin, letter by letter.
 *
 * Because the addresses of two things are read off names people type: a team's
 * (ADL A4d) and an event's. Nothing here is Latin, so without this a name
 * written in Cyrillic came out as no address at all: the first such team
 * answered at `/tim/`, which is no team, and the second was refused as a name
 * already taken though it shared nothing with the first except being empty.
 *
 * And because the same name in the two scripts is one name. The league is
 * Balkan and both are written across it, so "Дунавски тркачи" and "Dunavski
 * trkači" are one team, which is exactly what one address for the two of them
 * says. Macedonian and Bulgarian letters are here for the same reason.
 *
 * Every letter is spelt the way the address already spells its Latin twin,
 * rather than the way a transliteration table would spell it. That is the whole
 * rule and it is easy to get wrong: ђ written out as "dj" made `Ђердап` answer
 * at `djerdap` while `Đerdap` answered at `derdap`, which is two teams under one
 * name, exactly what the address is compared for. The Latin side turns đ into d,
 * so this side must too, and it cannot be fixed on the Latin side without moving
 * every anchor in the rulebook. Macedonian ѓ and ќ go the other way for the same
 * reason: written in Latin they are "gj" and "kj", and those survive as they
 * are.
 *
 * A table, unlike the five Latin letters below it, which are written out one
 * replacement each: there are forty of these, and the pattern that reaches the
 * table hands it one letter at a time out of the Cyrillic block, so a letter
 * that is not in it is a letter the table has nothing to say about and the
 * address is better off without.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'd', е: 'e', ж: 'z', з: 'z',
  и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'c', џ: 'dz', ш: 's',
  /* Macedonian. */
  ѓ: 'gj', ќ: 'kj', ѕ: 'dz', ѐ: 'e', ѝ: 'i',
  /* Bulgarian. */
  й: 'j', щ: 'st', ъ: 'a', ь: 'j', ю: 'ju', я: 'ja',
  /* And the three letters no alphabet of the league writes but a keyboard can
     still produce, so that "a letter of Cyrillic" in the sentence a member
     reads is true of every Cyrillic alphabet in use rather than of three. */
  ё: 'e', ы: 'y', э: 'e',
}

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
 *
 * Cyrillic goes through the table above it, where forty letters make that
 * argument the other way round.
 */
export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[čć]/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'd')
    /* Nothing for a letter the table does not carry: it is Cyrillic, since the
       pattern matched it, and an address it cannot spell is an address without
       it. */
    .replace(/[Ѐ-ӿ]/g, (letter) => CYRILLIC[letter] ?? '')
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

