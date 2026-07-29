import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { RoleSwitch } from '../roles/RoleSwitch'
import { useRole } from '../roles/useRole'
import { isMember } from '../roles/context'
import { AccountMenu } from './AccountMenu'
import { Brand } from './Brand'
import { Dropdown } from './Dropdown'
import { ErrorBoundary } from './ErrorBoundary'
import { GearIcon } from './icons'
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
      {(close) => (
        <>
          {section.items.map((item) => (
            <NavLink
              key={item.path}
              to={`/${locale}/${item.path}`}
              className="navgroup__link"
              onClick={() => {
                close()
                onNavigate()
              }}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </>
      )}
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
  const signedIn = isMember(role)

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
            {signedIn && <MessagesMenu />}
            <AccountMenu />
            {signedIn && (
              <Link
                className="icon-link"
                to={`/${locale}/podesavanja`}
                aria-label={t('shell.settings')}
                onClick={closeMenu}
              >
                <GearIcon className="icon-link__glyph" />
              </Link>
            )}
            <LanguageMenu restOfPath={rest} />
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
