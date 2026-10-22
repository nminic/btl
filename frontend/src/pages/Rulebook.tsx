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

/* How near the end of the page counts as the end of it. A browser at a zoom that is
 * not a whole number stops a fraction of a pixel short of the last pixel. */
const BOTTOM_SLACK = 2

/* The keys that move a page: the arrows, the page keys, the ends and the space bar. Tab and the
 * letters move nothing, and a reader who tabs from the link he pressed has not left the section. */
const KEYS_THAT_SCROLL = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

/* Whether the reader has come to the end of the page. Not true on a page that has not been
 * scrolled at all: a rulebook short enough to fit the window would otherwise stand at its end
 * from the first moment and have its last section marked before a word was read. */
function atTheEnd(): boolean {
  return (
    window.scrollY > 0 &&
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - BOTTOM_SLACK
  )
}

/**
 * Which section the side navigation marks.
 *
 * Three things say it, in this order:
 *
 * 1. **The link the reader pressed**, until the reader scrolls on their own. The page cannot bring
 *    every section to the line the reading is judged by: the last ones are shorter than the
 *    window, so pressing „Dukati" takes the page to its end and stops there, with the section
 *    still under the line. Reading it off the scroll position then marked the one below it, or
 *    nothing, and the reader had pressed a link and been told he was elsewhere (owner,
 *    22.10.2026). The glide to the section scrolls too, with pauses between its scroll events that
 *    no time limit can tell from the end of it (a busy page held them up 216 to 433ms in review,
 *    and the link let go in the middle of the glide), so the page's own scrolling is not read at
 *    all: the pressed link holds until the reader moves the page himself, by wheel, touch, a key
 *    that scrolls, or the bar at the edge of the window.
 * 2. **The last section, when the page has been read to its end.** The same reason from the other
 *    side: the last section is the one that cannot rise to the line, so the line alone never
 *    marked it however far the reader went.
 * 3. **The section at the line**, from the observer. Where it is missing, the first section
 *    stands as the current one, and the end of the page still marks the last: a marker that never
 *    moves is better than no marker at all.
 */
function useCurrentSection(ids: string[]): { current: string; choose: (id: string) => void } {
  const [reading, setReading] = useState(() => ids.slice(0, 1).join(''))
  const [chosen, setChosen] = useState<string | undefined>(undefined)

  useEffect(() => {
    const onScreen = new Set<string>()

    /* The last section when the end of the page has been reached, else the first of those in the
       band. Between two sections nothing is in the band, and the marker then stays where it was
       rather than blinking off and back on. A list of at most one id rather than a lookup that
       may find nothing, so that a page with no sections is a list with nothing in it. */
    const update = () => {
      const picked = atTheEnd() ? ids.slice(-1) : ids.filter((id) => onScreen.has(id)).slice(0, 1)

      setReading((previous) => picked[0] ?? previous)
    }

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  onScreen.add(entry.target.id)
                } else {
                  onScreen.delete(entry.target.id)
                }
              }

              update()
            },
            { rootMargin: READING_BAND },
          )

    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null)

    for (const section of sections) {
      observer?.observe(section)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })

    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', update)
    }
  }, [ids])

  useEffect(() => {
    if (chosen === undefined) {
      return undefined
    }

    const release = () => setChosen(undefined)
    const onKey = (event: KeyboardEvent) => {
      if (KEYS_THAT_SCROLL.has(event.key)) {
        release()
      }
    }
    /* The bar at the edge of the window answers a press as the page itself (`html`), as nothing the
       page draws does; a press on the text or on a link is not the reader moving the page. */
    const onPointer = (event: PointerEvent) => {
      if (event.target === document.documentElement) {
        release()
      }
    }

    window.addEventListener('wheel', release, { passive: true })
    window.addEventListener('touchmove', release, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)

    return () => {
      window.removeEventListener('wheel', release)
      window.removeEventListener('touchmove', release)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [chosen])

  return { current: chosen ?? reading, choose: setChosen }
}

/* The rulebook is a written page like every other, so it is drawn through the
 * same door: what it shows is its own sections and the ones it takes in, in that
 * order (src/data/pages.ts). Reading `page.sections` here instead meant that an
 * administrator who added `includes` to the rulebook would be told by the list of
 * pages that the text had been taken in, and would find the rulebook drawing
 * nothing of it. Two screens over one record must not disagree about what the
 * record says. */
function RulebookPage({ pages, page }: { pages: StaticPage[]; page: StaticPage }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  /* The heading, the text under it and the id its link points at, on one row.
     The contents and the body used to be two lists lined up by position, so the
     section drawn third took the id of the third entry of the contents and
     nothing said the two lists were the same length. */
  const sections = useMemo(() => withIds(sectionsOf(pages, page)), [pages, page])
  const ids = useMemo(() => sections.map((section) => section.id), [sections])
  const { current, choose } = useCurrentSection(ids)

  return (
    /* The language of the words, the page's own and not the address's - the same attribute
       and the same reason as `pages/StaticPage.tsx`, which says it in full. It goes on the
       article and therefore over the contents beside the text as well, which is right: those
       headings are the sections' own headings and fall back with them. */
    <article className="rulebook" lang={page.language}>
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
                    onClick={() => {
                      choose(section.id)
                      setOpen(false)
                    }}
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
