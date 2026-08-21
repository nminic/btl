import { useEffect, useMemo, useState } from 'react'
import { PageSectionBody } from '../components/PageSectionBody'
import { Resource } from '../components/Resource'
import { livePage, sectionsOf } from '../data/pages'
import { usePages } from '../data/useResource'
import type { StaticPage } from '../data/types'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import { withIds } from './rulebookToc'
import './Rulebook.css'

const SLUG = 'pravilnik'

/* The band the reader is actually looking at: everything under the top of the
 * window and above the last third of it. Without it the section that is barely
 * peeking in from the bottom would count as the one being read. */
const READING_BAND = '0px 0px -66% 0px'

/**
 * Which section is on screen, so the side navigation can say so.
 *
 * The observer is the only way to know this without measuring on every scroll
 * event. Where it is missing, the first section stands as the current one:
 * a marker that never moves is better than no marker at all.
 */
function useCurrentSection(ids: string[]): string {
  const [current, setCurrent] = useState('')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      /* A page with no sections has none to stand as the current one, and the
         marker stays where it started, which is nowhere. Written as a walk over
         at most one id rather than as a fallback, because the fallback could not
         be reached and an unreachable branch is a claim nothing checks. */
      ids.slice(0, 1).forEach(setCurrent)
      return
    }

    const onScreen = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onScreen.add(entry.target.id)
          } else {
            onScreen.delete(entry.target.id)
          }
        }

        const first = ids.find((id) => onScreen.has(id))

        // Between two sections nothing is in the band. The marker then stays
        // where it was rather than blinking off and back on.
        setCurrent((previous) => first ?? previous)
      },
      { rootMargin: READING_BAND },
    )

    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null)

    for (const section of sections) {
      observer.observe(section)
    }

    return () => observer.disconnect()
  }, [ids])

  return current
}

/* The rulebook is a written page like every other, so it is drawn through the
 * same door: what it shows is its own sections and the ones it takes in, in that
 * order (src/data/pages.ts). Reading `page.sections` here instead meant that an
 * administrator who added `includes` to the rulebook would be told by the list of
 * pages that the text had been taken in, and would find the rulebook drawing
 * nothing of it. Two screens over one record must not disagree about what the
 * record says. */
function RulebookPage({ pages, page }: { pages: Record<string, StaticPage>; page: StaticPage }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  /* The heading, the text under it and the id its link points at, on one row.
     The contents and the body used to be two lists lined up by position, so the
     section drawn third took the id of the third entry of the contents and
     nothing said the two lists were the same length. */
  const sections = useMemo(() => withIds(sectionsOf(pages, page)), [pages, page])
  const ids = useMemo(() => sections.map((section) => section.id), [sections])
  const current = useCurrentSection(ids)

  return (
    <article className="rulebook">
      <h1>{page.title}</h1>

      <div className="rulebook__layout">
        {/* On a phone the list of sections would push the text off the first
            screen, so there it sits behind a button. From tablet up the button
            goes away and the list stands beside the text and follows it down. */}
        <nav className="rulebook__toc" aria-label={t('rulebook.onThisPage')}>
          <button
            type="button"
            className="rulebook__toggle"
            aria-expanded={open}
            aria-controls="rulebook-sections"
            onClick={() => setOpen((wasOpen) => !wasOpen)}
          >
            {t('rulebook.openSections')}
          </button>

          <div
            id="rulebook-sections"
            className={open ? 'rulebook__panel rulebook__panel--open' : 'rulebook__panel'}
          >
            <p className="rulebook__toc-title">{t('rulebook.onThisPage')}</p>

            <ol className="rulebook__toc-list">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    className="rulebook__toc-link"
                    href={`#${section.id}`}
                    /* Colour alone would leave the reader who cannot see it
                       without the answer, so the state is in the markup too. */
                    aria-current={current === section.id ? 'location' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="rulebook__body">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              /* Following a link has to move the reading position as well as
                 the scroll position, and only a focusable element does that. */
              tabIndex={-1}
            >
              <h2>{section.heading}</h2>
              {/* The text, and the drawing the record names beside it (owner,
                  04.08.2026). Drawn through the one component both screens of
                  written pages share, so a section cannot mean one thing here
                  and another on the terms (src/components/PageSectionBody.tsx). */}
              <PageSectionBody section={section} />
            </section>
          ))}
        </div>
      </div>
    </article>
  )
}

/** The rulebook of the season, written out in full, with its own contents. */
export function Rulebook() {
  const { deletions } = useSession()
  const { t } = useI18n()
  const state = usePages()

  return (
    <Resource state={state}>
      {(pages) => {
        const page = livePage(pages, SLUG, deletions.pages ?? [])

        if (page === undefined) {
          return <h1>{t('notFound.title')}</h1>
        }

        return <RulebookPage pages={pages} page={page} />
      }}
    </Resource>
  )
}
