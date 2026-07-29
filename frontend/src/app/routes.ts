import { isMember, isStaff, type Role } from '../roles/context'

export type NavGroup = 'main' | 'guest' | 'member' | 'staff' | 'footer'

export type RouteDef = {
  /** Path relative to the locale segment, so "kalendar" becomes /sr/kalendar. */
  path: string
  labelKey: string
  group: NavGroup
}

/* The slugs stay Serbian in every language (ADL A2 writes the English route as
 * /en/kalendar). One address per screen, whichever language is shown. */
export const ROUTES: RouteDef[] = [
  { path: 'kalendar', labelKey: 'nav.calendar', group: 'main' },
  { path: 'rang-liste', labelKey: 'nav.rankings', group: 'main' },
  { path: 'takmicari', labelKey: 'nav.competitors', group: 'main' },
  { path: 'timovi', labelKey: 'nav.teams', group: 'main' },
  { path: 'lige', labelKey: 'nav.leagues', group: 'main' },
  { path: 'znacke', labelKey: 'nav.badges', group: 'main' },
  { path: 'clanarina', labelKey: 'nav.pricing', group: 'main' },

  { path: 'registracija', labelKey: 'nav.register', group: 'guest' },
  { path: 'prijava', labelKey: 'nav.login', group: 'guest' },

  { path: 'moj-profil', labelKey: 'nav.myProfile', group: 'member' },
  { path: 'moji-rezultati', labelKey: 'nav.myResults', group: 'member' },
  { path: 'moja-clanarina', labelKey: 'nav.membership', group: 'member' },
  { path: 'poruke', labelKey: 'nav.messages', group: 'member' },

  { path: 'administracija', labelKey: 'nav.admin', group: 'staff' },
  { path: 'administracija/red-za-proveru', labelKey: 'nav.reviewQueue', group: 'staff' },
  { path: 'administracija/clanovi', labelKey: 'admin.members', group: 'staff' },
  { path: 'administracija/dogadjaji', labelKey: 'admin.events', group: 'staff' },
  { path: 'administracija/znacke', labelKey: 'admin.badges', group: 'staff' },
  { path: 'administracija/cenovnik', labelKey: 'admin.pricing', group: 'staff' },

  { path: 'pravilnik', labelKey: 'nav.rules', group: 'footer' },
  { path: 'o-ligi', labelKey: 'nav.about', group: 'footer' },
  { path: 'kontakt', labelKey: 'nav.contact', group: 'footer' },
  { path: 'politika-privatnosti', labelKey: 'nav.privacy', group: 'footer' },
  { path: 'uslovi-koriscenja', labelKey: 'nav.terms', group: 'footer' },
]

export function routesForRole(group: NavGroup, role: Role): RouteDef[] {
  // Registering is offered to whoever is not a member yet, and to nobody else.
  if (group === 'guest' && isMember(role)) {
    return []
  }

  if (group === 'member' && !isMember(role)) {
    return []
  }

  if (group === 'staff' && !isStaff(role)) {
    return []
  }

  return ROUTES.filter((route) => route.group === group)
}
