import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useCompetitors, useEvents } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { countsFor, QUEUES } from '../pages/admin/queues'
import { RoleSwitch } from '../roles/RoleSwitch'
import { useRole } from '../roles/useRole'
import { useSession } from '../session/useSession'
import { AccountMenu } from './AccountMenu'
import { Brand } from './Brand'
import { Dropdown } from './Dropdown'
import { ErrorBoundary } from './ErrorBoundary'
import { LanguageMenu } from './LanguageMenu'
import { MessagesMenu } from './MessagesMenu'
import { CONTACT_ADDRESS, FOOTER_ROUTES, navForRole, type NavSection } from './routes'
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

/** The one navigation entry that carries a number beside it (PDL P28a). */
const VERIFICATION = 'administracija/verifikacija'

/**
 * How much work is waiting for a moderator: the sum of the queues on the
 * verification screen, counted from the same place that screen counts it, so the
 * two can never disagree.
 *
 * The two files are asked for here as well as there, and the data layer keeps a
 * resource for the whole visit, so this costs one request. A header that waited
 * for them would hold up every screen behind it, so until they arrive the number
 * says what the session alone knows.
 */
function useWaiting(): number {
  const { submissions } = useSession()
  const competitors = useCompetitors()
  const events = useEvents()

  const counts = countsFor(
    submissions.filter((one) => one.status === 'pending').length,
    competitors.status === 'ready' ? competitors.data : [],
    events.status === 'ready' ? events.data : [],
  )

  return QUEUES.reduce((sum, queue) => sum + counts[queue.id], 0)
}

/* Verification, with the number of items waiting behind it. The count goes into
 * the name of the link and not only into the badge, because an aria-label
 * replaces everything inside the element: a badge described by nothing is a
 * badge a screen reader never reads out. The inbox in MessagesMenu does the
 * same. Nothing at all is shown while nothing is waiting. */
function VerificationLink({ label, onFollow }: { label: string; onFollow: () => void }) {
  const { locale, t } = useI18n()
  const waiting = useWaiting()

  return (
    <NavLink
      to={`/${locale}/${VERIFICATION}`}
      className="navgroup__link"
      aria-label={waiting === 0 ? undefined : `${label}, ${t('shell.waiting', { count: waiting })}`}
      onClick={onFollow}
    >
      {label}
      {waiting > 0 && (
        <span className="navgroup__waiting" aria-hidden="true">
          {waiting}
        </span>
      )}
    </NavLink>
  )
}

function NavEntry({ section, onNavigate }: { section: NavSection; onNavigate: () => void }) {
  const { locale, t } = useI18n()
  const label = t(section.labelKey)

  // A group with one screen behind it would be a menu that opens onto a single
  // choice, so those stay plain links.
  if (section.path !== undefined) {
    return (
      <NavLink to={`/${locale}/${section.path}`} className="shell__link" onClick={onNavigate}>
        {label}
      </NavLink>
    )
  }

  return (
    <Dropdown
      id={`nav-${section.id}`}
      className="navgroup"
      label={label}
      trigger={<span className="navgroup__label">{label}</span>}
    >
      {(close) => {
        const follow = () => {
          close()
          onNavigate()
        }

        return (
          <>
            {section.items.map((item) =>
              item.path === VERIFICATION ? (
                <VerificationLink key={item.path} label={t(item.labelKey)} onFollow={follow} />
              ) : (
                <NavLink
                  key={item.path}
                  to={`/${locale}/${item.path}`}
                  className="navgroup__link"
                  onClick={follow}
                >
                  {t(item.labelKey)}
                </NavLink>
              ),
            )}
          </>
        )
      }}
    </Dropdown>
  )
}

export function Shell() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const rest = useRestOfPath()
  const pageTitle = useRouteChrome()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
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
            <RoleSwitch />
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
                <Link className="button button--compact" to={`/${locale}/registracija`}>
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
          {navForRole(role).map((section) => (
            <NavEntry key={section.id} section={section} onNavigate={closeMenu} />
          ))}
        </nav>
      </header>

      {/* Says out loud which screen just opened. The browser announces a page
          change on its own; a single page application has to do it by hand. */}
      <p className="visually-hidden" role="status">
        {pageTitle}
      </p>

      <main id="content" className="shell__main">
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
        <p className="shell__note">{t('shell.footerNote')}</p>
      </footer>
    </div>
  )
}
