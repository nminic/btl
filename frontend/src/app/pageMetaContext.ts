import { createContext } from 'react'

/** The two texts that name and describe one page. */
export type PageMeta = {
  title: string
  description: string
  /**
   * What a shared link to this page is titled, where that is not the title of the tab. Only the
   * profile has one (owner, 15.11.2026: „boldovan naslov treba da glasi Nikola Minić u Balkanskoj
   * trkačkoj ligi"), and the server writes the same sentence into the page it sends for that
   * address (`CompetitorPreviewApi`), which is held to this one by `CompetitorPreviewApiTest`.
   */
  shareTitle?: string | undefined
}

/** How a screen hands its own two texts over, and takes them back when it goes. */
export type DeclareMeta = (meta: PageMeta | null) => void

export const PageMetaContext = createContext<DeclareMeta | null>(null)
