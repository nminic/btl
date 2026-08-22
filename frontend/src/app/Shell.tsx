import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { DateSwitch } from '../clock/DateSwitch'
import { dataOr } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { useMayOpen, usePermittedQueues } from '../pages/admin/mayOpen'
import { usePending } from '../pages/admin/pending'
import { totalWaiting } from '../pages/admin/queues'
import { RoleSwitch } from '../roles/RoleSwitch'
import { useRole } from '../roles/useRole'
import { useSession } from '../session/useSession'
import { AccountMenu } from './AccountMenu'
import { Brand } from './Brand'
import { ErrorBoundary } from './ErrorBoundary'
import { LanguageMenu } from './LanguageMenu'
import { MessagesMenu } from './MessagesMenu'
import { PageMetaContext } from './pageMetaContext'
import { CONTACT_ADDRESS, FOOTER_ROUTES, navForRole, type NavSection } from './routes'
import { useNewScreen } from './useNewScreen'
import { useRouteChrome } from './useRouteChrome'
import './Shell.css'

function useRestOfPath(): string {
  const location = useLocation()
  // Everything after /<locale>, so the language switch stays on the same
  // screen. Query and hash come along, or a filtered table would silently
  // reset itself when the language changes.
  const rest = location.pathname.split('/').slice(2).join('/')

  return `${rest}${location.search}${location.hash}`
}

/** The one navigation entry that carries a number beside it (PDL P28a). It was
 *  Verification while the header had groups; the number moved up with the word
 *  that is left, and says the same thing (owner, 04.08.2026). */
const ADMIN = 'administracija'

/**
 * How much work is waiting for a moderator: the sum of the queues on the
 * verification screen, counted from the same place that screen counts it, so the
 * two can never disagree.
 *
 * One file, which is the one the numbers come out of. The file of members was
 * asked for here too, for a field nothing counted from any more, and this counter
 * stands above every screen on the portal: one dead line in a type meant one
 * request for a million bytes of members on the front page, the calendar and
 * every table.
 *
 * It is asked for here as well as on the verification screen, and the data layer
 * keeps a resource for the whole visit, so it costs one request. A header that
 * waited for it would hold up every screen behind it, so until it arrives the
 * number says what the session alone knows.
 */
function useWaiting(): number {
  const { submissions, decisions } = useSession()
  const items = usePending()
  /* Over the queues this moderator may work in and no others. A total that
     counted the rest would send him looking for work he cannot reach and is not
     shown anywhere (owner, 30.07.2026). */
  const queues = usePermittedQueues()

  return totalWaiting(
    {
      pendingResults: submissions.filter((one) => one.status === 'pending').length,
      items: dataOr(items, []),
      decisions,
    },
    queues,
  )
}

/**
 * The navigation as this person sees it.
 *
 * A screen they may not open is one they are not to be told about at all (owner,
 * 30.07.2026). Asked through the same table the door is (needs.ts), so a screen
 * cannot be named here and refused there.
 */
function useNavSections(): NavSection[] {
  const { role } = useRole()
  const mayOpen = useMayOpen()

  return navForRole(role).filter((section) => mayOpen(section.path))
}

/* Administration, with the number of things waiting behind it. The count goes
 * into the name of the link and not only into the counter, because an aria-label
 * replaces everything inside the element: a counter described by nothing is a
 * counter a screen reader never reads out. The inbox in MessagesMenu does the
 * same. Nothing at all is shown while nothing is waiting. */
function AdminLink({ label, onNavigate }: { label: string; onNavigate: () => void }) {
  const { locale, t } = useI18n()
  const waiting = useWaiting()

  return (
    <NavLink
      to={`/${locale}/${ADMIN}`}
      className="shell__link"
      aria-label={waiting === 0 ? undefined : `${label}, ${t('shell.waiting', { count: waiting })}`}
      onClick={onNavigate}
    >
      {label}
      {waiting > 0 && (
        <span className="shell__waiting" aria-hidden="true">
          {waiting}
        </span>
      )}
    </NavLink>
  )
}

function NavEntry({ section, onNavigate }: { section: NavSection; onNavigate: () => void }) {
  const { locale, t } = useI18n()
  const label = t(section.labelKey)

  if (section.path === ADMIN) {
    return <AdminLink label={label} onNavigate={onNavigate} />
  }

  return (
    <NavLink to={`/${locale}/${section.path}`} className="shell__link" onClick={onNavigate}>
      {label}
    </NavLink>
  )
}

export function Shell() {
  const main = useRef<HTMLElement>(null)
  const { locale, t } = useI18n()
  const sections = useNavSections()
  const rest = useRestOfPath()
  const { pageTitle, declare } = useRouteChrome()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  useNewScreen(main)
  /* Signing out has to empty the header. This used to read the role, which the
     development role switch also sets, so the inbox and the cog stayed on
     screen after a member signed out. The session is the one that knows. */
  const { memberNumber } = useSession()

  return (
    <div className="shell">
      <a className="shell__skip" href="#content">
        {t('shell.skipToContent')}
      </a>

      <header className="shell__header">
        <div className="shell__bar">
          <Brand onNavigate={closeMenu} />

          <div className="shell__tools">
            {/* The two development controls, side by side and gone together in
                production (src/dev/tools.ts): who is at the keyboard, and what
                day the portal is being read as. */}
            <RoleSwitch />
            <DateSwitch />
            <LanguageMenu restOfPath={rest} />

            {/* Signed in: the inbox, then the picture whose menu holds settings
                and signing out. That is where nearly every portal keeps them,
                and a separate cog would be a second door to the same room.

                Signed out: the two things a visitor is here to do, with joining
                as the loud one. It is the only control on this page that brings
                the league any money. */}
            {memberNumber !== null ? (
              <>
                <MessagesMenu />
                <AccountMenu memberNumber={memberNumber} />
              </>
            ) : (
              <>
                <Link className="button button--secondary button--compact" to={`/${locale}/prijava`}>
                  {t('shell.signIn')}
                </Link>
                <Link className="button--cta" to={`/${locale}/registracija`}>
                  {t('shell.join')}
                </Link>
              </>
            )}
            <button
              type="button"
              className="shell__icon-button shell__menu-button"
              aria-expanded={menuOpen}
              aria-controls="main-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? t('shell.closeMenu') : t('shell.openMenu')}
            </button>
          </div>
        </div>

        <nav
          id="main-navigation"
          className={menuOpen ? 'shell__nav shell__nav--open' : 'shell__nav'}
          aria-label={t('shell.mainNavigation')}
        >
          {sections.map((section) => (
            <NavEntry key={section.id} section={section} onNavigate={closeMenu} />
          ))}
        </nav>
      </header>

      {/* Back to the top on a new screen, and back where it was on the way back.
          A data router turns the browser's own handling off, so without this
          every screen opened from halfway down a table opened halfway down.

          One saved position per history entry, which is the default and is what
          makes going back land exactly where it left (owner, 04.08.2026). It was
          keyed on the path alone for a while, to stop a filter counting as a new
          screen; that is now said where it is true, on the writing of the filter
          itself (useFilterParams). The path as a key answered a second question
          it was never asked: a screen reopened from the navigation found the
          position of the last visit waiting for it, so pressing "Kalendar"
          landed halfway down the calendar. */}
      <ScrollRestoration />

      {/* Says out loud which screen just opened. The browser announces a page
          change on its own; a single page application has to do it by hand. */}
      <p className="visually-hidden" role="status">
        {pageTitle}
      </p>

      {/* A screen that shows one record names the page after that record, and
          this is how it says so. One writer, so the head can never be pulled in
          two directions at once. */}
      <PageMetaContext.Provider value={declare}>
        <main id="content" className="shell__main" ref={main} tabIndex={-1}>
          <ErrorBoundary
            fallback={
              <div role="alert">
                <h1>{t('error.title')}</h1>
                <p>{t('error.text')}</p>
              </div>
            }
          >
            <Outlet />
          </ErrorBoundary>
        </main>
      </PageMetaContext.Provider>

      <footer className="shell__footer">
        <nav className="shell__footer-links" aria-label={t('shell.footerNavigation')}>
          {FOOTER_ROUTES.map((route) => (
            <NavLink
              key={route.path}
              to={`/${locale}/${route.path}`}
              className="shell__link"
              onClick={closeMenu}
            >
              {t(route.labelKey)}
            </NavLink>
          ))}
          {/* Contact is an address, not a screen (PDL P28a). A form would need
              robot protection, storage and one more queue to answer the same
              question a mail client already answers. */}
          <a className="shell__link" href={`mailto:${CONTACT_ADDRESS}`}>
            {t('shell.contact')}
          </a>
        </nav>
        {/* The statute is not linked from here any more (owner, 22.08.2026: „izbaci
            i dugme Statut iz footera sajta, ne želim ga tu"). Član 34 stav 6 of the
            statute puts it on the internet page of the association and član 39 stav 2
            gives three days to do it, and that obligation is met by the link in the
            first section of the terms of use, which is where a reader looking for the
            document would go. It was a page of twenty sections until 20.08.2026, then a
            file linked from here; the file stays, the button goes. */}
        <p className="shell__note">{t('shell.footerNote')}</p>
        {/* The credit for the codebook of towns behind the place field is not
            here any more (owner, 11.08.2026). GeoNames is CC BY 4.0 and asks to
            be named wherever the material is shared, which the licence lets a
            work do „in any reasonable manner based on the medium"; on a portal,
            the terms of use is such a place. It is in the section on technical
            partners (public/mock/pages.json, `uslovi-koriscenja`), which is where
            a credit belongs and is as quiet as naming it can be without ceasing
            to name it. It stood in the sign-off until 22.08.2026, when the owner
            added that section and moved it there; a guard reads it by the
            sentence rather than by counting to the last section, so the next
            section added under it breaks nothing. */}
      </footer>
    </div>
  )
}
