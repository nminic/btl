import { createContext } from 'react'

/** The two texts that name and describe one page. */
export type PageMeta = {
  title: string
  description: string
}

/** How a screen hands its own two texts over, and takes them back when it goes. */
export type DeclareMeta = (meta: PageMeta | null) => void

export const PageMetaContext = createContext<DeclareMeta | null>(null)
