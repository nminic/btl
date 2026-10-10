import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { dataOr, usePaymentsDue } from '../data/useResource'
import { DEV_TOOLS_IN_THIS_BUILD, loadTheDevControls } from '../dev/tools'
import { useI18n } from '../i18n/useI18n'
import { useMayOpen, usePermittedQueues } from '../pages/admin/mayOpen'
import { usePending } from '../pages/admin/pending'
import { notMembersYetIn, totalWaiting } from '../pages/admin/queues'
import { useRole } from '../roles/useRole'
import { useSession } from '../session/useSession'
import { useTheServersSession } from '../session/useTheServersSession'
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

/* THE TWO DEVELOPMENT CONTROLS, FOR A BUILD THAT CARRIES THEM (dev/tools.ts), AND NOTHING IN
   ONE THAT DOES NOT: in the production bundle this line is `null`, and neither switch, nor its
   stylesheet, nor the slot the moved day is kept in, nor the name of either switch, is in the
   package at all (ADL A15). The name is why the condition where they are drawn asks the
   constant as well.

   Awaited before this module is done rather than drawn lazily, because a control that
   arrived after the first paint would shift the row of tools under the reader's pointer, and
   on QA, the one place they are drawn, that row is the header of every screen. */
const DEV_CONTROLS = loadTheDevControls === null ? null : await loadTheDevControls()

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
 * number counts nothing out of it.
 */
function useWaiting(): number {
  const { decisions } = useSession()
  const items = usePending()
  /* TWO reads and not one since 27.09.2026, because one of the five queues is no longer in
     the file: the Uplate tab is a derived list (`queues.ts`, `notMembersYet`). Left out, this
     total would be short by however many people owe a fee, and the number over every screen on
     the portal would disagree with the column that stands beside the work. Both are resources
     the data layer keeps for the whole visit, so it is still one request each. */
  const due = usePaymentsDue()
  /* Over the queues this moderator may work in and no others. A total that
     counted the rest would send him looking for work he cannot reach and is not
     shown anywhere (owner, 30.07.2026). */
  const queues = usePermittedQueues()

  return totalWaiting(
    {
      notMembersYet: notMembersYetIn(dataOr(due, null)),
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
  const { signedIn } = useSession()
  /* And the session is asked of the SERVER here, because this is the one component
     every address on the portal is drawn inside. The cookie from yesterday's visit is
     one no script can read, so without this the browser would be signed in and the
     portal would not know it. */
  useTheServersSession()

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
                day the portal is being read as.

                THE CONSTANT IS ASKED HERE AS WELL AS THE LOADER'S ANSWER, and it reads as one
                question asked twice. It is two. `DEV_CONTROLS` is a variable, so the bundler
                cannot know it is `null` where it is read, and the branch stayed in the
                production package with the names of both switches in it: the two properties
                read off the object are not shortened. Measured 09.10.2026 on Vite 8.1.5, by
                `grep -a -o -F` over the production `dist/`: `DateSwitch` once and `RoleSwitch`
                once with the loader's answer alone, and none of either with the constant in
                front of it: the bundler knows the constant, so it drops the whole branch. A15
                looks for exactly those words, and `dev/productionPackage.test.ts` counts
                them. */}
            {DEV_TOOLS_IN_THIS_BUILD && DEV_CONTROLS !== null && (
              <>
                <DEV_CONTROLS.RoleSwitch />
                <DEV_CONTROLS.DateSwitch />
              </>
            )}
            <LanguageMenu restOfPath={rest} />

            {/* Signed in: the inbox, then the picture whose menu holds settings
                and signing out. That is where nearly every portal keeps them,
                and a separate cog would be a second door to the same room.

                Signed out: the two things a visitor is here to do, with joining
                as the loud one. It is the only control on this page that brings
                the league any money. */}
            {signedIn !== null ? (
              <>
                <MessagesMenu />
                <AccountMenu signedIn={signedIn} />
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
        {/* „Portal je u izradi. Sve što ovde vidiš su probni podaci." stood here
            until 22.08.2026, when the owner asked for it to go: „znam do kada su
            podaci probni a kad će postati stvarni." The key went out of the
            dictionary with it, and a guard holds both. */}
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
