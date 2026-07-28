import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { LOCALES } from '../i18n/config'
import { useI18n } from '../i18n/useI18n'
import { RoleSwitch } from '../roles/RoleSwitch'
import { useRole } from '../roles/useRole'
import { ErrorBoundary } from './ErrorBoundary'
import { routesForRole, type NavGroup } from './routes'
import { useRouteChrome } from './useRouteChrome'
import { useTheme } from './useTheme'
import './Shell.css'

function useRestOfPath(): string {
  const location = useLocation()
  // Everything after /<locale>, so the language switch stays on the same
  // screen. Query and hash come along, or a filtered table would silently
  // reset itself when the language changes.
  const rest = location.pathname.split('/').slice(2).join('/')

  return `${rest}${location.search}${location.hash}`
}

function LanguageSwitch() {
  const { locale, t } = useI18n()
  const rest = useRestOfPath()

  return (
    <nav className="shell__languages" aria-label={t('language.label')}>
      {LOCALES.map((option) => (
        <Link
          key={option}
          to={`/${option}/${rest}`}
          className="shell__language"
          aria-current={option === locale ? 'page' : undefined}
          lang={option}
        >
          {t(`language.${option}`)}
        </Link>
      ))}
    </nav>
  )
}

function ThemeToggle() {
  const { t } = useI18n()
  const { theme, toggle } = useTheme()
  const label = theme === 'dark' ? t('theme.toLight') : t('theme.toDark')

  return (
    <button type="button" className="shell__icon-button" onClick={toggle} aria-label={label}>
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  )
}

function NavGroupLinks({ group, onNavigate }: { group: NavGroup; onNavigate: () => void }) {
  const { locale, t } = useI18n()
  const { role } = useRole()

  return (
    <>
      {routesForRole(group, role).map((route) => (
        <NavLink
          key={route.path}
          to={`/${locale}/${route.path}`}
          className="shell__link"
          onClick={onNavigate}
        >
          {t(route.labelKey)}
        </NavLink>
      ))}
    </>
  )
}

export function Shell() {
  const { locale, t } = useI18n()
  const pageTitle = useRouteChrome()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="shell">
      <a className="shell__skip" href="#content">
        {t('shell.skipToContent')}
      </a>

      <header className="shell__header">
        <div className="shell__bar">
          <Link to={`/${locale}`} className="shell__brand" onClick={closeMenu}>
            <img src="/icon-192.png" alt="" aria-hidden="true" width={32} height={32} />
            <span>{t('app.short')}</span>
          </Link>

          <div className="shell__tools">
            <RoleSwitch />
            <ThemeToggle />
            <LanguageSwitch />
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
          <NavGroupLinks group="main" onNavigate={closeMenu} />
          <NavGroupLinks group="guest" onNavigate={closeMenu} />
          <NavGroupLinks group="member" onNavigate={closeMenu} />
          <NavGroupLinks group="staff" onNavigate={closeMenu} />
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
          <NavGroupLinks group="footer" onNavigate={closeMenu} />
        </nav>
        <p className="shell__note">{t('shell.footerNote')}</p>
      </footer>
    </div>
  )
}
