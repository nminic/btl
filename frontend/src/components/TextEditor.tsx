import { lazy, Suspense } from 'react'
import type { EditorProps } from './markdownEditor/props'

/* Loaded the first time it is drawn, and never by a screen that does not draw it. The editor and
   the library under it are a third of the size of the whole portal (measured 17.10.2026, PR
   description), and the only people who ever see it are the administration: a visitor reading the
   calendar would be downloading an editor for nobody. */
const MarkdownEditor = lazy(() => import('./markdownEditor/MarkdownEditor'))

/**
 * The editor of a written text, „vidiš šta dobijaš" (`markdownEditor/MarkdownEditor.tsx`).
 *
 * While it loads, the place it will stand in is held at its height, so the form does not jump when
 * it arrives. Nothing is drawn that could be typed into: a box that takes keys for a moment and is
 * then replaced would lose them.
 */
export function TextEditor(props: EditorProps) {
  return (
    <Suspense fallback={<div className="md-editor md-editor--waiting" aria-hidden="true" />}>
      <MarkdownEditor {...props} />
    </Suspense>
  )
}
