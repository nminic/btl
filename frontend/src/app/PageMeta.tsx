import { useContext, useEffect } from 'react'
import { PageMetaContext, type DeclareMeta, type PageMeta as Meta } from './pageMetaContext'

function useDeclareMeta(): DeclareMeta {
  const declare = useContext(PageMetaContext)

  if (declare === null) {
    throw new Error('PageMeta must be used inside PageMetaContext')
  }

  return declare
}

/**
 * How a screen that shows one record names the page after that record: the
 * profile carries the person, the event carries its name and its date.
 *
 * It renders nothing. It hands the two texts to the one place that writes them
 * into the document (useRouteChrome), so that no screen has to know that meta
 * tags exist, and the head can never end up with two titles fighting over it.
 *
 * A component rather than a hook, because the record arrives inside the callback
 * of <Resource> and a hook cannot be called there. Leaving the screen gives the
 * page its name from the route table back.
 *
 * One rule for the texts that go in here: a name enters the sentence exactly as
 * it is written in the record, in the nominative, so the wording around it must
 * never be one that asks for another case. "Trke na događaju {name}" produces
 * "na događaju Podgorička desetka", which is wrong Serbian. That is why every
 * recordDescription under `seo` puts the name first, ahead of a colon, where no
 * case is asked of it.
 */
export function PageMeta({ title, description }: Meta) {
  const declare = useDeclareMeta()

  useEffect(() => {
    declare({ title, description })

    return () => declare(null)
  }, [declare, title, description])

  return null
}
