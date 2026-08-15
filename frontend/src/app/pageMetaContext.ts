import { createContext } from 'react'

/** The two texts that name and describe one page, and where it really lives. */
export type PageMeta = {
  title: string
  description: string
  /**
   * The address this page is the one true copy at, without the language in
   * front, where that is not simply the address being read.
   *
   * One screen needs it. A profile answers at `takmicar/000127-nikola-minic`
   * and also at `takmicar/000127`, because the number is what identifies
   * anybody and a bookmark made before the name was added still has to open
   * (pages/profileAddress.ts). Left alone, each of those would name itself as
   * canonical and a search engine would be handed one person twice.
   *
   * PDL P11 says there is one address and no alias. This is what makes that
   * true of what is served rather than only of what is linked.
   */
  path?: string
}

/** How a screen hands its own two texts over, and takes them back when it goes. */
export type DeclareMeta = (meta: PageMeta | null) => void

export const PageMetaContext = createContext<DeclareMeta | null>(null)
