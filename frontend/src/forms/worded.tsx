import type { ReactNode } from 'react'
import type { FieldDef } from './types'

/**
 * The words of a field, with the link they carry where they carry one.
 *
 * One case: the confirmation that the rules have been read leads to them (owner,
 * 11.08.2026). The label holds `{link}`, so the sentence and the words of the
 * link are both translated and neither is glued together out of pieces, which is
 * how a sentence ends up in the wrong order in the other language.
 */
export function worded(
  words: string,
  field: FieldDef,
  locale: string,
  t: (key: string) => string,
): ReactNode {
  if (field.linkKey === undefined || field.linkTo === undefined) {
    return words
  }

  const [before, ...rest] = words.split('{link}')
  /* Everything after the first mark, joined back as it was written. Taken as two
     halves, a sentence carrying the mark twice lost everything past the second
     one without a word; the link is drawn once, where it is first asked for. */
  const after = rest.length === 0 ? undefined : rest.join('{link}')

  /* A translation that lost the mark keeps its words rather than gaining a link
     glued to the end of them. The other language is written by somebody working
     from the Serbian, and „{link}" is the sort of thing that is dropped; a
     sentence about the rules with the rules missing is worse than a sentence
     with no link at all, and the dictionary guard cannot see this one because
     the key resolves either way. */
  if (after === undefined) {
    return words
  }

  return (
    <>
      {before}
      {/* A new tab, because following it in the middle of a form that is being
          filled in would otherwise throw away everything typed so far.
       *
          The address is written without the language and gets it here, from the
          page it is being read on (ADL A2): a definition that wrote „/sr/" would
          send an English reader to the Serbian rulebook. */}
      <a href={`/${locale}/${field.linkTo}`} target="_blank" rel="noreferrer">
        {t(field.linkKey)}
      </a>
      {after}
    </>
  )
}
