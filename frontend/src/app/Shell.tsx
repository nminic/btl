import { useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { dataOr, usePaymentsDueForTheCount } from '../data/useResource'
import { DEV_TOOLS_IN_THIS_BUILD } from '../dev/tools'
import { useI18n } from '../i18n/useI18n'
import { useMayOpen, usePermittedQueues } from '../pages/admin/mayOpen'
import { usePendingForTheCount } from '../pages/admin/pending'
import { notMembersYetIn, totalWaiting } from '../pages/admin/queues'
import { useRole } from '../roles/useRole'
import { useServerIsStillBeingAsked } from '../session/useServerIsStillBeingAsked'
import { useSession } from '../session/useSession'
import { useTheServersSession } from '../session/useTheServersSession'
import { AccountMenu } from './AccountMenu'
import { theDevControls } from './devControls'
import { Brand } from './Brand'
import { ErrorBoundary } from './ErrorBoundary'
import { PortalError } from './PortalError'
import { LanguageMenu } from './LanguageMenu'
import { MessagesMenu } from './MessagesMenu'
import { PageMetaContext } from './pageMetaContext'
import { NavSymbolIcon, PersonIcon } from './icons'
import { NoticeBar } from './NoticeBar'
import { NAV_SYMBOL, type NavSymbol } from './navSymbol'
import { usePhoneHeader } from './phoneHeader'
import { HeaderDecoration, PageBackgroundDecoration } from './RaceInMotion'
import { CONTACT_ADDRESS, FOOTER_ROUTES, navForRole, type NavSection } from './routes'
import { useNewScreen } from './useNewScreen'
import { useRouteChrome } from './useRouteChrome'
import './Shell.css'

/* THE TWO DEVELOPMENT CONTROLS, FOR A BUILD THAT CARRIES THEM (dev/tools.ts), AND NOTHING IN
   ONE THAT DOES NOT: in the production bundle the loader is `null`, and neither switch, nor its
   stylesheet, nor the slot the moved day is kept in, nor the name of either switch, is in the
   package at all (ADL A15). The name is why the condition where they are drawn asks the
   constant as well.

   They are loaded before the portal is first drawn, by `main.tsx`, and read here
   (`app/devControls.ts`, which also says why a failure to load them draws the header without
   them). NOT AWAITED AT THE TOP OF THIS MODULE, which is what this place did until 25.11.2026:
   this module is in the piece of the bundle each switch imports, so it waited for itself and
   QA stayed blank. */

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
  const items = usePendingForTheCount()
  /* TWO reads and not one since 27.09.2026, because one of the five queues is no longer in
     the file: the Uplate tab is a derived list (`queues.ts`, `notMembersYet`). Left out, this
     total would be short by however many people owe a fee, and the number over every screen on
     the portal would disagree with the column that stands beside the work. Both are resources
     the data layer keeps for the whole visit, so it is still one request each. */
  const due = usePaymentsDueForTheCount()
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
function AdminLink({ label, face }: { label: string; face: ReactNode }) {
  const { locale, t } = useI18n()
  const waiting = useWaiting()

  return (
    <NavLink
      to={`/${locale}/${ADMIN}`}
      className="shell__link"
      aria-label={waiting === 0 ? undefined : `${label}, ${t('shell.waiting', { count: waiting })}`}
    >
      {face}
      {waiting > 0 && (
        <span className="shell__waiting" aria-hidden="true">
          {waiting}
        </span>
      )}
    </NavLink>
  )
}

/* AN ENTRY MARKED ON ADDRESSES BEYOND ITS OWN (`NavSection.alsoMarkedOn`): „BTL tabele" on the teams,
 * its third card (owner, 16.11.2026, answer 8). A `NavLink` marks its own address and the ones below it
 * and takes no say from outside, so the mark is worked out here the way it works it out (the address
 * or one below it, in any case of letters) and written the way it writes it: the class `active` and
 * `aria-current="page"`, which is what the stylesheet and a screen reader each read. */
function MarkedAlsoOn({ section, also, face }: { section: NavSection; also: string[]; face: ReactNode }) {
  const { locale } = useI18n()
  const below = useLocation().pathname.split('/').slice(2).join('/').toLowerCase()
  const marked = [section.path, ...also].some((path) => below === path || below.startsWith(`${path}/`))

  return (
    <Link
      to={`/${locale}/${section.path}`}
      className={marked ? 'shell__link active' : 'shell__link'}
      aria-current={marked ? 'page' : undefined}
    >
      {face}
    </Link>
  )
}

/**
 * What a link of the header shows: its word, or on a telephone its symbol with the word kept for the
 * reader alone (owner, 16.11.2026, answer 5: „Na telefonu stoji samo simbol, bez reči ispod; reč ostaje
 * ime za čitač ekrana”). The word is moved out of sight and never taken away (`app/Shell.css`,
 * `.shell__word`), so the name of the link is the same word at every width (ADL A7, „Kontrola koja
 * menja natpis po širini ekrana mora zadržati oba natpisa u pristupačnom stablu"), and the symbol
 * carries no name of its own (`NavSymbolIcon`).
 */
function Face({ symbol, word, phone }: { symbol: NavSymbol; word: string; phone: boolean }) {
  return phone ? (
    <>
      <NavSymbolIcon of={symbol} className="shell__symbol" />
      <span className="shell__word">{word}</span>
    </>
  ) : (
    word
  )
}

function NavEntry({ section, phone }: { section: NavSection; phone: boolean }) {
  const { locale, t } = useI18n()
  const label = t(section.labelKey)
  const face = <Face symbol={section.symbol} word={label} phone={phone} />

  if (section.path === ADMIN) {
    return <AdminLink label={label} face={face} />
  }

  if (section.alsoMarkedOn !== undefined) {
    return <MarkedAlsoOn section={section} also={section.alsoMarkedOn} face={face} />
  }

  return (
    <NavLink to={`/${locale}/${section.path}`} className="shell__link">
      {face}
    </NavLink>
  )
}

/* What a link carries while it is there and is not offered: out of the tab order, out of the
   reader's tree, and unreachable by anything. Spread whole so that the three cannot be told
   apart by a reader of the markup, and so that taking one off is a visible change. */
const NOT_OFFERED = { 'aria-hidden': true, tabIndex: -1, inert: true } as const

/* The class a header link wears while it waits, beside the ones it has. */
function waitingFor(classes: string, asking: boolean): string {
  return asking ? `${classes} shell__guest--waiting` : classes
}

export function Shell() {
  const main = useRef<HTMLElement>(null)
  const { locale, t } = useI18n()
  const sections = useNavSections()
  const rest = useRestOfPath()
  const here = useLocation()
  const openScreen = here.pathname
  /* The address at which a change of language found no book (`LanguageMenu`). The portal's message stands
     in the place of the screen there and nowhere else, so the next address the reader opens is drawn as it
     always is. */
  const [refusedAt, setRefusedAt] = useState<string | null>(null)
  const { pageTitle, declare } = useRouteChrome()
  const phone = usePhoneHeader()

  useNewScreen(main)
  /* Signing out has to empty the header. This used to read the role, which the
     development role switch also sets, so the inbox and the cog stayed on
     screen after a member signed out. The session is the one that knows. */
  const { signedIn } = useSession()
  const asking = useServerIsStillBeingAsked()
  /* And the session is asked of the SERVER here, because this is the one component
     every address on the portal is drawn inside. The cookie from yesterday's visit is
     one no script can read, so without this the browser would be signed in and the
     portal would not know it. */
  useTheServersSession()

  /* The two development controls, side by side and gone together in
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
     them. */
  const DEV_CONTROLS = theDevControls()
  const devControls =
    DEV_TOOLS_IN_THIS_BUILD && DEV_CONTROLS !== null ? (
      <>
        <DEV_CONTROLS.RoleSwitch />
        <DEV_CONTROLS.DateSwitch />
      </>
    ) : null

  /* Signed in: the inbox, then the picture whose menu holds settings
     and signing out. That is where nearly every portal keeps them,
     and a separate cog would be a second door to the same room.

     Signed out: the two things a visitor is here to do, with joining
     as the loud one. It is the only control on this page that brings
     the league any money. */
  const personal =
    signedIn !== null ? (
      <>
        {/* NOT DRAWN TO SOMEBODY WHO REGISTERED AND HAS NOT PAID (owner, 24.10.2026, chosen between
            offered outcomes with the recommendation: „Neplaćenom članu se koverta sa porukama u
            zaglavlju sakriva dok ne plati"). It was drawn to him with an empty panel since
            16.10.2026, and its „Sve poruke" led to a page that sends him on to the fee. */}
        {signedIn.as !== 'neverPaid' && <MessagesMenu />}
        <AccountMenu signedIn={signedIn} />
      </>
    ) : (
      <>
        {/* UNTIL THE SERVER HAS SAID WHO IS READING, THE TWO ARE THERE AND ARE NOT OFFERED (owner,
            10.10.2026, PDL P26, „nevidljiva i nedostupna, pa se ništa ne pomera i ništa se ne
            izgovara"). Offered, they tell a member whose cookie nobody has asked about yet to
            sign in and to join. Taken out, the row of tools would shrink and grow back under
            his pointer when the answer lands; hidden, the row keeps its width and nothing
            moves. `visibility` takes a link out of the tab order and the reader's tree in one
            word, and the three attributes say the same where a stylesheet is not applied
            (`app/Shell.css`, `shell__guest--waiting`). A dead server ends the wait like any
            answer and they appear, as they always did for a visitor. */}
        <Link
          className={waitingFor('button button--secondary button--compact', asking)}
          to={`/${locale}/prijava`}
          {...(asking ? NOT_OFFERED : {})}
        >
          {/* A PERSON ON A DESKTOP, THE ARROW INTO THE DOOR ON A TELEPHONE (owner, 21.11.2026, PDL „Zaglavlje
              za posetioca"): „Prijavi se" stops being a word beside the gold „Učlani se" and becomes the person
              every portal draws for it. The word stays in the link, out of sight, so the name is the same
              „Prijavi se" at every width; a telephone keeps what it has (`Face`). */}
          {phone ? (
            <Face symbol={NAV_SYMBOL.signIn} word={t('shell.signIn')} phone />
          ) : (
            <>
              <PersonIcon className="shell__person" />
              <span className="visually-hidden">{t('shell.signIn')}</span>
            </>
          )}
        </Link>
        <Link
          className={waitingFor('button--cta', asking)}
          to={`/${locale}/registracija`}
          {...(asking ? NOT_OFFERED : {})}
        >
          <Face symbol={NAV_SYMBOL.join} word={t('shell.join')} phone={phone} />
        </Link>
      </>
    )

  /* ONE CELL PER ENTRY ON A TELEPHONE, AND EVERY CELL AS WIDE AS THE NEXT (owner, 16.11.2026: „u donjem
     redu 7 ili 8 jednakih dugmića po širini ekrana”). The row is one grid (`app/Shell.css`,
     `.shell__cells`) and the navigation spans as many of its columns as it holds links, which is told to
     the stylesheet here from the very list that is drawn, so the count cannot be one the reader does not
     see: an entry this person may not open is not in `sections`, and so not in the count either. */
  const navigation = (
    <nav
      className="shell__nav"
      aria-label={t('shell.mainNavigation')}
      style={phone ? { '--cells': sections.length } : undefined}
    >
      {sections.map((section) => (
        <NavEntry key={section.id} section={section} phone={phone} />
      ))}
    </nav>
  )

  return (
    <div className="shell">
      <a className="shell__skip" href="#content">
        {t('shell.skipToContent')}
      </a>

      {/* The two layers of „Race in Motion" (owner, 14.11.2026): pictures under everything, drawn
          once here so that no screen carries a copy (app/RaceInMotion.tsx). */}
      <PageBackgroundDecoration screen={openScreen} />

      <header className={phone ? 'shell__header shell__header--phone' : 'shell__header'}>
        <HeaderDecoration />
        <div className="shell__bar">
          <Brand />

          <div className="shell__tools">
            <LanguageMenu restOfPath={rest} onRefused={() => setRefusedAt(here.key)} />
            {!phone && personal}
          </div>
        </div>

        {/* ON A TELEPHONE THE FIRST ROW IS THE MARK AND THE LANGUAGE, AND NOTHING ELSE (owner, 16.11.2026: „u
            prvom redu ide logo BTL sa tekstom i motoom, a pored izbor jezika”). The two development controls,
            which only QA draws, stand in a row of their own under it, in the order they are read; the
            envelope and the picture, or the two links of a visitor, are the last cells of the second row,
            the picture the very last (owner: „poslednja stavka je sličica ulogovanog korisnika, ukoliko
            postoji”). On a desktop the language, the envelope and the picture, or the two links of a
            visitor, stand in the first row beside the mark, and the words in the second (`app/phoneHeader.ts`
            says why the two are two orders of the document and not one moved by a stylesheet).

            THE DEVELOPMENT CONTROLS HAVE A ROW OF THEIR OWN ON A DESKTOP AS WELL (owner, 17.11.2026: „na
            tablet verziji izbor jezika, koverta i profilna slicica treba da ostanu u redu gde je logo, posto
            se dole reci ispisuju cele za navigaciju.”). In the first row, before the language, they asked
            278px of the row on QA, and took the language, the envelope and the picture down with them into
            a row of their own (measured on a build with `VITE_DEV_TOOLS=1`, 17.11.2026: at 700, 768 and
            820px for every reader, at 900px for all but one who has not paid, at 1024px for a visitor, and
            at 1280px with the text at 150% for everyone). A build for the league has no such controls, and
            there nothing moves. */}
        {devControls !== null && <div className="shell__dev">{devControls}</div>}

        {/* ONE WRAPPER IN BOTH SHAPES, so that the navigation is the same element when the window crosses 700px
            and keeps the focus a reader had on one of its words (PENDING, review of PR 755, 17.11.2026). On a
            telephone it is the row of cells; on a desktop it is a plain block, which measured the same as no
            wrapper at every width of `geometry/phoneHeader.geometry.ts`. The envelope and the picture change
            places with the shape, and keep what they had by another way (`app/Dropdown.tsx`). */}
        <div className={phone ? 'shell__cells' : undefined}>
          {navigation}
          {phone && personal}
        </div>

        {/* THE GOLD STRIP, THE LAST THING IN THE HEADER, which is where it stands: under the bar and the
            navigation, over the content (owner, 21.11.2026, PDL „Zlatna traka obaveštenja ispod
            zaglavlja"). It is in the header and in neither of the other two places it could have been
            drawn, and both were measured. Outside every landmark, axe's `region` rule fails on every
            screen that shows it. First in `main`, the rule that a page begins with its heading
            (`test/met.ts`, „begins with its heading", held by `pages/publicData.test.tsx`) fails on the
            same screens, and a reader sent to the content by the skip link would meet a note before the
            name of the screen. The header is a landmark (the banner) and a note for the whole site
            belongs to it; its own bar and navigation are drawn first and keep their places
            (`app/NoticeBar.tsx`). */}
        <NoticeBar main={main} />
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
          {refusedAt === here.key ? (
            <PortalError />
          ) : (
            <ErrorBoundary fallback={<PortalError />}>
              <Outlet />
            </ErrorBoundary>
          )}
        </main>
      </PageMetaContext.Provider>

      <footer className="shell__footer">
        <nav className="shell__footer-links" aria-label={t('shell.footerNavigation')}>
          {FOOTER_ROUTES.map((route) => (
            <NavLink
              key={route.path}
              to={`/${locale}/${route.path}`}
              className="shell__link"
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
